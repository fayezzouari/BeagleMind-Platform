import os
import json
import re
import uuid
import logging
from typing import List, Dict, Any
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType, utility
from langchain.text_splitter import RecursiveCharacterTextSplitter
import onnxruntime as ort
from transformers import AutoTokenizer
import numpy as np
from datetime import datetime
import dotenv
from pathlib import Path

dotenv.load_dotenv()
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", 19530)
MILVUS_USER = os.getenv("MILVUS_USER")
MILVUS_PASSWORD = os.getenv("MILVUS_PASSWORD")
MILVUS_TOKEN = os.getenv("MILVUS_TOKEN")
MILVUS_URI = os.getenv("MILVUS_URI")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _encode_text(text: str, tokenizer, session) -> List[float]:
    """Encode text using ONNX embedding model"""
    inputs = tokenizer(
        text, 
        return_tensors="np", 
        padding=True, 
        truncation=True, 
        max_length=512
    )
    
    onnx_inputs = {
        "input_ids": inputs["input_ids"].astype(np.int64),
        "attention_mask": inputs["attention_mask"].astype(np.int64)
    }
    
    if "token_type_ids" in inputs:
        onnx_inputs["token_type_ids"] = inputs["token_type_ids"].astype(np.int64)
    
    # Get outputs from the ONNX model
    outputs = session.run(None, onnx_inputs)
    
    # Use mean pooling over token embeddings
    embedding = outputs[0][0].mean(axis=0)
    
    # Normalize the embedding
    norm = np.linalg.norm(embedding)
    normalized_embedding = (embedding / norm) if norm != 0 else embedding
    
    return normalized_embedding.tolist()

def semantic_chunk_post(content: str, language: str = "text", chunk_size: int = 1024) -> List[str]:
    """
    Chunk forum post content using RecursiveCharacterTextSplitter.
    More reliable than semantic chunking for forum posts.
    """
    # Use RecursiveCharacterTextSplitter for reliable chunking of forum posts
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=50,  # Small overlap to maintain context
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    
    chunks = text_splitter.split_text(content)
    return [chunk for chunk in chunks if len(chunk.strip()) > 10]

def connect_milvus():
    connect_kwargs = {'alias': "default", 'timeout': 30}
    if MILVUS_URI:
        connect_kwargs['uri'] = MILVUS_URI
    else:
        connect_kwargs['host'] = MILVUS_HOST
        connect_kwargs['port'] = MILVUS_PORT
    if MILVUS_USER:
        connect_kwargs['user'] = MILVUS_USER
    if MILVUS_PASSWORD:
        connect_kwargs['password'] = MILVUS_PASSWORD
    if MILVUS_TOKEN:
        connect_kwargs['token'] = MILVUS_TOKEN
    connections.connect(**connect_kwargs)

def get_or_create_collection(collection_name: str, embedding_dim: int) -> Collection:
    # Schema aligned with GitHub ingestor (16 fields)
    fields = [
        FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=100),
        FieldSchema(name="document", dtype=DataType.VARCHAR, max_length=65535),
        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=embedding_dim),
        FieldSchema(name="file_name", dtype=DataType.VARCHAR, max_length=500),
        FieldSchema(name="file_path", dtype=DataType.VARCHAR, max_length=1000),
        FieldSchema(name="file_type", dtype=DataType.VARCHAR, max_length=50),
        FieldSchema(name="source_link", dtype=DataType.VARCHAR, max_length=2000),
        FieldSchema(name="github_link", dtype=DataType.VARCHAR, max_length=2000),
        FieldSchema(name="chunk_index", dtype=DataType.INT64),
        FieldSchema(name="language", dtype=DataType.VARCHAR, max_length=50),
        FieldSchema(name="has_code", dtype=DataType.BOOL),
        FieldSchema(name="repo_name", dtype=DataType.VARCHAR, max_length=200),
        FieldSchema(name="content_quality_score", dtype=DataType.FLOAT),
        FieldSchema(name="semantic_density_score", dtype=DataType.FLOAT),
        FieldSchema(name="information_value_score", dtype=DataType.FLOAT),
        FieldSchema(name="image_links", dtype=DataType.VARCHAR, max_length=8192),
    ]

    schema = CollectionSchema(fields, "Forum content with semantic chunking and image metadata")

    # If collection exists, use it as-is (do not drop or overwrite). Otherwise create new with full schema.
    if utility.has_collection(collection_name):
        logger.info(f"Collection '{collection_name}' already exists; appending new data without schema changes.")
        col = Collection(collection_name)
    else:
        logger.info(f"Creating collection '{collection_name}'")
        col = Collection(collection_name, schema)
        index_params = {"metric_type": "L2", "index_type": "IVF_FLAT", "params": {"nlist": 1024}}
        col.create_index("embedding", index_params)

    col.load()
    return col

def ingest_forum_json(json_path: str, collection_name: str = "beaglemind_col", model_name: str = "BAAI/bge-base-en-v1.5"):
    connect_milvus()
    
    # Initialize ONNX embedding model (offline/local files)
    # Resolve absolute path to the onnx assets directory: <repo>/beaglemind-api/onnx
    script_path = Path(__file__).resolve()
    onnx_dir = script_path.parents[2] / "onnx"
    tokenizer = AutoTokenizer.from_pretrained(str(onnx_dir), local_files_only=True)
    session = ort.InferenceSession(str(onnx_dir / "model.onnx"))
    
    # Get embedding dimension
    sample_embedding = _encode_text("test", tokenizer, session)
    embedding_dim = len(sample_embedding)
    logger.info(f"Embedding dimension: {embedding_dim}")
    
    collection = get_or_create_collection(collection_name, embedding_dim)
    
    with open(json_path, 'r') as f:
        threads = json.load(f)
    
    # Prepare data aligned to 16-field schema
    chunk_data = []
    
    # Simple image URL extractor (markdown, html, or direct links)
    image_patterns = [
        r'!\[[^\]]*\]\(([^)]+)\)',                    # Markdown image
        r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>',   # HTML image
        r'\bhttps?://[^\s]+\.(?:png|jpg|jpeg|gif|svg|webp|bmp|ico)\b'  # Direct URL
    ]
    def extract_images(text: str) -> List[str]:
        links = []
        for pat in image_patterns:
            for m in re.finditer(pat, text, re.IGNORECASE):
                url = m.group(1) if m.groups() else m.group(0)
                links.append(url)
        # de-dup
        return list({u for u in links})
    for thread in threads:
        thread_link = thread.get("url", "")
        thread_name = thread.get("thread_name", "")
        content = thread.get("content", "")
        
        # Split by 'Post #' (robust for forum dumps)
        post_splits = [p for p in re.split(r'Post #\d+ by [^:]+:', content) if p.strip()]
        for post_idx, post_text in enumerate(post_splits):
            post_text = post_text.strip()
            if not post_text or len(post_text) < 20:
                continue
                
            # Semantic chunking
            chunks = semantic_chunk_post(post_text)
            for chunk_idx, chunk in enumerate(chunks):
                if len(chunk.strip()) < 20:
                    continue
                
                # Extract images from this chunk
                imgs = extract_images(chunk)
                image_links = json.dumps(imgs) if imgs else '[]'
                
                # Create metadata for the 16 fields
                chunk_data.append({
                    'id': str(uuid.uuid4()),
                    'document': chunk[:65535],
                    'file_name': f"forum_post_{post_idx}",
                    'file_path': f"forum/{thread_name}",
                    'file_type': '.forum',
                    'source_link': thread_link[:2000],
                    'github_link': thread_link[:2000],  # no GitHub source; keep same as source_link for traceability
                    'chunk_index': chunk_idx,
                    'language': 'text',
                    'has_code': False,
                    'repo_name': 'beagleboard_forum',
                    'content_quality_score': 0.7,
                    'semantic_density_score': 0.6,
                    'information_value_score': 0.8,
                    'image_links': image_links,
                })
    
    # Generate embeddings
    logger.info(f"Generating embeddings for {len(chunk_data)} chunks...")
    documents = [item['document'] for item in chunk_data]
    
    embeddings = []
    for i, doc in enumerate(documents):
        embedding = _encode_text(doc, tokenizer, session)
        embeddings.append(embedding)
        if i % 100 == 0:
            logger.info(f"Generated embeddings: {i}/{len(documents)}")
    
    embeddings = np.array(embeddings)
    
    # Insert in batches; dynamically align to existing collection schema order
    batch_size = 100
    for i in range(0, len(chunk_data), batch_size):
        batch_end = min(i + batch_size, len(chunk_data))
        batch_data = chunk_data[i:batch_end]
        batch_embeddings = embeddings[i:batch_end]
        
        # Build per-field arrays
        field_values: Dict[str, Any] = {
            'id': [item['id'] for item in batch_data],
            'document': [item['document'] for item in batch_data],
            'embedding': batch_embeddings.tolist(),
            'file_name': [item['file_name'] for item in batch_data],
            'file_path': [item['file_path'] for item in batch_data],
            'file_type': [item['file_type'] for item in batch_data],
            'source_link': [item['source_link'] for item in batch_data],
            'github_link': [item.get('github_link', '') for item in batch_data],
            'chunk_index': [item['chunk_index'] for item in batch_data],
            'language': [item['language'] for item in batch_data],
            'has_code': [item['has_code'] for item in batch_data],
            'repo_name': [item['repo_name'] for item in batch_data],
            'content_quality_score': [item['content_quality_score'] for item in batch_data],
            'semantic_density_score': [item['semantic_density_score'] for item in batch_data],
            'information_value_score': [item['information_value_score'] for item in batch_data],
            'image_links': [item.get('image_links', '[]') for item in batch_data],
        }

        # Respect existing schema order and skip unknown fields
        existing_order = [f.name for f in collection.schema.fields]
        entities = []
        for fname in existing_order:
            if fname not in field_values:
                logger.debug(f"Skipping field not present in prepared data: {fname}")
                # In case collection has a field we don't prepare, provide sensible defaults
                if fname == 'embedding':
                    entities.append(batch_embeddings.tolist())
                else:
                    # default empty per-row values to keep lengths consistent
                    entities.append(['' for _ in batch_data])
                continue
            entities.append(field_values[fname])
        
        collection.insert(entities)
        collection.flush()
        logger.info(f"Inserted {batch_end}/{len(chunk_data)} chunks")
    
    logger.info(f"Forum ingestion complete: {len(chunk_data)} chunks stored in '{collection_name}'")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Ingest forum JSON threads into Milvus collection with semantic chunking.")
    parser.add_argument("json_path", help="Path to scraped_threads_complete.json")
    parser.add_argument("--collection", default="beaglemind_col", help="Milvus collection name")
    parser.add_argument("--model", default="BAAI/bge-base-en-v1.5", help="Embedding model name")
    args = parser.parse_args()
    ingest_forum_json(args.json_path, args.collection, args.model)