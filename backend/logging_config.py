"""
logging_config.py — Structured JSON logging for the Crednco API.

Usage:
    from logging_config import setup_logging
    setup_logging(os.getenv("LOG_LEVEL", "INFO"))

All log records are emitted as single-line JSON, making them trivially
parseable by log aggregators (Datadog, Loki, CloudWatch, etc.).

Every record includes:
    timestamp, level, name, message, module, func, line

Optional (when present via `extra=` or on the LogRecord):
    correlation_id   — set by the correlation middleware in main.py
    + any additional key/value pairs passed via `extra`

Example output:
    {
      "timestamp": "2024-11-15T10:23:01.456789+00:00",
      "level": "INFO",
      "name": "main",
      "message": "Request processed",
      "module": "main",
      "func": "add_correlation_id_and_log",
      "line": 82,
      "correlation_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "method": "POST",
      "path": "/predict",
      "status_code": 200,
      "duration_ms": 143.2
    }
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

# Internal LogRecord attributes that should NOT be forwarded as
# extra context — they are either already captured in the core fields
# or are internal Python logging plumbing.
_STANDARD_LOG_RECORD_ATTRS: frozenset[str] = frozenset(
    {
        "args",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "message",
        "module",
        "msecs",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "thread",
        "threadName",
        "taskName",  # Python 3.12+
    }
)


class JsonFormatter(logging.Formatter):
    """
    Formats log records as single-line JSON strings.

    Any key/value pairs passed via `extra=` are merged into the record.
    Internal LogRecord attributes are filtered out to avoid noise.
    Exceptions are serialised as a string under the 'exception' key.
    """

    def format(self, record: logging.LogRecord) -> str:
        # Ensure record.message is populated
        record.message = record.getMessage()

        log_data: dict = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "name": record.name,
            "message": record.message,
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }

        # Correlation ID — promoted to a top-level field for easy filtering
        correlation_id = getattr(record, "correlation_id", None)
        if correlation_id:
            log_data["correlation_id"] = correlation_id

        # Merge any extra context, skipping internal attrs and already-captured fields
        already_captured = set(log_data.keys()) | {"correlation_id"}
        for key, value in record.__dict__.items():
            if (
                key not in _STANDARD_LOG_RECORD_ATTRS
                and key not in already_captured
                and not key.startswith("_")
            ):
                log_data[key] = value

        # Serialise exception tracebacks
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, default=str)


def setup_logging(level: str = "INFO") -> None:
    """
    Configure the root logger to emit structured JSON to stdout.

    Args:
        level: Log level string — DEBUG | INFO | WARNING | ERROR | CRITICAL.
               Invalid values fall back to INFO with a warning.

    Notes:
        - Clears any existing handlers on the root logger to prevent
          duplicate log lines (common when uvicorn also configures logging).
        - Sets uvicorn's own loggers to the same level so their output
          is also captured in JSON format.
        - Safe to call multiple times (idempotent).
    """
    numeric_level = getattr(logging, level.upper(), None)
    if not isinstance(numeric_level, int):
        numeric_level = logging.INFO
        # Can't use logger here — it isn't set up yet
        print(
            f"[logging_config] Invalid LOG_LEVEL '{level}' — defaulting to INFO",
            flush=True,
        )

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    root_logger = logging.getLogger()

    # Remove existing handlers (avoids double-logging with uvicorn)
    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)

    root_logger.setLevel(numeric_level)
    root_logger.addHandler(handler)

    # Align uvicorn loggers so their output flows through JsonFormatter too
    for uvicorn_logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(uvicorn_logger_name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True  # Let root handler handle it
        uv_logger.setLevel(numeric_level)
