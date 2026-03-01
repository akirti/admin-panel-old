"""Self-contained test fixture data for config integration tests.

Provides fake simulator data, config.json template, and expected value
constants so that TestRealConfigFiles can create temp config files and
assert against known values — with zero dependency on real project files.
"""

# ---------------------------------------------------------------------------
# Fake simulator data (mirrors server.env.production.json structure)
# ---------------------------------------------------------------------------
SIMULATOR_DATA = {
    "globals.databases.default.max_pool_size": 100,
    "globals.databases.default.min_pool_size": 10,
    "globals.databases.default.max_idle_time_ms": 300000,
    "globals.databases.default.server_selection_timeout_ms": 30000,
    "globals.databases.default.connect_timeout_ms": 20000,
    "globals.databases.default.socket_timeout_ms": 60000,
    "globals.databases.default.heartbeat_frequency_ms": 10000,
    "globals.databases.default.wait_queue_timeout_ms": 10000,
    "globals.databases.default.max_result_size": 5000,

    "databases.authentication.db_info.connection_scheme": "mongodb",
    "databases.authentication.db_info.username": "testadmin",
    "databases.authentication.db_info.password": "testpass",
    "databases.authentication.db_info.host": "test-mongo",
    "databases.authentication.db_info.port": 27017,
    "databases.authentication.db_info.database": "test_auth_db",
    "databases.authentication.db_info.collections": [
        "users", "tokens", "reset_tokens", "sessions", "roles", "groups",
        "permissions", "customers", "scenario_requests", "feedbacks", "domains",
        "domain_scenarios", "playboards", "configurations", "activity_logs",
        "api_configs", "distribution_lists", "error_logs", "error_log_archives",
    ],

    "environment.space": "production",

    "environment.smtp.smtp_server": "test-mailpit",
    "environment.smtp.smtp_port": 1025,
    "environment.smtp.email": "noreply@test.local",
    "environment.smtp.password": "",
    "environment.smtp.recipients": [],
    "environment.smtp.email_from": "noreply@test.local",
    "environment.smtp.email_from_name": "Test No Reply",

    "environment.app_secrets.auth_secret_key": "test-secret-key-for-ci-cd",

    "environment.authentication.access_token_expiry_minutes": 30,
    "environment.authentication.refresh_token_expiry_minutes": 60,

    "environment.storage.type": "local",

    "environment.cors.origins": ["http://localhost:3000", "http://localhost:5173"],

    "environment.jira.base_url": "https://test-jira.example.com",
    "environment.jira.username": "",
    "environment.jira.password": "",
    "environment.jira.email": "test@example.com",
    "environment.jira.api_token": "fake-token",
    "environment.jira.project_key": "TEST",
    "environment.jira.issue_type": "Task",
    "environment.jira.components": [],
    "environment.jira.assignee": "",
    "environment.jira.reporter": "",
    "environment.jira.default_team": "Test Team",
    "environment.jira.default_assignee": "",
    "environment.jira.default_assignee_name": "",
    "environment.jira.default_epic": "",
    "environment.jira.default_watchers": [],
    "environment.jira.default_priority": "Medium",
    "environment.jira.default_task_environment": "TEST",
    "environment.jira.default_task_labels": "",
    "environment.jira.default_target_days": 7,
    "environment.jira.ssl.enabled": False,
    "environment.jira.ssl.bundle_path": "",
    "environment.jira.ssl.bundle_file_name": "",
    "environment.jira.ssl.bundle_data": "",

    "backend_port": 8000,
    "frontend_port": 3000,
}

# ---------------------------------------------------------------------------
# config.json template (uses {placeholder} syntax resolved by simulator)
# ---------------------------------------------------------------------------
CONFIG_JSON = {
    "globals": {
        "databases": {
            "default": {
                "max_pool_size": "{globals.databases.default.max_pool_size}",
                "min_pool_size": "{globals.databases.default.min_pool_size}",
                "max_idle_time_ms": "{globals.databases.default.max_idle_time_ms}",
                "server_selection_timeout_ms": "{globals.databases.default.server_selection_timeout_ms}",
                "connect_timeout_ms": "{globals.databases.default.connect_timeout_ms}",
                "socket_timeout_ms": "{globals.databases.default.socket_timeout_ms}",
                "heartbeat_frequency_ms": "{globals.databases.default.heartbeat_frequency_ms}",
                "wait_queue_timeout_ms": "{globals.databases.default.wait_queue_timeout_ms}",
                "max_result_size": "{globals.databases.default.max_result_size}",
                "retry_writes": True,
                "retry_reads": True,
            }
        }
    },
    "databases": {
        "authentication": {
            "type": "db",
            "db_info": {
                "type": "mongodb",
                "connection_scheme": "{databases.authentication.db_info.connection_scheme}",
                "username": "{databases.authentication.db_info.username}",
                "password": "{databases.authentication.db_info.password}",
                "host": "{databases.authentication.db_info.host}",
                "database": "{databases.authentication.db_info.database}",
                "collections": "{databases.authentication.db_info.collections}",
            },
        }
    },
    "environment": {
        "app_name": "easylife-admin-panel",
        "app_version": "1.0.0",
        "debug": True,
        "log_level": "DEBUG",
        "port": 8000,
        "space": "{environment.space}",
        "smtp": {
            "smtp_server": "{environment.smtp.smtp_server}",
            "smtp_port": "{environment.smtp.smtp_port}",
            "email": "{environment.smtp.email}",
            "password": "{environment.smtp.password}",
            "recipients": "{environment.smtp.recipients}",
            "email_from": "{environment.smtp.email_from}",
            "email_from_name": "{environment.smtp.email_from_name}",
        },
        "app_secrets": {
            "auth_secret_key": "{environment.app_secrets.auth_secret_key}",
        },
        "authentication": {
            "access_token_expiry_minutes": "{environment.authentication.access_token_expiry_minutes}",
            "refresh_token_expiry_minutes": "{environment.authentication.refresh_token_expiry_minutes}",
        },
        "storage": {
            "type": "{environment.storage.type}",
        },
        "cors": {
            "origins": "{environment.cors.origins}",
        },
        "jira": {
            "base_url": "{environment.jira.base_url}",
            "username": "{environment.jira.username}",
            "password": "{environment.jira.password}",
            "api_token": "{environment.jira.api_token}",
            "email": "{environment.jira.email}",
            "project_key": "{environment.jira.project_key}",
            "issue_type": "{environment.jira.issue_type}",
            "components": "{environment.jira.components}",
            "assignee": "{environment.jira.assignee}",
            "reporter": "{environment.jira.reporter}",
            "default_team": "{environment.jira.default_team}",
            "default_assignee": "{environment.jira.default_assignee}",
            "default_assignee_name": "{environment.jira.default_assignee_name}",
            "default_epic": "{environment.jira.default_epic}",
            "default_watchers": "{environment.jira.default_watchers}",
            "default_priority": "{environment.jira.default_priority}",
            "default_task_environment": "{environment.jira.default_task_environment}",
            "default_task_labels": "{environment.jira.default_task_labels}",
            "default_target_days": "{environment.jira.default_target_days}",
            "ssl": {
                "enabled": "{environment.jira.ssl.enabled}",
                "bundle_path": "{environment.jira.ssl.bundle_path}",
                "bundle_file_name": "{environment.jira.ssl.bundle_file_name}",
                "bundle_data": "{environment.jira.ssl.bundle_data}",
            },
        },
    },
}

# ---------------------------------------------------------------------------
# Expected resolved values (derived from SIMULATOR_DATA above)
# ---------------------------------------------------------------------------

# Database
EXPECTED_DB_HOST = SIMULATOR_DATA["databases.authentication.db_info.host"]
EXPECTED_DB_DATABASE = SIMULATOR_DATA["databases.authentication.db_info.database"]
EXPECTED_DB_USERNAME = SIMULATOR_DATA["databases.authentication.db_info.username"]
EXPECTED_DB_PASSWORD = SIMULATOR_DATA["databases.authentication.db_info.password"]
EXPECTED_DB_PORT = SIMULATOR_DATA["databases.authentication.db_info.port"]
EXPECTED_DB_CONNECTION_SCHEME = SIMULATOR_DATA["databases.authentication.db_info.connection_scheme"]
EXPECTED_COLLECTIONS = SIMULATOR_DATA["databases.authentication.db_info.collections"]

# Pool
EXPECTED_MAX_POOL_SIZE = SIMULATOR_DATA["globals.databases.default.max_pool_size"]
EXPECTED_MIN_POOL_SIZE = SIMULATOR_DATA["globals.databases.default.min_pool_size"]

# Auth
EXPECTED_SECRET_KEY = SIMULATOR_DATA["environment.app_secrets.auth_secret_key"]

# SMTP
EXPECTED_SMTP_SERVER = SIMULATOR_DATA["environment.smtp.smtp_server"]
EXPECTED_SMTP_PORT = SIMULATOR_DATA["environment.smtp.smtp_port"]

# CORS
EXPECTED_CORS_ORIGINS = SIMULATOR_DATA["environment.cors.origins"]

# Jira
EXPECTED_JIRA_BASE_URL = SIMULATOR_DATA["environment.jira.base_url"]
