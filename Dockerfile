# ─── Stage 1: Frontend Build ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Python Backend + Static Serving ────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# 시스템 패키지 최소화
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 백엔드 의존성 설치
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# 백엔드 소스 복사
COPY backend/ ./backend/
COPY samples/ ./samples/

# 프론트엔드 빌드 산출물 복사 (FastAPI로 정적 파일 서빙)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 정적 파일 서빙을 위해 main.py에서 StaticFiles 마운트
# (프로덕션에서는 FastAPI가 /app/frontend/dist 를 서빙)
ENV PYTHONPATH=/app
ENV STATIC_DIR=/app/frontend/dist

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
