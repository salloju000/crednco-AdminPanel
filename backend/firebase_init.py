"""
firebase_init.py — Firebase Admin SDK initialisation for the admin backend.

Extracted from the monorepo's auth.py, keeping only the initialisation logic
this backend needs so get_db() (firestore_client.py) has a Firebase Admin
app to attach to. The admin backend does not verify Firebase ID tokens —
admin authentication is entirely separate (admin_security.py's JWT/TOTP
scheme) — so verify_firebase_token()/get_current_user() from the original
auth.py are intentionally not duplicated here.

Environment variables:
    FIREBASE_PROJECT_ID             }
    FIREBASE_PRIVATE_KEY            } Option 1: individual vars (production)
    FIREBASE_CLIENT_EMAIL           }
    FIREBASE_SERVICE_ACCOUNT_JSON   Option 2: full JSON string
    FIREBASE_SERVICE_ACCOUNT_PATH   Option 3: path to JSON file (local dev)

Usage (in main.py):
    from firebase_init import initialize_firebase

    # In lifespan — early failure detection:
    initialize_firebase()
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials

logger = logging.getLogger(__name__)


# ── Firebase Admin initialisation (once per process) ─────────────────────────
# We use an explicit sentinel rather than lru_cache because lru_cache does not
# cache exceptions — a RuntimeError on first call would cause the full
# initialisation logic to rerun on every subsequent request, hitting the
# filesystem or env vars thousands of times per second in a misconfigured env.

_firebase_app: firebase_admin.App | None = None
_firebase_init_attempted: bool = False


def _init_firebase() -> firebase_admin.App:
    """
    Attempt to initialise the Firebase Admin SDK from one of three credential
    sources. Called exactly once per process by _get_firebase_app().

    If a Firebase app was already initialised elsewhere in the process (e.g. by
    a test fixture or another library), we reuse it rather than crashing with
    "The default Firebase app already exists."

    Raises:
        RuntimeError: If no credentials are found in any supported location.
    """
    # ── Guard: reuse an existing default app if one was already initialised ───
    # We use the public get_app() API rather than the private _apps dict to
    # avoid coupling to Firebase internals.
    try:
        existing = firebase_admin.get_app()
        logger.info("Reusing already-initialised Firebase app: %s", existing.name)
        return existing
    except ValueError:
        pass  # No existing app — proceed to initialise one

    # ── Option 1: Individual environment variables (preferred for production) ──
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    private_key = os.getenv("FIREBASE_PRIVATE_KEY")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")

    if project_id and private_key and client_email:
        # Resolve escaped newlines that some secret managers inject
        if "\\n" in private_key:
            private_key = private_key.replace("\\n", "\n")

        cred_dict = {
            "type": "service_account",
            "project_id": project_id,
            "private_key": private_key,
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        cred = credentials.Certificate(cred_dict)
        app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialised using environment variables.")
        return app

    # ── Option 2: Full JSON string ────────────────────────────────────────────
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_json:
        import json
        cred_dict = json.loads(service_account_json)
        cred = credentials.Certificate(cred_dict)
        app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialised using JSON environment variable.")
        return app

    # ── Option 3: File path (fallback for local development) ─────────────────
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")

    if not service_account_path:
        raise RuntimeError(
            "Firebase credentials are not configured. "
            "Set FIREBASE_PROJECT_ID/PRIVATE_KEY/CLIENT_EMAIL, "
            "FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_SERVICE_ACCOUNT_PATH."
        )

    path = Path(service_account_path)
    if not path.exists():
        # Try relative to the backend directory as a convenience
        path = Path(__file__).parent / service_account_path

    if not path.exists():
        raise RuntimeError(
            f"Firebase service account file not found at '{path}'. "
            "Check your FIREBASE_SERVICE_ACCOUNT_PATH in .env."
        )

    cred = credentials.Certificate(str(path))
    app = firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK initialised using local service account file.")
    return app


def _get_firebase_app() -> firebase_admin.App:
    """
    Return the cached Firebase app, initialising it on the first call.

    On a misconfigured environment the RuntimeError from _init_firebase() is
    noted via the sentinel so subsequent calls raise immediately without
    retrying all the credential-discovery logic.

    Raises:
        RuntimeError: If Firebase credentials are not configured.
    """
    global _firebase_app, _firebase_init_attempted

    if _firebase_init_attempted:
        if _firebase_app is None:
            raise RuntimeError(
                "Firebase credentials are not configured (cached from first attempt)."
            )
        return _firebase_app

    _firebase_init_attempted = True
    _firebase_app = _init_firebase()  # raises RuntimeError on misconfiguration
    return _firebase_app


def initialize_firebase() -> firebase_admin.App:
    """
    Public wrapper around _get_firebase_app() for use at application startup.

    Calling this from the FastAPI lifespan gives early failure detection and
    clear log output before the first real request arrives, rather than
    discovering a misconfigured Firebase silently on the first Firestore call.

    Returns:
        The initialised Firebase app.

    Raises:
        RuntimeError: If Firebase credentials are not configured.
    """
    return _get_firebase_app()
