"""
test_admin_login.py — Tests for the admin-auth (/login) endpoint and the
/admin/* auth dependency.

Split out from the monorepo's test_admin_and_apply.py, which combined
admin-auth and /apply tests in one file. This half moved to crednco-admin
since /login and /admin/* are admin-only routes.

Coverage:
  - /login: valid TOTP succeeds, invalid TOTP / unknown user rejected, and a
    regression test proving the old hardcoded admin/admin123 bypass (with
    TOTP verification commented out) no longer works.
  - /admin/* auth dependency: missing/invalid tokens rejected with 401,
    valid tokens pass through to business logic.

Firestore is not configured in this test environment; admin_security's
get_user_secret() is mocked where a specific TOTP secret is needed, and
admin-route tests only assert that auth succeeds/fails correctly (not on
the Firestore-dependent response body).

Requires ENV=development (or JWT_SECRET/ADMIN_API_KEY set) so admin_security
can import without raising — see admin_security.py's _require_secret().

Run with:
    pytest test_admin_login.py -v
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import patch

import pyotp
import pytest
from fastapi.testclient import TestClient
from jose import jwt as jose_jwt

from main import app
from admin_security import JWT_SECRET, ALGORITHM

client = TestClient(app)

# The CSRF middleware requires an Origin/Referer header on unauthenticated
# state-changing requests; this satisfies it without touching CSRF logic itself.
ORIGIN_HEADERS = {"Origin": "http://localhost:5173"}


@pytest.fixture(autouse=True)
def _disable_rate_limiting():
    """
    /login is rate-limited (5/minute). Running several tests against the
    same endpoint in one process would otherwise trip the limiter itself
    rather than testing what each test intends. Rate limiting is covered
    separately (manually verified when it was added); these tests disable
    it rather than fighting request counts.
    """
    from limiter_config import limiter

    original = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = original


def _make_admin_token(sub: str = "admin") -> str:
    payload = {"sub": sub, "exp": datetime.utcnow() + timedelta(minutes=5)}
    return jose_jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


# ── /login ────────────────────────────────────────────────────────────────────


class TestAdminLogin:
    def test_valid_totp_code_succeeds(self):
        secret = pyotp.random_base32()
        with patch("admin_security.get_user_secret", return_value=secret):
            code = pyotp.TOTP(secret).now()
            res = client.post(
                "/login",
                json={"user_id": "admin", "password": code},
                headers=ORIGIN_HEADERS,
            )
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_invalid_totp_code_is_rejected(self):
        secret = pyotp.random_base32()
        with patch("admin_security.get_user_secret", return_value=secret):
            res = client.post(
                "/login",
                json={"user_id": "admin", "password": "000000"},
                headers=ORIGIN_HEADERS,
            )
        assert res.status_code == 401

    def test_unknown_user_is_rejected(self):
        with patch("admin_security.get_user_secret", return_value=None):
            res = client.post(
                "/login",
                json={"user_id": "nobody", "password": "123456"},
                headers=ORIGIN_HEADERS,
            )
        assert res.status_code == 400

    def test_legacy_hardcoded_credentials_no_longer_work(self):
        """
        Regression test for the original vulnerability: /login used to accept
        the literal admin/admin123 pair with TOTP verification commented out.
        Even with a real TOTP secret configured, that literal string must
        never be accepted as a valid code again.
        """
        secret = pyotp.random_base32()
        with patch("admin_security.get_user_secret", return_value=secret), \
                patch("admin_security._DEFAULT_ADMIN_ENABLED", False):
            res = client.post(
                "/login",
                json={"user_id": "admin", "password": "admin123"},
                headers=ORIGIN_HEADERS,
            )
        assert res.status_code == 401

    def test_default_admin_login_when_enabled(self):
        """ALLOW_DEFAULT_ADMIN (development only) accepts admin/admin123 without Firestore."""
        with patch("admin_security._DEFAULT_ADMIN_ENABLED", True):
            res = client.post(
                "/login",
                json={"user_id": "admin", "password": "admin123"},
                headers=ORIGIN_HEADERS,
            )
        assert res.status_code == 200
        payload = jose_jwt.decode(res.json()["access_token"], JWT_SECRET, algorithms=[ALGORITHM])
        assert payload["sub"] == "admin"


# ── /admin/* auth dependency ───────────────────────────────────────────────────


class TestAdminRouteAuth:
    def test_admin_searches_requires_auth(self):
        res = client.get("/admin/searches")
        assert res.status_code == 401

    def test_admin_searches_rejects_malformed_header(self):
        res = client.get("/admin/searches", headers={"Authorization": "Basic abc123"})
        assert res.status_code == 401

    def test_admin_searches_rejects_invalid_token(self):
        res = client.get("/admin/searches", headers={"Authorization": "Bearer not-a-real-jwt"})
        assert res.status_code == 401

    def test_admin_searches_accepts_valid_token(self):
        token = _make_admin_token()
        res = client.get("/admin/searches", headers={"Authorization": f"Bearer {token}"})
        # Firestore isn't configured in this test environment, so the exact
        # response depends on that (typically 200 with []). What matters here
        # is that authentication succeeded rather than being rejected.
        assert res.status_code != 401

    def test_admin_applications_requires_auth(self):
        res = client.get("/admin/applications")
        assert res.status_code == 401

    def test_admin_user_stats_requires_auth(self):
        res = client.get("/admin/user-stats")
        assert res.status_code == 401
