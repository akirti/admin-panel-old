# Admin Panel Backend Load Test

Locust-based load testing for the Admin Panel FastAPI backend.

## Installation

```bash
cd load-test
pip install -r requirements.txt
```

## Configuration

Before running, update the test credentials in `locustfile.py`:

```python
login_data = {
    "email": "admin@example.com",  # Update with valid credentials
    "password": "admin123"
}
```

## Running Load Tests

### Web UI Mode (Recommended for first-time)

```bash
locust -f locustfile.py --host=http://localhost:8000
```

Then open http://localhost:8089 in your browser and configure:
- Number of users: 100
- Spawn rate: 10 (users per second)

### Headless Mode (100 Concurrent Users)

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=100 \
    --spawn-rate=10 \
    --headless \
    --run-time=5m
```

### Quick Test (10 users for 1 minute)

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=10 \
    --spawn-rate=5 \
    --headless \
    --run-time=1m
```

### Generate HTML Report

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=100 \
    --spawn-rate=10 \
    --headless \
    --run-time=5m \
    --html=report.html
```

### Generate CSV Reports

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=100 \
    --spawn-rate=10 \
    --headless \
    --run-time=5m \
    --csv=results
```

This creates:
- `results_stats.csv` - Request statistics
- `results_failures.csv` - Failed requests
- `results_stats_history.csv` - Stats over time

## User Classes

The load test includes 3 user types:

| User Class | Weight | Description |
|------------|--------|-------------|
| `AdminPanelUser` | 3 | Authenticated admin users (most common) |
| `PublicEndpointUser` | 1 | Anonymous users hitting public endpoints |
| `WriteOperationsUser` | 1 | Users performing write operations |

## Tested Endpoints

### Public (No Auth)
- Health checks (`/api/v1/health/*`)
- CSRF token (`/api/v1/auth/csrf-token`)
- App info (`/api/v1/info`)

### Authenticated (JWT Required)
- User management (`/api/v1/users`)
- Roles (`/api/v1/roles`)
- Groups (`/api/v1/groups`)
- Permissions (`/api/v1/permissions`)
- Domains (`/api/v1/domains`)
- Scenarios (`/api/v1/scenarios`)
- Playboards (`/api/v1/playboards`)
- Customers (`/api/v1/customers`)
- Configurations (`/api/v1/configurations`)
- Dashboard (`/api/v1/dashboard`)
- Activity logs (`/api/v1/activity-logs`)
- Feedback (`/api/v1/feedback`)

## Interpreting Results

Key metrics to watch:
- **RPS (Requests/sec)**: Target throughput
- **Response Time (ms)**: 95th percentile should be < 500ms
- **Failure Rate**: Should be < 1%

## Distributed Testing

For higher loads, run distributed:

```bash
# Start master
locust -f locustfile.py --master --host=http://localhost:8000

# Start workers (run on multiple terminals/machines)
locust -f locustfile.py --worker --master-host=localhost
```
