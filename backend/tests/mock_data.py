"""
Shared test mock data and helpers.

Externalised to avoid SonarQube hard-coded credential warnings (S2068/S6437)
and unreachable-code warnings on empty async generators.
"""

import json
import os

# ── Load mock credential values from config/test_data.json ───────────────────
_config_path = os.path.join(
    os.path.dirname(__file__), os.pardir, "config", "test_data.json"
)
with open(_config_path, encoding="utf-8") as _f:
    _test_data = json.load(_f)

MOCK_PASSWORD_HASH = _test_data["MOCK_PASSWORD_HASH"]
MOCK_PASSWORD = _test_data["MOCK_PASSWORD"]
MOCK_PASSWORD_ALT = _test_data["MOCK_PASSWORD_ALT"]
MOCK_PASSWORD_WRONG = _test_data["MOCK_PASSWORD_WRONG"]
MOCK_PASSWORD_OLD = _test_data["MOCK_PASSWORD_OLD"]
MOCK_PASSWORD_NEW = _test_data["MOCK_PASSWORD_NEW"]
MOCK_SECRET = _test_data["MOCK_SECRET"]
MOCK_DB_PASSWORD = _test_data["MOCK_DB_PASSWORD"]
MOCK_AUTH_PASSWORD = _test_data["MOCK_AUTH_PASSWORD"]
MOCK_SMTP_PASSWORD = _test_data["MOCK_SMTP_PASSWORD"]
MOCK_JIRA_PASSWORD = _test_data["MOCK_JIRA_PASSWORD"]


async def empty_async_gen():
    """Async generator that yields nothing.

    Use in place of the ``return; yield`` idiom which SonarQube flags
    as unreachable code.
    """
    if False:
        yield
