# Single-image build for cloud hosting (Railway/Render/Fly/etc.).
#
# Unlike docker-compose.yml (two services + a shared volume, for local dev),
# this builds the SPA and bakes it into one Python image that serves both the
# API and the static frontend on a single port. Railway injects $PORT.
#
#   docker build -t renshu .
#   docker run -p 8000:8000 -e APP_PASSWORD=secret -e APP_SECRET=... \
#     -e APP_COOKIE_SECURE=false -v $PWD/data:/data renshu

# --- Stage 1: build the React SPA -----------------------------------------
FROM node:20-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* /app/
RUN npm install
COPY frontend /app
RUN npm run build

# --- Stage 2: Python backend that serves the API + built SPA ---------------
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY renshuu_client.py /app/renshuu_client.py
COPY backend /app/backend
COPY --from=frontend /app/dist /app/frontend/dist

ENV RENSHU_DB_PATH=/data/renshuu_progress.db \
    RENSHU_FRONTEND_DIST=/app/frontend/dist

WORKDIR /app/backend
EXPOSE 8000
# Shell form so $PORT (set by Railway) expands; falls back to 8000 locally.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
