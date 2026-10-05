# =============================================================================
# Python 3.10 Compatibility Shim for CoreSmith
# Injects datetime.UTC for Python < 3.11 without modifying coresmith source code
# =============================================================================
import datetime

if not hasattr(datetime, "UTC"):
    datetime.UTC = datetime.timezone.utc

if hasattr(datetime, "__all__") and "UTC" not in datetime.__all__:
    datetime.__all__ = tuple(list(datetime.__all__) + ["UTC"])
