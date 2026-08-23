"""
firestore_client.py — Shared Firestore client factory and record normalizer.

This module is intentionally duplicated byte-for-byte between crednco-app's
and crednco-admin's backends. Both services read/write the same Firestore
project (searches, applications, users collections), so the client factory
and the read-side record shape must stay identical across both repos. If you
change this file, apply the same change to the other repo's copy.
"""

import logging
from typing import Any

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def get_db():
    """Get the Firestore client from the default Firebase app."""
    try:
        return firestore.client()
    except Exception as exc:
        logger.error("Failed to get Firestore client: %s", exc)
        return None


def normalize_record(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize a Firestore document (flat *or* old nested format) into
    the shape the admin-panel frontend expects:

        {
          id, timestamp,
          data:     { name, loan_type, loan_amount_requested, monthly_income, credit_score, … },
          metadata: { uid, prediction: { approved, approval_probability, sanctioned_amount } }
        }
    """
    # Convert datetime to ISO string for JSON serialization
    ts = raw.get("timestamp")
    if ts is not None and hasattr(ts, "isoformat"):
        ts = ts.isoformat()

    # ── Old nested format ────────────────────────────────────────────────
    if "data" in raw:
        record = dict(raw)
        record["timestamp"] = ts
        return record

    # ── New flat format ──────────────────────────────────────────────────
    return {
        "timestamp": ts,
        "data": {
            "name": raw.get("name", "Applicant"),
            "loan_type": raw.get("loan_type"),
            "loan_amount_requested": raw.get("loan_amount"),
            "monthly_income": raw.get("monthly_income"),
            "credit_score": raw.get("credit_score"),
            "age": raw.get("age"),
            "employment_type": raw.get("employment_type"),
            "years_of_experience": raw.get("years_of_experience"),
            "existing_emis": raw.get("existing_emis"),
            "existing_loans_count": raw.get("existing_loans_count"),
            "loan_tenure_months": raw.get("loan_tenure_months"),
            "interest_rate": raw.get("interest_rate"),
        },
        "metadata": {
            "uid": raw.get("uid"),
            "ip_address": raw.get("ip_address"),
            "correlation_id": raw.get("correlation_id"),
            "prediction": {
                "approved": raw.get("approved"),
                "approval_probability": raw.get("approval_probability"),
                "sanctioned_amount": raw.get("sanctioned_amount"),
                "loan_grade": raw.get("loan_grade"),
                "monthly_emi": raw.get("monthly_emi"),
            },
        },
    }
