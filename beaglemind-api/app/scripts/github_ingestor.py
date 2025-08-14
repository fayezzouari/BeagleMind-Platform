#!/usr/bin/env python3
"""
Direct GitHub Repository Ingestion System

This script directly fetches repository content from GitHub API, performs semantic
text splitting, extracts image links, and stores comprehensive metadata in Milvus.
"""

import os
import re
import json
import uuid
import base64
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from urllib.parse import urljoin, urlparse
import time

#from app.config import MILVUS_HOST, MILVUS_PORT, MILVUS_USER, MILVUS_PASSWORD, MILVUS_TOKEN, MILVUS_URI


import requests
import os
import time
import uuid
import logging
import argparse
import traceback
import re
import numpy as np
import onnxruntime as ort
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv

#from app.config import MILVUS_HOST, MILVUS_PORT, MILVUS_USER, MILVUS_PASSWORD, MILVUS_TOKEN, MILVUS_URI
from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType, utility
from langchain.text_splitter import RecursiveCharacterTextSplitter
from transformers import AutoTokenizer
from concurrent.futures import ThreadPoolExecutor

load_dotenv = load_dotenv
from transformers import AutoTokenizer
import numpy as np
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor
import os
import dotenv

dotenv.load_dotenv()
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", 19530)
MILVUS_USER = os.getenv("MILVUS_USER")
MILVUS_PASSWORD = os.getenv("MILVUS_PASSWORD")
MILVUS_TOKEN = os.getenv("MILVUS_TOKEN")
MILVUS_URI = os.getenv("MILVUS_URI")

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GitHubDirectIngester:
    """Direct GitHub repository ingestion with semantic splitting and image metadata."""
    
    def __init__(self, collection_name: str = "beaglemind_col", 
                 model_name: str = "BAAI/bge-base-en-v1.5",
                 github_token: Optional[str] = None):
        """
        Initialize the GitHub direct ingester.
        
        Args:
            collection_name: Name of the Milvus collection
            model_name: Embedding model name
            github_token: GitHub API token for higher rate limits
        """
        self.collection_name = collection_name
        self.model_name = model_name
        self.github_token = github_token
        
        # Initialize ONNX embedding model (offline mode)
        try:
            # Use local tokenizer files instead of downloading from HuggingFace
            self.embedding_tokenizer = AutoTokenizer.from_pretrained(
                "onnx/", 
                local_files_only=True
            )
            self.embedding_session = ort.InferenceSession("onnx/model.onnx")
            logger.info(f"Loaded ONNX embedding model offline: {model_name}")
        except Exception as e:
            logger.error(f"Could not load ONNX embedding model: {e}")
            raise
        
        # Setup GitHub API headers
        self.github_headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'BeagleMind-Ingester/1.0'
        }
        if self.github_token:
            self.github_headers['Authorization'] = f'token {self.github_token}'
        
        # Connect to Milvus and setup collection
        self._connect_to_milvus()
        self._setup_enhanced_collection()
        
        # Image patterns for detection
        self.image_patterns = [
            r'!\[([^\]]*)\]\(([^)]+)\)',  # Markdown images
            r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>',  # HTML images
            r'\bhttps?://[^\s]+\.(?:png|jpg|jpeg|gif|svg|webp|bmp|ico)\b',  # Direct image URLs
        ]
        
        # Supported file types for processing
        self.supported_extensions = {
            '.md', '.txt', '.rst', '.py', '.js', '.ts', '.java', '.cpp', '.c', '.h',
            '.css', '.html', '.xml', '.json', '.yaml', '.yml', '.toml', '.ini',
            '.sh', '.bat', '.ps1', '.go', '.rs', '.rb', '.php', '.sql', '.r'
        }
    
    def _encode_text(self, text: str) -> List[float]:
        """Encode text using ONNX embedding model"""
        inputs = self.embedding_tokenizer(
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
        outputs = self.embedding_session.run(None, onnx_inputs)
        
        # Use mean pooling over token embeddings
        embedding = outputs[0][0].mean(axis=0)
        
        # Normalize the embedding
        norm = np.linalg.norm(embedding)
        normalized_embedding = (embedding / norm) if norm != 0 else embedding
        
        return normalized_embedding.tolist()
    
    def _connect_to_milvus(self):
        """Connect to Milvus server with retry logic, using config.py variables."""
        max_retries = 3
        retry_delay = 2

        milvus_host = MILVUS_HOST
        milvus_port = MILVUS_PORT
        milvus_user = MILVUS_USER
        milvus_password = MILVUS_PASSWORD
        milvus_token = MILVUS_TOKEN
        milvus_uri = MILVUS_URI

        for attempt in range(max_retries):
            try:
                # Disconnect any existing connections first
                try:
                    connections.disconnect("default")
                except:
                    pass

                connect_kwargs = {
                    'alias': "default",
                    'timeout': 30
                }
                # Prefer URI if available (for Zilliz Cloud)
                if milvus_uri:
                    connect_kwargs['uri'] = milvus_uri
                else:
                    connect_kwargs['host'] = milvus_host
                    connect_kwargs['port'] = milvus_port
                if milvus_user:
                    connect_kwargs['user'] = milvus_user
                if milvus_password:
                    connect_kwargs['password'] = milvus_password
                if milvus_token:
                    connect_kwargs['token'] = milvus_token

                connections.connect(**connect_kwargs)

                # Test connection by listing collections
                utility.list_collections()
                logger.info(f"Successfully connected to Milvus at {milvus_host}:{milvus_port}")
                return

            except Exception as e:
                logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    logger.error(f"Failed to connect to Milvus after {max_retries} attempts")
                    raise
    
    def _setup_enhanced_collection(self):
        """Setup enhanced collection schema with comprehensive metadata."""
        # Get embedding dimension from ONNX model
        sample_embedding = self._encode_text("test")
        embedding_dim = len(sample_embedding)
        logger.info(f"Embedding dimension: {embedding_dim}")
        
        # Simplified schema matching retrieval service (14 fields)
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=100),
            FieldSchema(name="document", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=embedding_dim),
            FieldSchema(name="file_name", dtype=DataType.VARCHAR, max_length=500),
            FieldSchema(name="file_path", dtype=DataType.VARCHAR, max_length=1000),
            FieldSchema(name="file_type", dtype=DataType.VARCHAR, max_length=50),
            FieldSchema(name="source_link", dtype=DataType.VARCHAR, max_length=2000),
            FieldSchema(name="chunk_index", dtype=DataType.INT64),
            FieldSchema(name="language", dtype=DataType.VARCHAR, max_length=50),
            FieldSchema(name="has_code", dtype=DataType.BOOL),
            FieldSchema(name="repo_name", dtype=DataType.VARCHAR, max_length=200),
            FieldSchema(name="content_quality_score", dtype=DataType.FLOAT),
            FieldSchema(name="semantic_density_score", dtype=DataType.FLOAT),
            FieldSchema(name="information_value_score", dtype=DataType.FLOAT),
        ]
        
        schema = CollectionSchema(fields, "Enhanced repository content with semantic chunking and image metadata")
        
        # Handle existing collection with better error handling
        try:
            if utility.has_collection(self.collection_name):
                logger.info(f"Collection '{self.collection_name}' already exists, loading to append new data.")
                self.collection = Collection(self.collection_name)
                self.collection.load()
                logger.info(f"Using existing collection '{self.collection_name}' - new data will be appended")
                return
            
            # Create new collection with retry logic
            max_create_retries = 3
            for attempt in range(max_create_retries):
                try:
                    logger.info(f"Creating enhanced collection '{self.collection_name}' (attempt {attempt + 1})")
                    self.collection = Collection(self.collection_name, schema)
                    break
                except Exception as create_error:
                    logger.warning(f"Collection creation attempt {attempt + 1} failed: {create_error}")
                    if attempt < max_create_retries - 1:
                        time.sleep(3)  # Wait before retry
                        # Try to clean up any partial state
                        try:
                            if utility.has_collection(self.collection_name):
                                utility.drop_collection(self.collection_name)
                        except:
                            pass
                    else:
                        raise
            
            # Create indexes with retry logic
            try:
                index_params = {
                    "metric_type": "L2",
                    "index_type": "IVF_FLAT",
                    "params": {"nlist": 1024}
                }
                self.collection.create_index("embedding", index_params)
                
                # Create scalar indexes for efficient filtering
                scalar_indexes = ["file_type", "language", "repo_name", "has_code"]
                for field_name in scalar_indexes:
                    try:
                        self.collection.create_index(field_name)
                    except Exception as idx_error:
                        logger.warning(f"Could not create index for {field_name}: {idx_error}")
                
                logger.info("Created indexes for collection")
            except Exception as index_error:
                logger.warning(f"Index creation failed: {index_error}")
                # Continue without indexes if they fail
            
            # Load collection
            self.collection.load()
            logger.info(f"Collection '{self.collection_name}' ready for use")
            
        except Exception as e:
            logger.error(f"Failed to setup collection: {e}")
            # Provide more specific error guidance
            if "node not match" in str(e) or "InvalidateCollectionMetaCache" in str(e):
                logger.error("This appears to be a Milvus server state issue. Try:")
                logger.error("1. Restart Milvus server: docker restart milvus-standalone")
                logger.error("2. Or restart the entire Milvus stack")
                logger.error("3. Wait a few minutes and try again")
            raise
    
    def fetch_repository_tree(self, repo_owner: str, repo_name: str, 
                             branch: str = "main") -> List[Dict[str, Any]]:
        """
        Fetch complete repository tree from GitHub API.
        
        Args:
            repo_owner: Repository owner
            repo_name: Repository name
            branch: Branch to fetch (default: main)
            
        Returns:
            List of file information dictionaries
        """
        logger.info(f"[FETCH] Starting repository tree fetch for {repo_owner}/{repo_name} (branch: {branch})")
        
        # Get repository info
        logger.info(f"[FETCH] Retrieving repository information...")
        repo_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"
        response = requests.get(repo_url, headers=self.github_headers)
        
        if response.status_code == 404:
            # Try 'master' branch if 'main' fails
            if branch == "main":
                logger.info("[FETCH] Branch 'main' not found, trying 'master' branch as fallback")
                return self.fetch_repository_tree(repo_owner, repo_name, "master")
            else:
                logger.error(f"[FETCH ERROR] Repository {repo_owner}/{repo_name} not found or not accessible")
                raise ValueError(f"Repository {repo_owner}/{repo_name} not found or not accessible")
        
        response.raise_for_status()
        repo_info = response.json()
        logger.info(f"[FETCH] Repository info retrieved successfully")
        
        # Get tree recursively
        logger.info(f"[FETCH] Retrieving file tree recursively...")
        tree_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/git/trees/{branch}?recursive=1"
        response = requests.get(tree_url, headers=self.github_headers)
        response.raise_for_status()
        
        tree_data = response.json()
        total_items = len(tree_data.get('tree', []))
        logger.info(f"[FETCH] Retrieved {total_items} total items from repository tree")
        
        files = []
        
        files = []
        processed_files = 0
        
        for item in tree_data.get('tree', []):
            if item['type'] == 'blob':  # Only files, not directories
                file_path = item['path']
                file_extension = Path(file_path).suffix.lower()
                
                # Filter supported file types
                if file_extension in self.supported_extensions or not file_extension:
                    files.append({
                        'path': file_path,
                        'name': Path(file_path).name,
                        'extension': file_extension,
                        'sha': item['sha'],
                        'size': item.get('size', 0),
                        'url': item['url'],
                        'download_url': f"https://raw.githubusercontent.com/{repo_owner}/{repo_name}/{branch}/{file_path}",
                        'source_link': f"https://github.com/{repo_owner}/{repo_name}/blob/{branch}/{file_path}",
                        'raw_url': f"https://raw.githubusercontent.com/{repo_owner}/{repo_name}/{branch}/{file_path}",
                        'blob_url': f"https://github.com/{repo_owner}/{repo_name}/blob/{branch}/{file_path}"
                    })
                    processed_files += 1
                    
                    # Log progress every 100 files
                    if processed_files % 100 == 0:
                        logger.info(f"[FETCH PROGRESS] Processed {processed_files} supported files so far...")
        
        logger.info(f"[FETCH COMPLETE] Found {len(files)} supported files out of {total_items} total items in repository")
        logger.info(f"[FETCH COMPLETE] Supported file types: {', '.join(sorted(self.supported_extensions))}")
        return files
    
    def fetch_file_content(self, file_info: Dict[str, Any]) -> Optional[str]:
        """
        Fetch content of a single file.
        
        Args:
            file_info: File information dictionary
            
        Returns:
            File content as string or None if failed
        """
        try:
            response = requests.get(file_info['download_url'], headers=self.github_headers)
            response.raise_for_status()
            
            # Try to decode as UTF-8, fallback to latin-1
            try:
                content = response.content.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    content = response.content.decode('latin-1')
                except UnicodeDecodeError:
                    logger.warning(f"Could not decode {file_info['path']}, skipping")
                    return None
            
            return content
            
        except Exception as e:
            logger.warning(f"Failed to fetch {file_info['path']}: {e}")
            return None
    
    def extract_images_and_links(self, content: str, base_url: str = "") -> Tuple[List[str], List[str], List[str]]:
        """
        Extract image links, attachment links, and external links from content.
        
        Args:
            content: Text content to analyze
            base_url: Base URL for resolving relative links
            
        Returns:
            Tuple of (image_links, attachment_links, external_links)
        """
        image_links = []
        attachment_links = []
        external_links = []
        
        # Extract markdown and HTML images
        for pattern in self.image_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                if pattern.startswith('!\\['):  # Markdown image
                    image_url = match.group(2)
                elif pattern.startswith('<img'):  # HTML image
                    image_url = match.group(1)
                else:  # Direct URL
                    image_url = match.group(0)
                
                # Resolve relative URLs
                if base_url and not image_url.startswith(('http://', 'https://')):
                    image_url = urljoin(base_url, image_url)
                
                image_links.append(image_url)
        
        # Extract links to attachments (PDFs, documents, etc.)
        attachment_patterns = [
            r'\[([^\]]+)\]\(([^)]+\.(?:pdf|doc|docx|ppt|pptx|xls|xlsx|zip|tar|gz))\)',
            r'href=["\']([^"\']+\.(?:pdf|doc|docx|ppt|pptx|xls|xlsx|zip|tar|gz))["\']'
        ]
        
        for pattern in attachment_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                attachment_url = match.group(2) if len(match.groups()) > 1 else match.group(1)
                if base_url and not attachment_url.startswith(('http://', 'https://')):
                    attachment_url = urljoin(base_url, attachment_url)
                attachment_links.append(attachment_url)
        
        # Extract external links
        link_patterns = [
            r'\[([^\]]+)\]\((https?://[^)]+)\)',  # Markdown links
            r'href=["\']([^"\']+)["\']',  # HTML links
            r'\bhttps?://[^\s\)\]\},;"\'`<>]+',  # Direct URLs
        ]
        
        for pattern in link_patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                if len(match.groups()) > 1:
                    link_url = match.group(2)
                else:
                    link_url = match.group(1) if match.groups() else match.group(0)
                
                # Filter out image and attachment links already captured
                if (link_url.startswith(('http://', 'https://')) and 
                    not any(ext in link_url.lower() for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.doc'])):
                    external_links.append(link_url)
        
        # Remove duplicates and clean up
        image_links = list(set(image_links))
        attachment_links = list(set(attachment_links))
        external_links = list(set(external_links))
        
        return image_links, attachment_links, external_links
    
    def semantic_chunk_content(self, content: str, file_info: Dict[str, Any], 
                              max_chunk_size: int = 1000) -> List[str]:
        """
        Perform chunking of content using RecursiveCharacterTextSplitter.
        
        Args:
            content: Content to chunk
            file_info: File information for context
            max_chunk_size: Maximum chunk size
            
        Returns:
            List of chunk texts
        """
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=max_chunk_size,
            chunk_overlap=100,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        chunks = text_splitter.split_text(content)
        return [chunk for chunk in chunks if len(chunk.strip()) > 30]
    
    def analyze_content(self, content: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze content for language, code elements, and quality metrics.
        
        Args:
            content: Content to analyze
            file_info: File information
            
        Returns:
            Analysis results dictionary
        """
        # Language detection based on file extension and content patterns
        language = self._detect_language(content, file_info['extension'])
        
        # Extract code elements
        code_elements = self._extract_code_elements(content, language)
        
        # Content type analysis
        has_code = self._has_code_content(content, language)
        has_documentation = self._has_documentation_content(content)
        
        # Extract keywords
        keywords = self._extract_keywords(content)
        
        # Calculate quality scores
        quality_scores = self._calculate_quality_scores(content, code_elements, has_documentation)
        
        return {
            'language': language,
            'has_code': has_code,
            'has_documentation': has_documentation,
            'function_names': code_elements['functions'],
            'class_names': code_elements['classes'],
            'import_statements': code_elements['imports'],
            'keywords': keywords,
            **quality_scores
        }
    
    def _detect_language(self, content: str, file_extension: str) -> str:
        """Detect programming language from content and extension."""
        # Extension-based detection
        extension_map = {
            '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
            '.java': 'java', '.cpp': 'cpp', '.c': 'c', '.h': 'c',
            '.css': 'css', '.html': 'html', '.xml': 'xml',
            '.md': 'markdown', '.rst': 'rst', '.txt': 'text',
            '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
            '.sh': 'shell', '.bat': 'batch', '.go': 'go',
            '.rs': 'rust', '.rb': 'ruby', '.php': 'php', '.sql': 'sql'
        }
        
        if file_extension in extension_map:
            return extension_map[file_extension]
        
        # Pattern-based detection for unknown extensions
        patterns = {
            'python': [r'def\s+\w+', r'import\s+\w+', r'from\s+\w+\s+import', r'class\s+\w+'],
            'javascript': [r'function\s+\w+', r'const\s+\'\w+', r'let\s+\w+', r'var\s+\w+'],
            'java': [r'public\s+class', r'private\s+\w+', r'public\s+static'],
            'cpp': [r'#include', r'std::', r'namespace\s+\w+'],
            'css': [r'\.[\w-]+\s*{', r'#[\w-]+\s*{', r'@media'],
            'html': [r'<html>', r'<div>', r'<!DOCTYPE'],
            'markdown': [r'^#{1,6}\s', r'\[.*\]\(.*\)', r'```'],
        }
        
        for lang, lang_patterns in patterns.items():
            matches = sum(1 for pattern in lang_patterns if re.search(pattern, content, re.MULTILINE))
            if matches >= 2:
                return lang
        
        return 'unknown'
    
    def _extract_code_elements(self, content: str, language: str) -> Dict[str, List[str]]:
        """Extract functions, classes, and imports from code."""
        elements = {'functions': [], 'classes': [], 'imports': []}
        
        if language == 'python':
            elements['functions'] = list(set(re.findall(r'def\s+(\w+)', content)))
            elements['classes'] = list(set(re.findall(r'class\s+(\w+)', content)))
            elements['imports'] = list(set(re.findall(r'(?:from\s+[\w.]+\s+)?import\s+[\w.,\s*]+', content)))
            
        elif language == 'javascript':
            func_patterns = [
                r'function\s+(\w+)',
                r'(\w+)\s*=\s*function',
                r'const\s+(\w+)\s*=\s*\(',
                r'(\w+)\s*:\s*function'
            ]
            for pattern in func_patterns:
                elements['functions'].extend(re.findall(pattern, content))
            
            elements['classes'] = list(set(re.findall(r'class\s+(\w+)', content)))
            elements['imports'] = list(set(re.findall(r'import\s+.*?from\s+["\'].*?["\']', content)))
            
        elif language == 'java':
            elements['functions'] = list(set(re.findall(r'(?:public|private|protected)?\s*\w+\s+(\w+)\s*\(', content)))
            elements['classes'] = list(set(re.findall(r'(?:public\s+)?class\s+(\w+)', content)))
            elements['imports'] = list(set(re.findall(r'import\s+[\w.]+;', content)))
        
        # Remove duplicates and limit size
        for key in elements:
            elements[key] = list(set(elements[key]))[:20]  # Limit to 20 items
        
        return elements
    
    def _has_code_content(self, content: str, language: str) -> bool:
        """Determine if content contains code."""
        code_indicators = [
            r'def\s+\w+', r'function\s+\w+', r'class\s+\w+', r'import\s+\w+',
            r'#include', r'namespace\s+\w+', r'public\s+class', r'private\s+\w+',
            r'const\s+\w+\s*=', r'var\s+\w+\s*=', r'let\s+\w+\s*='
        ]
        
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in code_indicators)
    
    def _has_documentation_content(self, content: str) -> bool:
        """Determine if content contains documentation."""
        doc_indicators = [
            r'""".*?"""', r"'''.*?'''", r'/\*\*.*?\*/', r'##\s+\w+',
            r'###\s+\w+', r'#{1,6}\s+[A-Z]', r'@param', r'@return',
            r'@throws', r'TODO:', r'FIXME:', r'NOTE:'
        ]
        
        return any(re.search(pattern, content, re.DOTALL | re.IGNORECASE) for pattern in doc_indicators)
    
    def _extract_keywords(self, content: str) -> List[str]:
        """Extract relevant keywords from content."""
        # Remove code and markdown syntax
        cleaned_content = re.sub(r'```.*?```', '', content, flags=re.DOTALL)
        cleaned_content = re.sub(r'`[^`]+`', '', cleaned_content)
        cleaned_content = re.sub(r'[(){}\[\]<>]', ' ', cleaned_content)
        
        # Extract words
        words = re.findall(r'\b[a-zA-Z]{3,}\b', cleaned_content.lower())
        
        # Filter stopwords and common terms
        stopwords = {
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'had',
            'this', 'that', 'with', 'from', 'they', 'will', 'been', 'have', 'were',
            'said', 'each', 'which', 'their', 'time', 'would', 'about', 'into',
            'function', 'class', 'method', 'return', 'value', 'parameter', 'variable'
        }
        
        # Count word frequency
        word_freq = {}
        for word in words:
            if word not in stopwords and len(word) > 2:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Return top keywords
        keywords = sorted(word_freq.keys(), key=lambda x: word_freq[x], reverse=True)[:15]
        return keywords
    
    def _calculate_quality_scores(self, content: str, code_elements: Dict, has_documentation: bool) -> Dict[str, float]:
        """Calculate quality and information value scores."""
        # Content quality score based on structure and completeness
        quality_indicators = [
            len(content) > 100,  # Reasonable length
            '\n\n' in content,  # Paragraph structure
            any(marker in content for marker in ['#', '##', '###']),  # Headers
            has_documentation,  # Documentation present
            len(code_elements['functions']) > 0,  # Has functions
            len(re.findall(r'[.!?]', content)) > 2,  # Has sentences
        ]
        content_quality_score = sum(quality_indicators) / len(quality_indicators)
        
        # Semantic density based on unique concepts
        unique_words = len(set(re.findall(r'\b\w{3,}\b', content.lower())))
        total_words = len(re.findall(r'\b\w+\b', content))
        semantic_density = (unique_words / total_words) if total_words > 0 else 0
        
        # Information value based on content richness
        info_indicators = [
            len(code_elements['functions']),
            len(code_elements['classes']),
            len(re.findall(r'https?://[^\s]+', content)),  # External references
            len(re.findall(r'[A-Z][a-z]+(?:[A-Z][a-z]+)*', content)),  # CamelCase terms
            content.count('```'),  # Code blocks
        ]
        max_info_value = sum([10, 5, 5, 20, 10])  # Maximum possible values
        actual_info_value = sum([min(val, max_val) for val, max_val in zip(info_indicators, [10, 5, 5, 20, 10])])
        information_value_score = actual_info_value / max_info_value
        
        return {
            'content_quality_score': float(content_quality_score),
            'semantic_density_score': float(min(semantic_density * 2, 1.0)),  # Scale to 0-1
            'information_value_score': float(information_value_score)
        }
    
    def process_file(self, file_info: Dict[str, Any], repo_owner: str, 
                    repo_name: str, branch: str) -> List[Dict[str, Any]]:
        """
        Process a single file: fetch content, chunk semantically, and extract metadata.
        
        Args:
            file_info: File information dictionary
            repo_owner: Repository owner
            repo_name: Repository name
            branch: Repository branch
            
        Returns:
            List of chunk metadata dictionaries
        """
        logger.info(f"[PROCESS] Starting file processing: {file_info['path']}")
        
        # Fetch file content
        logger.info(f"[PROCESS] Fetching content for: {file_info['name']}")
        content = self.fetch_file_content(file_info)
        if not content or len(content.strip()) < 50:
            logger.warning(f"[PROCESS] Skipping {file_info['path']}: content too short or empty (length: {len(content) if content else 0})")
            return []
        
        logger.info(f"[PROCESS] Content fetched successfully, size: {len(content)} characters")
        
        # Extract images and links
        logger.info(f"[PROCESS] Extracting images and links...")
        base_url = f"https://github.com/{repo_owner}/{repo_name}/blob/{branch}/"
        image_links, attachment_links, external_links = self.extract_images_and_links(content, base_url)
        logger.info(f"[PROCESS] Found {len(image_links)} images, {len(attachment_links)} attachments, {len(external_links)} external links")
        
        # Analyze content
        logger.info(f"[PROCESS] Analyzing content for language and quality metrics...")
        content_analysis = self.analyze_content(content, file_info)
        logger.info(f"[PROCESS] Content analysis complete - Language: {content_analysis['language']}, Has code: {content_analysis['has_code']}")
        
        # Perform semantic chunking
        logger.info(f"[PROCESS] Performing semantic chunking...")
        chunks = self.semantic_chunk_content(content, file_info)
        logger.info(f"[PROCESS] Generated {len(chunks)} initial chunks")
        
        # Create metadata for each chunk
        chunk_metadata_list = []
        for i, chunk in enumerate(chunks):
            if len(chunk.strip()) < 30:  # Skip very small chunks
                continue
            
            # Determine which images/attachments are relevant to this chunk
            chunk_images = []
            chunk_attachments = []
            
            # Simple heuristic: if image/attachment reference is in chunk, it's relevant
            for img_link in image_links:
                img_name = Path(img_link).name.lower()
                if img_name in chunk.lower() or any(part in chunk.lower() for part in img_name.split('.')):
                    chunk_images.append(img_link)
            
            for att_link in attachment_links:
                att_name = Path(att_link).name.lower()
                if att_name in chunk.lower():
                    chunk_attachments.append(att_link)
            
            # Create metadata matching 14-field schema
            chunk_metadata = {
                'id': str(uuid.uuid4()),
                'document': chunk,
                'file_name': file_info['name'],
                'file_path': file_info['path'],
                'file_type': file_info['extension'],
                'source_link': file_info['source_link'],
                'chunk_index': i,
                'language': content_analysis['language'],
                'has_code': content_analysis['has_code'],
                'repo_name': repo_name,
                'content_quality_score': content_analysis['content_quality_score'],
                'semantic_density_score': content_analysis['semantic_density_score'],
                'information_value_score': content_analysis['information_value_score'],
            }
            
            chunk_metadata_list.append(chunk_metadata)
        
        logger.info(f"[PROCESS COMPLETE] Created {len(chunk_metadata_list)} valid chunks for {file_info['name']}")
        logger.info(f"[PROCESS STATS] Quality score: {content_analysis['content_quality_score']:.3f}, Semantic density: {content_analysis['semantic_density_score']:.3f}")
        return chunk_metadata_list
    
    def generate_embeddings_batch(self, chunks: List[str], batch_size: int = 64) -> List[List[float]]:
        """Generate embeddings for chunks in batches using ONNX model."""
        logger.info(f"[EMBEDDINGS] Starting embedding generation for {len(chunks)} chunks")
        logger.info(f"[EMBEDDINGS] Using batch size: {batch_size}")
        
        all_embeddings = []
        total_batches = (len(chunks) + batch_size - 1) // batch_size
        
        for i in range(0, len(chunks), batch_size):
            batch_num = (i // batch_size) + 1
            batch = chunks[i:i + batch_size]
            batch_embeddings = []
            
            logger.info(f"[EMBEDDINGS] Processing batch {batch_num}/{total_batches} ({len(batch)} chunks)")
            
            for j, chunk in enumerate(batch):
                try:
                    embedding = self._encode_text(chunk)
                    batch_embeddings.append(embedding)
                except Exception as e:
                    logger.warning(f"[EMBEDDINGS] Failed to generate embedding for chunk {i+j+1}: {e}")
                    # Add zero vector as placeholder
                    sample_embedding = self._encode_text("test")
                    batch_embeddings.append([0.0] * len(sample_embedding))
            
            all_embeddings.extend(batch_embeddings)
            
            # Log progress every 5 batches or for the last batch
            if batch_num % 5 == 0 or batch_num == total_batches:
                completed_chunks = min(i + batch_size, len(chunks))
                progress_pct = (completed_chunks / len(chunks)) * 100
                logger.info(f"[EMBEDDINGS PROGRESS] Completed {completed_chunks}/{len(chunks)} chunks ({progress_pct:.1f}%)")
        
        logger.info(f"[EMBEDDINGS COMPLETE] Generated {len(all_embeddings)} embeddings successfully")
        return all_embeddings
    
    def store_chunks_batch(self, chunk_metadata_list: List[Dict[str, Any]], 
                          embeddings: List[List[float]], batch_size: int = 100):
        """Store chunks and embeddings in Milvus."""
        logger.info(f"[STORAGE] Starting storage of {len(chunk_metadata_list)} chunks in Milvus")
        logger.info(f"[STORAGE] Using batch size: {batch_size}")
        
        total_batches = (len(chunk_metadata_list) + batch_size - 1) // batch_size
        
        for i in range(0, len(chunk_metadata_list), batch_size):
            batch_num = (i // batch_size) + 1
            end_idx = min(i + batch_size, len(chunk_metadata_list))
            batch_metadata = chunk_metadata_list[i:end_idx]
            batch_embeddings = embeddings[i:end_idx]
            
            logger.info(f"[STORAGE] Processing batch {batch_num}/{total_batches} ({len(batch_metadata)} chunks)")
            
            # Prepare insert data (14 fields matching retrieval service schema)
            insert_data = [
                [item['id'] for item in batch_metadata],
                [item['document'][:65535] for item in batch_metadata],
                batch_embeddings,
                [item['file_name'][:500] for item in batch_metadata],
                [item['file_path'][:1000] for item in batch_metadata],
                [item['file_type'][:50] for item in batch_metadata],
                [item['source_link'][:2000] for item in batch_metadata],
                [item['chunk_index'] for item in batch_metadata],
                [item['language'][:50] for item in batch_metadata],
                [item['has_code'] for item in batch_metadata],
                [item['repo_name'][:200] for item in batch_metadata],
                [item['content_quality_score'] for item in batch_metadata],
                [item['semantic_density_score'] for item in batch_metadata],
                [item['information_value_score'] for item in batch_metadata],
            ]
            
            try:
                self.collection.insert(insert_data)
                self.collection.flush()
                logger.info(f"[STORAGE] Batch {batch_num}/{total_batches} stored successfully")
            except Exception as e:
                logger.error(f"[STORAGE ERROR] Failed to store batch {batch_num}/{total_batches}: {e}")
                raise
            
        logger.info(f"[STORAGE COMPLETE] All {len(chunk_metadata_list)} chunks stored successfully in collection '{self.collection_name}'")
    
    def ingest_repository(self, repo_url: str, branch: str = "main", 
                         max_workers: int = 8) -> Dict[str, Any]:
        """
        Complete repository ingestion pipeline.
        
        Args:
            repo_url: GitHub repository URL
            branch: Branch to ingest
            max_workers: Number of parallel workers
            
        Returns:
            Ingestion results dictionary
        """
        start_time = time.time()
        logger.info(f"[INGESTION START] Repository: {repo_url}, Branch: {branch}")
        
        # Parse repository URL
        repo_match = re.match(r'https://github\.com/([^/]+)/([^/]+)/?', repo_url.rstrip('/'))
        if not repo_match:
            logger.error(f"[INGESTION ERROR] Invalid GitHub repository URL: {repo_url}")
            raise ValueError(f"Invalid GitHub repository URL: {repo_url}")
        
        repo_owner, repo_name = repo_match.groups()
        logger.info(f"[INGESTION] Repository owner: {repo_owner}, name: {repo_name}")
        
        try:
            # Step 1: Fetch repository tree
            logger.info("[STEP 1/4] Fetching repository tree...")
            step_start = time.time()
            files = self.fetch_repository_tree(repo_owner, repo_name, branch)
            tree_time = time.time() - step_start
            logger.info(f"[STEP 1 COMPLETE] Repository tree fetched in {tree_time:.2f}s ({len(files)} files)")
            
            # Step 2: Process files in parallel
            logger.info(f"[STEP 2/4] Processing {len(files)} files in parallel (max workers: {max_workers})...")
            step_start = time.time()
            all_chunk_metadata = []
            processed_files = 0
            
            def process_single_file(file_info):
                return self.process_file(file_info, repo_owner, repo_name, branch)
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_file = {executor.submit(process_single_file, file_info): file_info for file_info in files}
                
                for future in concurrent.futures.as_completed(future_to_file):
                    try:
                        chunk_metadata = future.result()
                        all_chunk_metadata.extend(chunk_metadata)
                        processed_files += 1
                        
                        # Log progress every 10 files
                        if processed_files % 10 == 0 or processed_files == len(files):
                            progress_pct = (processed_files / len(files)) * 100
                            logger.info(f"[PROCESSING PROGRESS] {processed_files}/{len(files)} files processed ({progress_pct:.1f}%) - {len(all_chunk_metadata)} chunks generated so far")
                    except Exception as e:
                        file_info = future_to_file[future]
                        logger.error(f"[PROCESSING ERROR] Error processing {file_info['path']}: {e}")
            
            processing_time = time.time() - step_start
            logger.info(f"[STEP 2 COMPLETE] File processing completed in {processing_time:.2f}s ({len(all_chunk_metadata)} chunks generated)")
            
            if not all_chunk_metadata:
                logger.warning("[INGESTION WARNING] No chunks generated from repository")
                return {'success': False, 'message': 'No processable content found'}
            
            # Step 3: Generate embeddings
            logger.info(f"[STEP 3/4] Generating embeddings for {len(all_chunk_metadata)} chunks...")
            step_start = time.time()
            chunks = [item['document'] for item in all_chunk_metadata]
            embeddings = self.generate_embeddings_batch(chunks)
            embedding_time = time.time() - step_start
            logger.info(f"[STEP 3 COMPLETE] Embeddings generated in {embedding_time:.2f}s")
            
            # Step 4: Store in Milvus
            logger.info(f"[STEP 4/4] Storing {len(all_chunk_metadata)} chunks in Milvus collection '{self.collection_name}'...")
            step_start = time.time()
            self.store_chunks_batch(all_chunk_metadata, embeddings)
            storage_time = time.time() - step_start
            logger.info(f"[STEP 4 COMPLETE] Data stored in Milvus in {storage_time:.2f}s")
            
            # Summary
            total_time = time.time() - start_time
            
            # Calculate statistics
            files_with_code = sum(1 for item in all_chunk_metadata if item.get('has_code', False))
            avg_quality = sum(item['content_quality_score'] for item in all_chunk_metadata) / len(all_chunk_metadata)
            
            logger.info("=" * 80)
            logger.info("REPOSITORY INGESTION COMPLETE")
            logger.info("=" * 80)
            logger.info(f"Repository: {repo_owner}/{repo_name} (branch: {branch})")
            logger.info(f"Collection: {self.collection_name}")
            logger.info(f"Total Time: {total_time:.2f}s")
            logger.info("")
            logger.info("Processing Breakdown:")
            logger.info(f"  Repository Tree: {tree_time:.2f}s")
            logger.info(f"  File Processing: {processing_time:.2f}s")
            logger.info(f"  Embedding Generation: {embedding_time:.2f}s")
            logger.info(f"  Milvus Storage: {storage_time:.2f}s")
            logger.info("")
            logger.info("Results:")
            logger.info(f"  Files Processed: {len(files):,}")
            logger.info(f"  Chunks Generated: {len(all_chunk_metadata):,}")
            logger.info(f"  Files with Code: {files_with_code:,}")
            logger.info(f"  Average Quality Score: {avg_quality:.3f}")
            logger.info(f"  Processing Rate: {len(all_chunk_metadata)/total_time:.1f} chunks/sec")
            logger.info("=" * 80)
            
            return {
                'success': True,
                'total_time': total_time,
                'files_processed': len(files),
                'chunks_generated': len(all_chunk_metadata),
                'files_with_code': files_with_code,
                'avg_quality_score': avg_quality
            }
            
        except Exception as e:
            logger.error(f"[INGESTION ERROR] Critical error during repository ingestion: {e}")
            logger.error(f"[INGESTION ERROR] Repository: {repo_owner}/{repo_name}")
            raise


def main():
    """Main function for command-line interface."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Direct GitHub repository ingestion with semantic chunking',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Ingest repository with default settings
  python github_direct_ingester.py https://github.com/beagleboard/docs.beagleboard.io
  
  # Ingest specific branch with GitHub token
  python github_direct_ingester.py https://github.com/owner/repo --branch develop --github-token YOUR_TOKEN
  
  # Use custom collection and model
  python github_direct_ingester.py https://github.com/owner/repo --collection my_collection --model sentence-transformers/all-MiniLM-L6-v2
        """
    )
    
    parser.add_argument('repo_url', help='GitHub repository URL')
    parser.add_argument('--branch', default='main', help='Repository branch to ingest')
    parser.add_argument('--collection', default='beaglemind_col', help='Milvus collection name')
    parser.add_argument('--model', default='BAAI/bge-base-en-v1.5', help='Embedding model name')
    parser.add_argument('--github-token', help='GitHub API token for higher rate limits')
    parser.add_argument('--max-workers', type=int, default=8, help='Number of parallel workers')
    
    args = parser.parse_args()
    
    try:
        # Initialize ingester
        ingester = GitHubDirectIngester(
            collection_name=args.collection,
            model_name=args.model,
            github_token=args.github_token
        )
        
        # Ingest repository
        result = ingester.ingest_repository(
            args.repo_url,
            args.branch,
            args.max_workers
        )
        
        if result['success']:
            print(f"\n✅ Ingestion completed successfully!")
            print(f"You can now search the collection '{args.collection}' using the search tool.")
        else:
            print(f"\n❌ Ingestion failed: {result.get('message', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()