import logging
import os
from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel
import pyotp
import qrcode
import base64
from io import BytesIO
from jose import jwt
from datetime import datetime, timedelta

from firestore_client import get_db
from limiter_config import limiter

logger = logging.getLogger(__name__)

# Use APIRouter instead of FastAPI() to easily integrate with the main app
router = APIRouter()

# ── Secret loading ────────────────────────────────────────────────────────────
# Mirrors auth.py's ENV-aware policy: anything other than explicit
# ENV=development is treated as production, so a missing secret is a hard
# startup failure rather than a silently-guessable default.
_ENV: str = os.getenv("ENV", "production").lower().strip()
_IS_DEVELOPMENT: bool = _ENV == "development"


def _require_secret(env_var: str, dev_fallback: str) -> str:
    value = os.getenv(env_var)
    if value:
        return value
    if _IS_DEVELOPMENT:
        logger.warning(
            "%s is not set — using an insecure development-only default "
            "(ENV=development). This value must never be used in production.",
            env_var,
        )
        return dev_fallback
    raise RuntimeError(
        f"{env_var} environment variable is not set. Refusing to start with a "
        f"guessable default outside ENV=development (current ENV={_ENV!r})."
    )


JWT_SECRET = _require_secret("JWT_SECRET", "dev-only-insecure-jwt-secret")
ALGORITHM = "HS256"
ADMIN_API_KEY = _require_secret("ADMIN_API_KEY", "dev-only-insecure-admin-api-key")

# -----------------------
# Models
# -----------------------
class CreateUser(BaseModel):
    user_id: str

class LoginRequest(BaseModel):
    user_id: str
    password: str


class ResetRequest(BaseModel):
    user_id: str

# -----------------------
# Helper
# -----------------------
def get_user_secret(user_id: str) -> str | None:
    db = get_db()
    if not db:
        return None
    doc = db.collection("admin_users").document(user_id).get()
    if doc.exists:
        return doc.to_dict().get("secret")
    return None

# -----------------------
# STEP 1: Create User
# -----------------------
@router.post("/create-user")
def create_user(data: CreateUser):
    secret = get_user_secret(data.user_id)
    if secret:
        raise HTTPException(status_code=400, detail="User already exists")

    new_secret = pyotp.random_base32()
    
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    db.collection("admin_users").document(data.user_id).set({
        "secret": new_secret,
        "created_at": datetime.utcnow()
    })

    totp = pyotp.TOTP(new_secret)
    uri = totp.provisioning_uri(name=data.user_id, issuer_name="CredncoAdmin")

    # Generate QR
    img = qrcode.make(uri)
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()

    return {
        "message": "Scan QR with Authenticator",
        "qr_code_base64": qr_base64
    }

# -----------------------
# STEP 2: Login with OTP
# -----------------------
@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest):
    secret = get_user_secret(data.user_id)
    if not secret:
        raise HTTPException(status_code=400, detail="User not found")

    totp = pyotp.TOTP(secret)

    if not totp.verify(data.password, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid OTP")

    # Create JWT token
    payload = {
        "sub": data.user_id,
        "exp": datetime.utcnow() + timedelta(minutes=60)
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)

    return {
        "message": "Login successful",
        "access_token": token
    }

# -----------------------
# STEP 3: Reset 2FA
# -----------------------
@router.post("/reset-2fa")
@limiter.limit("3/minute")
def reset_2fa(request: Request, data: ResetRequest):
    api_key = request.headers.get("X-Admin-API-Key")
    if api_key != ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized reset access")

    secret = get_user_secret(data.user_id)
    if not secret:
        raise HTTPException(status_code=400, detail="User not found")

    new_secret = pyotp.random_base32()
    
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    db.collection("admin_users").document(data.user_id).update({
        "secret": new_secret,
        "updated_at": datetime.utcnow()
    })

    totp = pyotp.TOTP(new_secret)
    uri = totp.provisioning_uri(name=data.user_id, issuer_name="CredncoAdmin")

    img = qrcode.make(uri)
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()

    return {
        "message": "2FA Reset successful. Scan new QR with Authenticator",
        "qr_code_base64": qr_base64
    }

# -----------------------
# Token verification
# -----------------------
def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload["sub"]
    except:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_admin_user(request: Request) -> str:
    """
    FastAPI dependency for /admin/* routes: extracts the Bearer token from the
    Authorization header, verifies it, and returns the JWT subject (user_id).

    Raises HTTPException 401 if the header is missing/malformed or the token
    is invalid — identical behavior to the auth check every /admin/* route
    used to duplicate inline.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")
    token = auth_header.split(" ")[1]
    return verify_token(token)

@router.get("/admin")
def admin_dashboard(token: str):
    user_id = verify_token(token)
    return {"message": f"Welcome {user_id} to admin panel"}
