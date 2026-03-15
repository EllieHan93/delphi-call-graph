"""FastAPI application entry point for the Delphi Call Graph Analyzer."""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Delphi Call Graph Analyzer",
    description="Delphi 프로젝트의 정적 콜 그래프를 분석하는 REST API",
    version="1.0.0",
)

# CORS: allow frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):  # type: ignore[type-arg]
    """모든 HTTP 요청/응답을 로깅하는 미들웨어."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s → %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("처리되지 않은 예외: %s %s — %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)},
    )


app.include_router(router)


@app.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    """서버 상태 확인."""
    return {"status": "ok", "service": "delphi-call-graph-analyzer"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
