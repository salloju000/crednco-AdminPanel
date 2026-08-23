"""
main.py — FastAPI backend for Crednco (admin panel).

# cspell:ignore redoc Referer referer

Run with:
    uvicorn main:app --port 8001

    # Development with auto-reload:
    uvicorn main:app --reload --port 8001

Environment variables:
    ALLOWED_ORIGINS               Comma-separated CORS origins (default: localhost dev servers)
    FIREBASE_SERVICE_ACCOUNT_PATH Path to Firebase service account JSON file
    LOG_LEVEL                     Logging level: DEBUG | INFO | WARNING | ERROR (default: INFO)
    PORT                          Port to listen on when run directly (default: 8001)
    RELOAD                        Set to "true" to enable uvicorn auto-reload (default: false)
    JWT_SECRET, ADMIN_API_KEY     Required by admin_security.py outside ENV=development

API Docs (auto-generated):
    http://localhost:8001/docs      ← Swagger UI
    http://localhost:8001/redoc     ← ReDoc

This backend serves the admin panel only. Main-app routes (/predict, /apply,
/user/*) live in the separate crednco-app backend, which reads/writes the
same Firestore project. See firestore_client.py for the shared client
factory.

Route paths are unchanged from the original combined backend (/login,
/create-user, /reset-2fa, /admin, /admin/*) — there is no longer a second
route group sharing this origin, so the previously-noted unprefixed mounting
of the auth routes is not a namespacing problem and was intentionally left
as-is rather than renamed, to avoid an unnecessary API-contract change.
"""

from __future__ import annotations
# ── Load .env before any os.getenv() calls ────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

import logging
import os
import re as _re
import time
import uuid
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from limiter_config import limiter
from logging_config import setup_logging
from firebase_init import initialize_firebase

from records import (
    fetch_recent_searches, update_search_status,
    fetch_recent_applications, update_application_status,
)
from user_stats import fetch_registered_user_stats
from admin_security import require_admin_user, router as admin_security_router

# ── Logging ───────────────────────────────────────────────────────────────────
setup_logging(os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
    "https://credncoadminpanel.vercel.app",
]
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", ",".join(_DEFAULT_ORIGINS)).split(",")
    if o.strip()
]

# ── CSRF origin helpers ───────────────────────────────────────────────────────

def _normalize_origin(url: str) -> str:
    """
    Extract the scheme+host from a URL or origin string.

    Examples:
        "http://localhost:3000"            → "http://localhost:3000"
        "https://app.example.com/foo/bar"  → "https://app.example.com"
        "http://localhost:3000.evil.com"   → "http://localhost:3000.evil.com"
    """
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _build_csrf_regex(origins: list[str]) -> _re.Pattern:
    escaped_origins = [_re.escape(o) for o in origins]
    dev_patterns = [r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?"]
    combined = "|".join(escaped_origins + dev_patterns)
    return _re.compile(f"^({combined})$")  # exact match — no trailing /? needed
                                           # after normalization strips any path

_CSRF_ORIGIN_REGEX = _build_csrf_regex(ALLOWED_ORIGINS)

API_VERSION = "1.0.0"


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate Firebase on startup; log on shutdown."""
    # ── Firebase early-init check ─────────────────────────────────────────────
    # Fail fast rather than discovering a misconfigured Firebase on the first
    # real request. This backend doesn't verify Firebase ID tokens (admin auth
    # is JWT/TOTP via admin_security.py), but Firestore access (records.py,
    # user_stats.py → firestore_client.get_db()) needs a Firebase Admin app.
    try:
        initialize_firebase()
        logger.info("Firebase initialised successfully.")
    except RuntimeError as exc:
        # In development this is expected when no credentials are provided.
        logger.warning("Firebase not initialised at startup: %s", exc)
    except Exception as exc:  # noqa: BLE001
        logger.error("Unexpected error initialising Firebase: %s", exc)

    yield

    logger.info("Shutting down Crednco Admin API v%s", API_VERSION)


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Crednco Admin API",
    description="Admin dashboard API for Crednco — search/application review and approval.",
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate limiter wiring ───────────────────────────────────────────────────────
# Both lines are required for SlowAPI to function:
#   app.state.limiter  — makes the limiter instance accessible to the decorator
#   SlowAPIMiddleware  — intercepts requests and enforces limits
# Missing either one causes rate limiting to silently do nothing.
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# ── Middleware ────────────────────────────────────────────────────────────────

# 1. Trusted Host (protection against Host Header Injection)
# ⚠️  On Render, the host is managed by the platform. We allow all hosts ["*"]
#     to ensure connectivity while letting Render's proxy handle validation.
ALLOWED_HOSTS = ["*"]

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=ALLOWED_HOSTS,
)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_security_router, tags=["Admin Security"])


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add standard security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    return response


@app.middleware("http")
async def add_correlation_id_and_log(request: Request, call_next):
    """
    1. Generate or propagate a Correlation ID.
    2. Attach it to request.state for downstream access.
    3. Add it to the response header.
    4. Log the final status code and duration.
    """
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    request.state.correlation_id = correlation_id

    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1_000, 2)

    response.headers["X-Correlation-ID"] = correlation_id

    logger.info(
        "Request processed",
        extra={
            "correlation_id": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": elapsed_ms,
            "client_ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
        },
    )
    return response


@app.middleware("http")
async def csrf_protection_middleware(request: Request, call_next):
    """
    Enforce Origin/Referer checks on state-changing requests from browsers.

    Why we skip Bearer-authenticated requests:
        CSRF attacks exploit the browser's automatic cookie attachment. An
        Authorization: Bearer header cannot be set by a cross-origin page
        (blocked by CORS preflight), so any request carrying a valid Bearer
        token is already CSRF-proof by construction. Applying Origin/Referer
        checks on top would reject legitimate non-browser clients (mobile apps,
        Postman, curl, server-to-server calls) that never send those headers.

    Why we still check requests without a Bearer token:
        Unauthenticated state-changing endpoints (e.g. /login, /create-user)
        could be vulnerable to CSRF via cookies, so the check is preserved
        as a defence-in-depth layer for that case.
    """
    if request.method in ("GET", "HEAD", "OPTIONS", "TRACE"):
        return await call_next(request)

    # Bearer-authenticated requests are CSRF-safe — skip origin check.
    if request.headers.get("Authorization", "").startswith("Bearer "):
        return await call_next(request)

    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    source = origin or referer

    if not source:
        logger.warning(
            "CSRF block: missing Origin/Referer on unauthenticated request",
            extra={
                "correlation_id": getattr(request.state, "correlation_id", "unknown")
            },
        )
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "CSRF protection: missing Origin or Referer header"},
        )

    # Normalize to scheme://host before comparison to prevent prefix-matching
    # attacks such as http://localhost:3000.evil.com passing a startswith check.
    origin_clean = _normalize_origin(origin if origin else source)

    is_allowed = (
        origin_clean in ALLOWED_ORIGINS
        or bool(_CSRF_ORIGIN_REGEX.match(origin_clean))
    )

    if not is_allowed:
        logger.warning(
            "CSRF block: untrusted source '%s'",
            source,
            extra={
                "correlation_id": getattr(request.state, "correlation_id", "unknown"),
                "source": source,
            },
        )
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": f"CSRF protection: source '{source}' is not trusted"},
        )

    return await call_next(request)


# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all — prevents raw tracebacks from leaking to clients."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# ── Health endpoints ──────────────────────────────────────────────────────────

@app.get("/", tags=["Health"], include_in_schema=False)
async def root():
    return {
        "service": "Crednco Admin API",
        "version": API_VERSION,
        "status": "ok",
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="Service health check",
)
async def health():
    return JSONResponse(
        content={"status": "ok", "version": API_VERSION},
        status_code=status.HTTP_200_OK,
    )


# ── Admin Endpoints ───────────────────────────────────────────────────────────

@app.get(
    "/admin/searches",
    tags=["Admin"],
    summary="Get recent search history (Admin only)",
)
@limiter.limit("30/minute")
async def get_admin_searches(request: Request, admin_user_id: str = Depends(require_admin_user)):
    """
    Retrieve recent search records from Firestore.
    Protected by Admin Auth JWT header.
    """
    return fetch_recent_searches(limit=100)

@app.get(
    "/admin/applications",
    tags=["Admin"],
    summary="Get recent formalized applications (Admin only)",
)
@limiter.limit("30/minute")
async def get_admin_applications(request: Request, admin_user_id: str = Depends(require_admin_user)):
    return fetch_recent_applications(limit=100)

@app.get(
    "/admin/user-stats",
    tags=["Admin"],
    summary="Get registered user stats (Admin only)",
)
@limiter.limit("30/minute")
async def get_admin_user_stats(request: Request, admin_user_id: str = Depends(require_admin_user)):
    return fetch_registered_user_stats()

@app.post(
    "/admin/applications/{record_id}/{action}",
    tags=["Admin"],
    summary="Update approval status of a formalized application (Admin only)",
)
@limiter.limit("20/minute")
async def update_application_record_status(
    request: Request, record_id: str, action: str, admin_user_id: str = Depends(require_admin_user)
):
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")

    approved = (action == "approve")
    success = update_application_status(record_id, approved)

    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update application status")

    return {"status": "success", "approved": approved}


@app.post(
    "/admin/searches/{record_id}/{action}",
    tags=["Admin"],
    summary="Update approval status of a search record (Admin only)",
)
@limiter.limit("20/minute")
async def update_search_record_status(
    request: Request, record_id: str, action: str, admin_user_id: str = Depends(require_admin_user)
):
    """
    Approve or reject a loan application.
    Protected by Admin Auth JWT header.
    """
    if action not in ["approve", "reject"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action",
        )

    approved = (action == "approve")
    success = update_search_status(record_id, approved)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update record status",
        )

    return {"status": "success", "approved": approved}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",  # noqa: S104
        port=int(os.getenv("PORT", "8001")),
        reload=os.getenv("RELOAD", "false").lower() == "true",
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
