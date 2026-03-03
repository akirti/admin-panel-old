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
MOCK_PASSWORD_TEMP = _test_data["MOCK_PASSWORD_TEMP"]
MOCK_SECRET = _test_data["MOCK_SECRET"]
MOCK_CLIENT_SECRET = _test_data["MOCK_CLIENT_SECRET"]
MOCK_DB_PASSWORD = _test_data["MOCK_DB_PASSWORD"]
MOCK_AUTH_PASSWORD = _test_data["MOCK_AUTH_PASSWORD"]
MOCK_AUTH_SECRET_KEY = _test_data["MOCK_AUTH_SECRET_KEY"]
MOCK_SMTP_PASSWORD = _test_data["MOCK_SMTP_PASSWORD"]
MOCK_JIRA_PASSWORD = _test_data["MOCK_JIRA_PASSWORD"]
MOCK_API_TOKEN = _test_data["MOCK_API_TOKEN"]

# ── Mock email addresses ─────────────────────────────────────────────────────
MOCK_EMAIL = _test_data["MOCK_EMAIL"]
MOCK_EMAIL_ADMIN = _test_data["MOCK_EMAIL_ADMIN"]
MOCK_EMAIL_USER = _test_data["MOCK_EMAIL_USER"]
MOCK_EMAIL_ADMIN_TEST = _test_data["MOCK_EMAIL_ADMIN_TEST"]
MOCK_EMAIL_USER_TEST = _test_data["MOCK_EMAIL_USER_TEST"]
MOCK_EMAIL_USER1 = _test_data["MOCK_EMAIL_USER1"]
MOCK_EMAIL_USER2 = _test_data["MOCK_EMAIL_USER2"]
MOCK_EMAIL_USER1_TEST = _test_data["MOCK_EMAIL_USER1_TEST"]
MOCK_EMAIL_USER2_TEST = _test_data["MOCK_EMAIL_USER2_TEST"]
MOCK_EMAIL_SUPERADMIN = _test_data["MOCK_EMAIL_SUPERADMIN"]
MOCK_EMAIL_NEWUSER = _test_data["MOCK_EMAIL_NEWUSER"]
MOCK_EMAIL_GROUPADMIN = _test_data["MOCK_EMAIL_GROUPADMIN"]
MOCK_EMAIL_NOTFOUND = _test_data["MOCK_EMAIL_NOTFOUND"]
MOCK_EMAIL_ALICE = _test_data["MOCK_EMAIL_ALICE"]
MOCK_EMAIL_BOB = _test_data["MOCK_EMAIL_BOB"]
MOCK_EMAIL_CHARLIE = _test_data["MOCK_EMAIL_CHARLIE"]
MOCK_EMAIL_CREATOR = _test_data["MOCK_EMAIL_CREATOR"]
MOCK_EMAIL_EDITOR = _test_data["MOCK_EMAIL_EDITOR"]
MOCK_EMAIL_EDITOR_TEST = _test_data["MOCK_EMAIL_EDITOR_TEST"]
MOCK_EMAIL_VIEWER_TEST = _test_data["MOCK_EMAIL_VIEWER_TEST"]
MOCK_EMAIL_OTHER_TEST = _test_data["MOCK_EMAIL_OTHER_TEST"]
MOCK_EMAIL_BOT = _test_data["MOCK_EMAIL_BOT"]
MOCK_EMAIL_ANONYMOUS = _test_data["MOCK_EMAIL_ANONYMOUS"]
MOCK_EMAIL_NEW = _test_data["MOCK_EMAIL_NEW"]
MOCK_EMAIL_NEW_TEST = _test_data["MOCK_EMAIL_NEW_TEST"]
MOCK_EMAIL_DELETE = _test_data["MOCK_EMAIL_DELETE"]
MOCK_EMAIL_TARGET = _test_data["MOCK_EMAIL_TARGET"]
MOCK_EMAIL_SHARED = _test_data["MOCK_EMAIL_SHARED"]
MOCK_EMAIL_PUBLIC = _test_data["MOCK_EMAIL_PUBLIC"]
MOCK_EMAIL_SUPER = _test_data["MOCK_EMAIL_SUPER"]
MOCK_EMAIL_STANDALONE = _test_data["MOCK_EMAIL_STANDALONE"]
MOCK_EMAIL_EXISTING = _test_data["MOCK_EMAIL_EXISTING"]
MOCK_EMAIL_VIEWER = _test_data["MOCK_EMAIL_VIEWER"]
MOCK_EMAIL_NOFULLNAME = _test_data["MOCK_EMAIL_NOFULLNAME"]
MOCK_EMAIL_NOREPLY = _test_data["MOCK_EMAIL_NOREPLY"]
MOCK_EMAIL_NOREPLY_LOCAL = _test_data["MOCK_EMAIL_NOREPLY_LOCAL"]
MOCK_EMAIL_NOREPLY_EASYLIFE = _test_data["MOCK_EMAIL_NOREPLY_EASYLIFE"]


# ── Mock URLs ─────────────────────────────────────────────────────────────────
MOCK_URL_JIRA_BASE = _test_data["MOCK_URL_JIRA_BASE"]
MOCK_URL_JIRA_EXAMPLE = _test_data["MOCK_URL_JIRA_EXAMPLE"]
MOCK_URL_JIRA_TEST = _test_data["MOCK_URL_JIRA_TEST"]
MOCK_URL_JIRA_EXAMPLE_TEST = _test_data["MOCK_URL_JIRA_EXAMPLE_TEST"]
MOCK_URL_JIRA_BROWSE_1 = _test_data["MOCK_URL_JIRA_BROWSE_1"]
MOCK_URL_JIRA_BROWSE_EXISTING = _test_data["MOCK_URL_JIRA_BROWSE_EXISTING"]
MOCK_URL_JIRA_LINK = _test_data["MOCK_URL_JIRA_LINK"]
MOCK_URL_API = _test_data["MOCK_URL_API"]
MOCK_URL_API_DATA = _test_data["MOCK_URL_API_DATA"]
MOCK_URL_API_HEALTH = _test_data["MOCK_URL_API_HEALTH"]
MOCK_URL_AUTH_LOGIN = _test_data["MOCK_URL_AUTH_LOGIN"]
MOCK_URL_AUTH_OAUTH = _test_data["MOCK_URL_AUTH_OAUTH"]
MOCK_URL_AUTH_TOKEN = _test_data["MOCK_URL_AUTH_TOKEN"]
MOCK_URL_FRONTEND = _test_data["MOCK_URL_FRONTEND"]
MOCK_URL_FRONTEND_DEV = _test_data["MOCK_URL_FRONTEND_DEV"]
MOCK_URL_RESET = _test_data["MOCK_URL_RESET"]
MOCK_URL_RESET_CUSTOM = _test_data["MOCK_URL_RESET_CUSTOM"]
MOCK_URL_MONGODB = _test_data["MOCK_URL_MONGODB"]
MOCK_URL_GCS = _test_data["MOCK_URL_GCS"]
MOCK_URL_GCS_TEST = _test_data["MOCK_URL_GCS_TEST"]
MOCK_URL_SIGNED = _test_data["MOCK_URL_SIGNED"]
MOCK_URL_SIGNED_SHORT = _test_data["MOCK_URL_SIGNED_SHORT"]
MOCK_URL_FILE_HTTPS = _test_data["MOCK_URL_FILE_HTTPS"]
MOCK_URL_FILE_HTTP = _test_data["MOCK_URL_FILE_HTTP"]
MOCK_URL_PREVAIL = _test_data["MOCK_URL_PREVAIL"]
MOCK_URL_PROXY = _test_data["MOCK_URL_PROXY"]
MOCK_URL_RESOURCE = _test_data["MOCK_URL_RESOURCE"]


async def empty_async_gen():
    """Async generator that yields nothing.

    Use in place of the ``return; yield`` idiom which SonarQube flags
    as unreachable code.
    """
    if False:
        yield
