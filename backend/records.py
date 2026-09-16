"""
records.py — Firestore reads/updates for Crednco search/application records (admin side).

Extracted from the monorepo's admin_logic.py, which historically mixed
admin-owned read/update functions with app-owned write functions. This file
keeps only the functions the admin backend's /admin/* routes use.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from google.api_core.exceptions import ResourceExhausted
from google.cloud.firestore_v1.query import Query

from firestore_client import get_db, normalize_record

logger = logging.getLogger(__name__)


def _unavailable(what: str, exc: Exception) -> HTTPException:
    """
    Turn a Firestore read failure into a 503.

    These fetches used to swallow every exception and return an empty list,
    which reaches the dashboard as HTTP 200 + `[]` — indistinguishable from
    "there are genuinely no records". A Firestore outage or an exhausted
    read quota then looks like an empty database instead of a failure.
    """
    if isinstance(exc, ResourceExhausted):
        detail = (
            f"Firestore read quota exceeded while fetching {what}. "
            "Check the project's Firestore usage limits and billing plan."
        )
    else:
        detail = f"Failed to fetch {what} from Firestore."
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


def update_search_status(doc_id: str, approved: bool) -> bool:
    """Update the approval status of a search record."""
    db = get_db()
    if db is None:
        return False
    try:
        db.collection("searches").document(doc_id).update({
            "approved": approved,
            "status_updated_at": datetime.now(timezone.utc)
        })
        return True
    except Exception as exc:
        logger.error("Failed to update search status for %s: %s", doc_id, exc)
        return False


def update_application_status(doc_id: str, approved: bool) -> bool:
    """Update the approval status of an official application record."""
    db = get_db()
    if db is None:
        return False
    try:
        db.collection("applications").document(doc_id).update({
            "approved": approved,
            "status_updated_at": datetime.now(timezone.utc)
        })
        return True
    except Exception as exc:
        logger.error("Failed to update application status for %s: %s", doc_id, exc)
        return False


def fetch_recent_searches(limit: int | None = None) -> list[dict[str, Any]]:
    """
    Retrieve recent search records from Firestore.
    Handles both old nested and new flat document formats.

    If `limit` is None, all matching records are returned.
    """
    db = get_db()
    if db is None:
        logger.warning("Firestore not available; cannot fetch searches.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore is unavailable. Check Firebase configuration and credentials.",
        )

    try:
        query = db.collection("searches").order_by("timestamp", direction=Query.DESCENDING)
        if limit is not None:
            query = query.limit(limit)

        docs = query.stream()

        results = []
        for doc in docs:
            raw = doc.to_dict()
            if raw is None:
                continue

            record = normalize_record(raw)
            record["id"] = doc.id
            results.append(record)

        logger.debug("Fetched %s search records from Firestore", len(results))
        return results
    except Exception as exc:
        logger.error("Failed to fetch searches from Firestore: %s", exc, exc_info=True)
        raise _unavailable("searches", exc) from exc


def fetch_recent_applications(limit: int | None = None) -> list[dict[str, Any]]:
    """
    Retrieve recent real applications from Firestore.
    Handles both old nested and new flat document formats.

    If `limit` is None, all matching records are returned.
    """
    db = get_db()
    if db is None:
        logger.warning("Firestore not available; cannot fetch applications.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore is unavailable. Check Firebase configuration and credentials.",
        )

    try:
        query = db.collection("applications").order_by("timestamp", direction=Query.DESCENDING)
        if limit is not None:
            query = query.limit(limit)

        docs = query.stream()

        results = []
        for doc in docs:
            raw = doc.to_dict()
            if raw is None:
                continue

            record = normalize_record(raw)
            record["id"] = doc.id
            results.append(record)

        logger.debug("Fetched %s application records from Firestore", len(results))
        return results
    except Exception as exc:
        logger.error("Failed to fetch applications from Firestore: %s", exc, exc_info=True)
        raise _unavailable("applications", exc) from exc
