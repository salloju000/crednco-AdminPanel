# ── Stage 1: dependency builder ───────────────────────────────────────────────
# Separate builder stage so the final image doesn't carry pip/build-essential.
FROM python:3.12-slim AS builder

# build-essential needed for wheels that have C extensions (e.g. cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only requirements first — maximises Docker layer cache.
# Rebuilds only when requirements change, not on every code change.
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: production image ─────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Prevent .pyc files and enable unbuffered stdout (better for JSON log streaming)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001

WORKDIR /app

# Copy installed packages from builder — no pip, no build tools in final image
COPY --from=builder /install /usr/local

# Copy application source (everything needed at runtime)
COPY main.py             .
COPY admin_security.py   .
COPY records.py          .
COPY user_stats.py       .
COPY firestore_client.py .
COPY firebase_init.py    .
COPY limiter_config.py   .
COPY logging_config.py   .

# ── Security: run as non-root user ────────────────────────────────────────────
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Expose the port uvicorn will listen on
EXPOSE ${PORT}

# ── Docker HEALTHCHECK ────────────────────────────────────────────────────────
# Calls /health every 30s; 3 failures = unhealthy; 30s grace period on start.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c \
    "import urllib.request, sys; \
    r = urllib.request.urlopen('http://localhost:${PORT}/health', timeout=8); \
    sys.exit(0 if r.status == 200 else 1)"

# ── Start server ──────────────────────────────────────────────────────────────
CMD ["sh", "-c", \
    "uvicorn main:app \
    --host 0.0.0.0 \
    --port ${PORT} \
    --workers 1 \
    --proxy-headers \
    --forwarded-allow-ips='*' \
    --log-level info"]
