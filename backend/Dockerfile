FROM python:3.12-slim

WORKDIR /app

# Install backend deps first (better layer caching).
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy the shared client (repo root) and the backend package.
COPY renshuu_client.py /app/renshuu_client.py
COPY backend /app/backend

# Frontend build is mounted/copied to /app/frontend/dist at deploy time
# (docker-compose builds the frontend and shares the dist via a volume).
ENV RENSHU_DB_PATH=/data/renshuu_progress.db \
    RENSHU_FRONTEND_DIST=/app/frontend/dist

WORKDIR /app/backend
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
