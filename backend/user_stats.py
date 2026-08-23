"""
user_stats.py — Registered-user metrics for the admin dashboard.

Extracted from the monorepo's user_logic.py — despite living in a file named
for user logic, fetch_registered_user_stats() was only ever called by the
admin backend's /admin/user-stats route, so it belongs here.
"""

import logging
from typing import Any

from fastapi import HTTPException, status

from firestore_client import get_db

logger = logging.getLogger(__name__)


def fetch_registered_user_stats() -> dict[str, Any]:
    """
    Retrieve registered user metrics from Firestore.
    """
    db = get_db()
    if db is None:
        logger.warning("Firestore not available; cannot fetch registered user stats.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore is unavailable. Check Firebase configuration and credentials.",
        )

    try:
        docs = db.collection("users").select(["email"]).stream()
        total_users = 0
        emails: list[str] = []
        counts: dict[str, int] = {}

        for doc in docs:
            total_users += 1
            raw = doc.to_dict() or {}
            email = raw.get("email")
            if isinstance(email, str):
                emails.append(email)
                counts[email] = counts.get(email, 0) + 1

        repeated_users = sum(count - 1 for count in counts.values() if count > 1)
        unique_emails = len(counts)
        emails.sort()

        return {
            "total_users": total_users,
            "unique_emails": unique_emails,
            "repeated_users": repeated_users,
            "emails": emails,
        }
    except Exception as exc:
        logger.exception("Failed to fetch registered user stats")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to fetch registered user stats from Firestore.",
        )
