# BeagleMind Platform

A two-service platform that provides:
- Backend API (FastAPI) for retrieval and ingestion over Milvus
- Frontend (Next.js) chat UI grounded on the knowledge base
- Milvus, MinIO, and etcd via Docker Compose

## Quick Start

1) Configure OpenAI API key for the chatbot
- Create `beaglemind-frontend/.env.local` with:
```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

2) Bring up the stack (first build)
- In the project root:
```
docker compose up --build -d
```

That’s it. The frontend runs at http://localhost:3000 and the API is exposed at https://mind-api.beagleboard.org (inside Docker it is reachable as http://beaglemind-api:8000).

## What happens on API startup
On first start, the API triggers two background tasks automatically (one-time per container start):
- Calls `POST /api/ingest-data` with the body:
```
{
  "github_url": "https://github.com/beagleboard/docs.beagleboard.io",
  "collection_name": "beagleboard"
}
```
- Runs the forum ingestor script using `beaglemind-api/data/scraped_threads_complete.json`, also targeting the `beagleboard` collection.

Both write into the same Milvus collection: `beagleboard`.

## Environment notes
- Frontend expects:
  - `OPENAI_API_KEY` (from `.env.local`)
  - It talks to the API at `http://beaglemind-api:8000` within Docker. Outside Docker, the chat route defaults to `https://mind-api.beagleboard.org` unless `KNOWLEDGE_BASE_URL` is overridden.
- Backend uses ONNX models shipped in `beaglemind-api/onnx` (mounted read-only).

## Services
- Milvus Standalone (vector DB)
- MinIO (object storage)
- etcd (Milvus metadata)
- beaglemind-api (FastAPI)
- beaglemind-frontend (Next.js)

## Troubleshooting
- If ingestion seems slow, check API logs:
```
docker logs -f beaglemind-api
```
- To rebuild after changes:
```
docker compose build --no-cache && docker compose up -d
```
- If the forum JSON isn’t present, the API logs will note skipping forum ingestion.
