"""
Locust Load Test for Admin Panel Backend API
Tests 100 concurrent users against FastAPI backend endpoints

Endpoints covered:
- Health checks (live, ready, metrics)
- Authentication (login, refresh, profile, CSRF)
- Users, Roles, Groups, Permissions
- Domains, Scenarios, Playboards
- Scenario Requests, Customers, Configurations
- Feedback, Activity Logs, Error Logs
- API Configs, Distribution Lists, Export
- Dashboard (stats, summary, analytics)

Run with:
    locust -f locustfile.py --host=http://localhost:8000

For 100 concurrent users:
    locust -f locustfile.py --host=http://localhost:8000 --users=100 --spawn-rate=10

Headless mode:
    locust -f locustfile.py --host=http://localhost:8000 --users=100 --spawn-rate=10 --headless --run-time=5m
"""

import csv
import json
import os
import random
import string
import itertools
from pathlib import Path
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner

# ============================================================================
# CONFIGURATION - Update these values for your environment
# ============================================================================
# Default credentials (fallback if no CSV file)
DEFAULT_EMAIL = os.environ.get("LOAD_TEST_EMAIL", "admin@easylife.local")
DEFAULT_PASSWORD = os.environ.get("LOAD_TEST_PASSWORD", "password123")

# Load users from CSV file if available
def load_users_from_csv():
    """Load test users from CSV file."""
    csv_path = Path(__file__).parent / "users.csv"
    users = []

    if csv_path.exists():
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                users.append({
                    "email": row.get("email", "").strip(),
                    "password": row.get("password", "").strip(),
                    "role": row.get("role", "user").strip()
                })
        print(f"Loaded {len(users)} test users from {csv_path}")

    # Fallback to default user if no CSV or empty
    if not users:
        users = [{"email": DEFAULT_EMAIL, "password": DEFAULT_PASSWORD, "role": "admin"}]
        print(f"Using default test user: {DEFAULT_EMAIL}")

    return users

# Load users once at module level
TEST_USERS = load_users_from_csv()

# Create a thread-safe iterator for distributing users
_user_cycle = itertools.cycle(TEST_USERS)

def get_next_user():
    """Get the next user credentials (round-robin distribution)."""
    return next(_user_cycle)
# ============================================================================


class AdminPanelUser(HttpUser):
    """
    Simulates a user interacting with the Admin Panel API.
    Mix of authenticated and unauthenticated requests.
    """

    # Wait between 1-3 seconds between tasks (realistic user behavior)
    wait_time = between(1, 3)
    weight = 3  # Higher weight - most users are authenticated

    # Store tokens for authenticated requests
    access_token = None
    refresh_token = None
    csrf_token = None
    user_data = None
    login_failed = False
    current_user = None  # Store assigned user credentials

    def on_start(self):
        """Called when a simulated user starts. Assigns user and performs login."""
        # Assign a user to this locust instance (round-robin from CSV)
        self.current_user = get_next_user()
        self._get_csrf_token()
        self._login()

    def _get_csrf_token(self):
        """Fetch CSRF token from cookie."""
        with self.client.get(
            "/api/v1/auth/csrf-token",
            catch_response=True,
            name="/api/v1/auth/csrf-token"
        ) as response:
            if response.status_code == 200:
                # Get CSRF token from cookie (set by middleware)
                self.csrf_token = response.cookies.get("csrf_token")
                # Fallback to JSON response if cookie not available
                if not self.csrf_token:
                    data = response.json()
                    self.csrf_token = data.get("csrf_token")
                response.success()
            else:
                response.failure(f"Failed to get CSRF token: {response.status_code}")

    def _login(self):
        """Login to get JWT token using assigned user credentials."""
        login_data = {
            "email": self.current_user["email"],
            "password": self.current_user["password"]
        }

        headers = {"Content-Type": "application/json"}
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token

        with self.client.post(
            "/api/v1/auth/login",
            json=login_data,
            headers=headers,
            catch_response=True,
            name="/api/v1/auth/login"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                self.user_data = data.get("user")
                self.login_failed = False
                response.success()
            else:
                self.login_failed = True
                # Report the actual error instead of hiding it
                response.failure(f"Login failed: {response.status_code} - {response.text[:200]}")

    def _get_auth_headers(self):
        """Get headers with authentication token."""
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token
        return headers

    def _is_authenticated(self):
        """Check if user is authenticated."""
        return self.access_token is not None and not self.login_failed

    # ==================== Health Check Endpoints (No Auth) ====================

    @task(10)
    def health_check(self):
        """Check API health - high frequency."""
        self.client.get("/api/v1/health", name="/api/v1/health")

    @task(5)
    def health_live(self):
        """Liveness probe."""
        self.client.get("/api/v1/health/live", name="/api/v1/health/live")

    @task(5)
    def health_ready(self):
        """Readiness probe."""
        self.client.get("/api/v1/health/ready", name="/api/v1/health/ready")

    @task(2)
    def health_metrics(self):
        """System metrics."""
        self.client.get("/api/v1/health/metrics", name="/api/v1/health/metrics")

    @task(2)
    def app_info(self):
        """Application info."""
        self.client.get("/api/v1/info", name="/api/v1/info")

    # ==================== Authentication Endpoints ====================

    @task(3)
    def get_profile(self):
        """Get current user profile."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/auth/profile",
            headers=self._get_auth_headers(),
            name="/api/v1/auth/profile"
        )

    @task(1)
    def do_refresh_token(self):
        """Refresh JWT token."""
        # Skip if not authenticated or no refresh token available
        if not self._is_authenticated() or not self.refresh_token:
            return
        # Refresh token endpoint requires refresh_token in body
        with self.client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": self.refresh_token},
            headers=self._get_auth_headers(),
            catch_response=True,
            name="/api/v1/auth/refresh"
        ) as response:
            if response.status_code == 200:
                # Update tokens from refresh response
                data = response.json()
                if data.get("access_token"):
                    self.access_token = data.get("access_token")
                if data.get("refresh_token"):
                    self.refresh_token = data.get("refresh_token")
                response.success()
            else:
                response.failure(f"Refresh failed: {response.status_code}")

    # ==================== User Management Endpoints ====================

    @task(5)
    def list_users(self):
        """List users with pagination."""
        if not self._is_authenticated():
            return
        page = random.randint(0, 5)
        limit = random.choice([10, 25, 50])
        self.client.get(
            f"/api/v1/users?page={page}&limit={limit}",
            headers=self._get_auth_headers(),
            name="/api/v1/users"
        )

    @task(2)
    def get_user_count(self):
        """Get total user count."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/users/count",
            headers=self._get_auth_headers(),
            name="/api/v1/users/count"
        )

    # ==================== Roles Endpoints ====================

    @task(3)
    def list_roles(self):
        """List roles."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/roles",
            headers=self._get_auth_headers(),
            name="/api/v1/roles"
        )

    @task(1)
    def get_roles_count(self):
        """Get role count."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/roles/count",
            headers=self._get_auth_headers(),
            name="/api/v1/roles/count"
        )

    # ==================== Groups Endpoints ====================

    @task(3)
    def list_groups(self):
        """List groups."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/groups",
            headers=self._get_auth_headers(),
            name="/api/v1/groups"
        )

    @task(1)
    def get_groups_count(self):
        """Get group count."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/groups/count",
            headers=self._get_auth_headers(),
            name="/api/v1/groups/count"
        )

    # ==================== Permissions Endpoints ====================

    @task(2)
    def list_permissions(self):
        """List permissions."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/permissions",
            headers=self._get_auth_headers(),
            name="/api/v1/permissions"
        )

    @task(1)
    def get_permission_modules(self):
        """Get permission modules."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/permissions/modules",
            headers=self._get_auth_headers(),
            name="/api/v1/permissions/modules"
        )

    # ==================== Domains Endpoints ====================

    @task(5)
    def list_domains(self):
        """List domains."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/domains",
            headers=self._get_auth_headers(),
            name="/api/v1/domains"
        )

    @task(3)
    def get_all_domains(self):
        """Get all accessible domains."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/domains/all",
            headers=self._get_auth_headers(),
            name="/api/v1/domains/all"
        )

    @task(1)
    def get_domains_count(self):
        """Get domain count."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/domains/count",
            headers=self._get_auth_headers(),
            name="/api/v1/domains/count"
        )

    # ==================== Scenarios Endpoints ====================

    @task(4)
    def list_scenarios(self):
        """List all scenarios."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/scenarios/all",
            headers=self._get_auth_headers(),
            name="/api/v1/scenarios/all"
        )

    @task(3)
    def list_domain_scenarios(self):
        """List domain scenarios."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/domain-scenarios",
            headers=self._get_auth_headers(),
            name="/api/v1/domain-scenarios"
        )

    # ==================== Playboards Endpoints ====================

    @task(3)
    def list_playboards(self):
        """List playboards."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/playboards",
            headers=self._get_auth_headers(),
            name="/api/v1/playboards"
        )

    @task(1)
    def get_playboards_count(self):
        """Get playboard count."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/playboards/count",
            headers=self._get_auth_headers(),
            name="/api/v1/playboards/count"
        )

    # ==================== Scenario Requests Endpoints ====================

    @task(4)
    def list_scenario_requests(self):
        """List scenario requests."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/ask_scenarios/all",
            headers=self._get_auth_headers(),
            name="/api/v1/ask_scenarios/all"
        )

    @task(2)
    def get_request_statuses(self):
        """Get available request statuses."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/ask_scenarios/lookup/statuses",
            headers=self._get_auth_headers(),
            name="/api/v1/ask_scenarios/lookup/statuses"
        )

    @task(2)
    def get_request_types(self):
        """Get available request types."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/ask_scenarios/lookup/request_types",
            headers=self._get_auth_headers(),
            name="/api/v1/ask_scenarios/lookup/request_types"
        )

    # ==================== Customers Endpoints ====================

    @task(3)
    def list_customers(self):
        """List customers."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/customers",
            headers=self._get_auth_headers(),
            name="/api/v1/customers"
        )

    @task(1)
    def get_customers_count(self):
        """Get customer count."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/customers/count",
            headers=self._get_auth_headers(),
            name="/api/v1/customers/count"
        )

    # ==================== Configurations Endpoints ====================

    @task(2)
    def list_configurations(self):
        """List configurations."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/configurations",
            headers=self._get_auth_headers(),
            name="/api/v1/configurations"
        )

    @task(1)
    def get_configuration_types(self):
        """Get configuration types."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/configurations/types",
            headers=self._get_auth_headers(),
            name="/api/v1/configurations/types"
        )

    # ==================== Feedback Endpoints ====================

    @task(2)
    def list_feedback(self):
        """List user feedback."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/feedback/all",
            headers=self._get_auth_headers(),
            name="/api/v1/feedback/all"
        )

    # ==================== Activity Logs Endpoints ====================

    @task(2)
    def list_activity_logs(self):
        """List activity logs."""
        if not self._is_authenticated():
            return
        page = random.randint(0, 5)
        self.client.get(
            f"/api/v1/activity-logs?page={page}&limit=25",
            headers=self._get_auth_headers(),
            name="/api/v1/activity-logs"
        )

    @task(1)
    def get_activity_stats(self):
        """Get activity statistics."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/activity-logs/stats",
            headers=self._get_auth_headers(),
            name="/api/v1/activity-logs/stats"
        )

    @task(1)
    def get_activity_actions(self):
        """Get available activity actions."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/activity-logs/actions",
            headers=self._get_auth_headers(),
            name="/api/v1/activity-logs/actions"
        )

    @task(1)
    def get_activity_entity_types(self):
        """Get activity entity types."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/activity-logs/entity-types",
            headers=self._get_auth_headers(),
            name="/api/v1/activity-logs/entity-types"
        )

    # ==================== Error Logs Endpoints ====================

    @task(2)
    def list_error_logs(self):
        """List error logs with pagination."""
        if not self._is_authenticated():
            return
        page = random.randint(0, 3)
        level = random.choice([None, "ERROR", "WARNING", "CRITICAL"])
        params = f"page={page}&limit=25"
        if level:
            params += f"&level={level}"
        self.client.get(
            f"/api/v1/error-logs?{params}",
            headers=self._get_auth_headers(),
            name="/api/v1/error-logs"
        )

    @task(1)
    def get_error_log_stats(self):
        """Get error log statistics."""
        if not self._is_authenticated():
            return
        days = random.choice([7, 30, 90])
        self.client.get(
            f"/api/v1/error-logs/stats?days={days}",
            headers=self._get_auth_headers(),
            name="/api/v1/error-logs/stats"
        )

    @task(1)
    def get_error_log_levels(self):
        """Get available error log levels."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/error-logs/levels",
            headers=self._get_auth_headers(),
            name="/api/v1/error-logs/levels"
        )

    @task(1)
    def get_error_log_types(self):
        """Get error types."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/error-logs/types",
            headers=self._get_auth_headers(),
            name="/api/v1/error-logs/types"
        )

    @task(1)
    def list_error_log_archives(self):
        """List archived error log files."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/error-logs/archives",
            headers=self._get_auth_headers(),
            name="/api/v1/error-logs/archives"
        )

    # ==================== API Configs Endpoints ====================

    @task(2)
    def list_api_configs(self):
        """List API configurations."""
        if not self._is_authenticated():
            return
        page = random.randint(0, 3)
        self.client.get(
            f"/api/v1/api-configs?page={page}&limit=25",
            headers=self._get_auth_headers(),
            name="/api/v1/api-configs"
        )

    @task(1)
    def get_api_config_tags(self):
        """Get API config tags."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/api-configs/tags",
            headers=self._get_auth_headers(),
            name="/api/v1/api-configs/tags"
        )

    @task(1)
    def get_api_config_count(self):
        """Get API config count."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/api-configs/count",
            headers=self._get_auth_headers(),
            name="/api/v1/api-configs/count"
        )

    # ==================== Distribution Lists Endpoints ====================

    @task(2)
    def list_distribution_lists(self):
        """List distribution lists."""
        if not self._is_authenticated():
            return
        page = random.randint(0, 3)
        self.client.get(
            f"/api/v1/distribution-lists?page={page}&limit=25",
            headers=self._get_auth_headers(),
            name="/api/v1/distribution-lists"
        )

    @task(1)
    def get_distribution_list_count(self):
        """Get distribution list count."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/distribution-lists/count",
            headers=self._get_auth_headers(),
            name="/api/v1/distribution-lists/count"
        )

    # ==================== Export Endpoints ====================

    @task(1)
    def get_export_formats(self):
        """Get available export formats."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/export/formats",
            headers=self._get_auth_headers(),
            name="/api/v1/export/formats"
        )

    # ==================== Dashboard Endpoints ====================

    @task(3)
    def get_dashboard_stats(self):
        """Get dashboard statistics."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/dashboard/stats",
            headers=self._get_auth_headers(),
            name="/api/v1/dashboard/stats"
        )

    @task(2)
    def get_dashboard_summary(self):
        """Get dashboard summary."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/dashboard/summary",
            headers=self._get_auth_headers(),
            name="/api/v1/dashboard/summary"
        )

    @task(1)
    def get_recent_logins(self):
        """Get recent logins."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/dashboard/recent-logins",
            headers=self._get_auth_headers(),
            name="/api/v1/dashboard/recent-logins"
        )

    @task(1)
    def get_analytics(self):
        """Get analytics."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/dashboard/analytics",
            headers=self._get_auth_headers(),
            name="/api/v1/dashboard/analytics"
        )

    # ==================== Admin Management Endpoints ====================

    @task(2)
    def admin_list_users(self):
        """Admin: List users."""
        if not self._is_authenticated():
            return
        self.client.get(
            "/api/v1/admin/management/users",
            headers=self._get_auth_headers(),
            name="/api/v1/admin/management/users"
        )


class PublicEndpointUser(HttpUser):
    """
    Simulates anonymous users hitting public endpoints only.
    Useful for testing rate limiting and public API performance.
    """

    wait_time = between(0.5, 2)
    weight = 1  # Lower weight than authenticated users

    @task(10)
    def health_check(self):
        """Check API health."""
        self.client.get("/api/v1/health", name="/api/v1/health [public]")

    @task(5)
    def health_live(self):
        """Liveness probe."""
        self.client.get("/api/v1/health/live", name="/api/v1/health/live [public]")

    @task(5)
    def health_ready(self):
        """Readiness probe."""
        self.client.get("/api/v1/health/ready", name="/api/v1/health/ready [public]")

    @task(2)
    def get_csrf_token(self):
        """Get CSRF token."""
        self.client.get("/api/v1/auth/csrf-token", name="/api/v1/auth/csrf-token [public]")

    @task(1)
    def app_info(self):
        """Get app info."""
        self.client.get("/api/v1/info", name="/api/v1/info [public]")


class WriteOperationsUser(HttpUser):
    """
    Simulates users performing write operations (POST, PUT, DELETE).
    Lower frequency to avoid overwhelming the database.
    """

    wait_time = between(3, 8)
    weight = 1  # Lower weight - fewer write operations

    access_token = None
    csrf_token = None
    login_failed = False
    current_user = None

    def on_start(self):
        """Login before performing write operations."""
        self.current_user = get_next_user()
        self._get_csrf_token()
        self._login()

    def _get_csrf_token(self):
        """Fetch CSRF token from cookie."""
        response = self.client.get("/api/v1/auth/csrf-token")
        if response.status_code == 200:
            self.csrf_token = response.cookies.get("csrf_token")
            if not self.csrf_token:
                self.csrf_token = response.json().get("csrf_token")

    def _login(self):
        """Login to get JWT token using assigned user credentials."""
        login_data = {
            "email": self.current_user["email"],
            "password": self.current_user["password"]
        }
        headers = {"Content-Type": "application/json"}
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token

        response = self.client.post(
            "/api/v1/auth/login",
            json=login_data,
            headers=headers
        )
        if response.status_code == 200:
            self.access_token = response.json().get("access_token")
            self.login_failed = False
        else:
            self.login_failed = True

    def _get_auth_headers(self):
        """Get headers with authentication."""
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token
        return headers

    def _is_authenticated(self):
        """Check if user is authenticated."""
        return self.access_token is not None and not self.login_failed

    @task(2)
    def update_profile(self):
        """Update user profile."""
        if not self._is_authenticated():
            return
        update_data = {
            "first_name": f"Test_{random.randint(1, 1000)}",
            "last_name": "User"
        }
        self.client.put(
            "/api/v1/auth/profile",
            json=update_data,
            headers=self._get_auth_headers(),
            name="/api/v1/auth/profile [PUT]"
        )

    @task(1)
    def create_feedback(self):
        """Create feedback entry."""
        if not self._is_authenticated():
            return
        # Schema matches FeedbackCreate model: rating, improvements, suggestions, email
        feedback_data = {
            "rating": random.randint(1, 5),
            "improvements": f"Load test improvement suggestion {random.randint(1, 10000)}",
            "suggestions": "This is a load test generated feedback entry."
        }
        self.client.post(
            "/api/v1/feedback",
            json=feedback_data,
            headers=self._get_auth_headers(),
            name="/api/v1/feedback [POST]"
        )


# Event hooks for custom reporting
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when test starts."""
    print("=" * 60)
    print("Admin Panel API Load Test Starting")
    print("=" * 60)
    if isinstance(environment.runner, MasterRunner):
        print("Running in distributed mode (master)")
    else:
        print("Running in standalone mode")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when test stops."""
    print("=" * 60)
    print("Admin Panel API Load Test Completed")
    print("=" * 60)
