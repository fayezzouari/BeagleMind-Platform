FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Make pip installs more resilient to slow networks/timeouts
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=180

COPY requirements.txt .
# Upgrade pip tooling first, then install deps with extended timeout
RUN python -m pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --default-timeout=300 --retries 5 --timeout 300 -r requirements.txt

COPY . .

# API only. Milvus must run separately (see README)
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
