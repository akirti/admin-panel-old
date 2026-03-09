# EasyLife Admin API - Apigee Proxy

Apigee API Proxy configuration for the EasyLife Admin Panel API. Provides rate limiting, JWT authentication, CORS, security headers, and request validation in front of the FastAPI backend.

## Structure

```
apigee/
├── apiproxy/
│   ├── easylife-admin-api.xml          # Proxy bundle descriptor
│   ├── proxies/
│   │   └── default.xml                  # Proxy endpoint (PreFlow, Flows, FaultRules)
│   ├── targets/
│   │   └── default.xml                  # Target endpoint (backend load balancer)
│   ├── policies/
│   │   ├── SA-RateLimit.xml             # Spike Arrest - rate limiting by client IP
│   │   ├── JWT-VerifyAccessToken.xml    # JWT token verification (HS256)
│   │   ├── Q-EnforceQuota.xml           # Quota enforcement by JWT user_id
│   │   ├── AM-AddCORSHeaders.xml        # CORS response headers
│   │   ├── RF-CORSPreflight.xml         # CORS OPTIONS preflight handling
│   │   ├── AM-AddSecurityHeaders.xml    # Security headers (HSTS, CSP, etc.)
│   │   ├── AM-SetTargetHeaders.xml      # Target request headers
│   │   ├── AM-*Response.xml             # Error response policies
│   │   ├── JS-Validate*.xml             # JavaScript request validation
│   │   └── JS-LogResponse.xml           # Response logging / analytics
│   └── resources/
│       └── jsc/
│           ├── validateLoginRequest.js   # Login payload validation
│           ├── validateRegisterRequest.js # Registration payload validation
│           ├── validateUserCreate.js      # User creation validation
│           ├── validateBulkUpload.js      # Bulk upload validation
│           └── logResponse.js            # Response logging script
└── README.md
```

## Security Architecture

This proxy is designed for a **browser-based SPA** (React frontend) that authenticates via **JWT tokens in httpOnly cookies**. API key verification is not used — the browser cannot securely store API keys.

### Authentication Flow

```
Browser → Apigee (/easylife/v1/*) → Backend (/api/v1/*)
   │                                      │
   ├─ POST /auth/login ──────────────────► Backend sets httpOnly JWT cookies
   ├─ GET /auth/csrf-token ──────────────► Backend sets CSRF cookie
   ├─ GET /users (with cookies) ─► JWT verified by Apigee ─► Backend
   └─ POST /auth/refresh ───────────────► Backend refreshes JWT cookies
```

### PreFlow Request Pipeline

Every request passes through these steps in order:

| Step | Policy | Condition | Purpose |
|------|--------|-----------|---------|
| 1 | `RF-CORSPreflight` | OPTIONS only | Return CORS headers, skip remaining steps |
| 2 | `SA-RateLimit` | Always | Spike arrest at 100 req/sec per client IP |
| 3 | `JWT-VerifyAccessToken` | Protected endpoints only | Verify HS256 JWT from Authorization header |
| 4 | `Q-EnforceQuota` | Authenticated endpoints only | 10,000 req/month per user_id |

### JWT-Exempt Endpoints (public access)

These endpoints skip JWT verification:

| Path | Purpose |
|------|---------|
| `POST /auth/login` | User login |
| `POST /auth/register` | User registration |
| `POST /auth/forgot_password` | Password reset request |
| `POST /auth/reset_password` | Password reset with token |
| `POST /auth/refresh` | Refresh expired access token |
| `POST /auth/logout` | User logout |
| `GET /auth/csrf-token` | Get CSRF token |
| `GET /health/**` | Health checks (liveness, readiness, metrics) |
| `GET /info` | Application info |
| `POST /feedback/public` | Anonymous feedback submission |
| `OPTIONS *` | CORS preflight requests |

### Quota-Exempt Endpoints

These endpoints skip quota enforcement (in addition to all JWT-exempt endpoints):

- `/health/**`, `/info` — Infrastructure probes
- `/auth/**` — All authentication endpoints
- `/feedback/public` — Anonymous feedback
- `OPTIONS` — CORS preflight

### Response Security Headers

Applied to all responses via PostFlow:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Request-Id: {messageid}`

## Endpoints

Base path: `/easylife/v1`

### Authentication (`/auth`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/csrf-token` | Get CSRF token |
| POST | `/auth/login` | User login (validates payload) |
| POST | `/auth/register` | User registration (validates payload) |
| POST | `/auth/refresh` | Refresh JWT access token |
| GET/PUT | `/auth/profile` | Get or update user profile |
| POST | `/auth/forgot_password` | Request password reset email |
| POST | `/auth/reset_password` | Reset password with token |
| POST | `/auth/update_password` | Update password (authenticated) |
| POST | `/auth/logout` | Logout user |

### Users (`/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users with pagination |
| GET | `/users/count` | Get users count |
| POST | `/users` | Create user (validates payload) |
| GET | `/users/me/assigned-customers` | Current user's assigned customers |
| GET | `/users/me/customer-tags` | Current user's customer tags |
| GET | `/users/{id}` | Get user by ID |
| PUT | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Delete user |
| POST | `/users/{id}/toggle-status` | Toggle user active/inactive |
| POST | `/users/{id}/send-password-reset` | Send password reset email |
| POST | `/users/{id}/reset-password` | Admin reset user password |

### Admin Management (`/admin/management`)
| Method | Path | Description |
|--------|------|-------------|
| * | `/admin/management/**` | Admin management operations (wildcard) |

### Roles (`/roles`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/roles` | List roles |
| GET | `/roles/count` | Get roles count |
| POST | `/roles` | Create role |
| POST | `/roles/{id}/toggle-status` | Toggle role status |
| GET | `/roles/{id}/users` | Get users with role |
| * | `/roles/{id}` | Get, update, or delete role |

### Groups (`/groups`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/groups` | List groups |
| GET | `/groups/count` | Get groups count |
| GET | `/groups/types` | Get group types |
| POST | `/groups` | Create group |
| POST | `/groups/{id}/toggle-status` | Toggle group status |
| GET | `/groups/{id}/users` | Get users in group |
| * | `/groups/{id}` | Get, update, or delete group |

### Permissions (`/permissions`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/permissions` | List permissions |
| GET | `/permissions/count` | Get permissions count |
| GET | `/permissions/modules` | Get permission modules |
| POST | `/permissions` | Create permission |
| GET | `/permissions/{id}/roles` | Get roles with permission |
| GET | `/permissions/{id}/groups` | Get groups with permission |
| * | `/permissions/{id}` | Get, update, or delete permission |

### Domains (`/domains`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/domains` | List domains with pagination |
| GET | `/domains/all` | Get all user-accessible domains |
| GET | `/domains/admin/all` | Get all domains (admin) |
| GET | `/domains/count` | Get domains count |
| GET | `/domains/types` | Get domain types |
| POST | `/domains` | Create domain |
| POST | `/domains/{id}/toggle-status` | Toggle domain status |
| * | `/domains/{id}/subdomains` | Add/remove subdomains |
| GET | `/domains/{id}/scenarios` | Get scenarios for domain |
| * | `/domains/{id}` | Get, update, or delete domain |

### Domain Scenarios (`/domain-scenarios`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/domain-scenarios` | List domain scenarios |
| GET | `/domain-scenarios/count` | Get count |
| POST | `/domain-scenarios` | Create domain scenario |
| POST | `/domain-scenarios/{id}/toggle-status` | Toggle status |
| * | `/domain-scenarios/{id}/subdomains` | Manage subdomains |
| GET | `/domain-scenarios/{id}/playboards` | Get playboards |
| * | `/domain-scenarios/{id}` | Get, update, or delete |

### Scenarios - Legacy (`/scenarios`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/scenarios/all`, `/scenarios/all/{domainKey}` | Get all / by domain |
| * | `/scenarios`, `/scenarios/{key}` | CRUD operations |

### Scenario Requests (`/ask_scenarios`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ask_scenarios/lookup/**` | Lookup data (statuses, types, domains, defaults, users) |
| GET | `/ask_scenarios/all` | List all scenario requests |
| POST | `/ask_scenarios` | Create scenario request |
| GET | `/ask_scenarios/{id}` | Get scenario request |
| PUT | `/ask_scenarios/{id}` | Update scenario request |
| PUT | `/ask_scenarios/{id}/admin` | Admin update |
| PUT | `/ask_scenarios/{id}/status` | Update status |
| POST | `/ask_scenarios/{id}/comment` | Add comment |
| POST | `/ask_scenarios/{id}/workflow` | Add workflow entry |
| POST | `/ask_scenarios/{id}/files` | Upload file |
| GET | `/ask_scenarios/{id}/files/**` | Preview/download files |
| POST | `/ask_scenarios/{id}/buckets` | Upload bucket file |

### Playboards (`/playboards`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/playboards` | List playboards |
| GET | `/playboards/count` | Get count |
| POST | `/playboards` | Create playboard |
| POST | `/playboards/upload` | Upload playboard JSON |
| POST | `/playboards/{id}/toggle-status` | Toggle status |
| GET | `/playboards/{id}/download` | Download playboard JSON |
| PUT | `/playboards/{id}/upload` | Update playboard JSON |
| * | `/playboards/{id}` | Get, update, or delete |

### Configurations (`/configurations`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/configurations` | List configurations |
| GET | `/configurations/count` | Get count |
| GET | `/configurations/types` | Get configuration types |
| POST | `/configurations` | Create configuration |
| POST | `/configurations/upload` | Upload configuration file |
| GET | `/configurations/gcs/status` | GCS storage status |
| GET | `/configurations/{id}/download` | Download configuration |
| GET | `/configurations/{id}/versions` | Get version history |
| * | `/configurations/{id}` | Get, update, or delete |

### API Configurations (`/api-configs`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api-configs` | List API configurations |
| GET | `/api-configs/count` | Get count |
| GET | `/api-configs/tags` | Get unique tags |
| POST | `/api-configs` | Create API configuration |
| POST | `/api-configs/test` | Test API configuration |
| GET | `/api-configs/gcs/status` | GCS storage status |
| GET | `/api-configs/key/{key}` | Get by key |
| POST | `/api-configs/{id}/toggle-status` | Toggle status |
| POST | `/api-configs/{id}/test` | Test by ID |
| POST | `/api-configs/{id}/upload-cert` | Upload certificate |
| * | `/api-configs/{id}` | Get, update, or delete |

### Customers (`/customers`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/customers` | List customers |
| GET | `/customers/count` | Get count |
| GET | `/customers/filters` | Get filter options |
| POST | `/customers` | Create customer |
| POST | `/customers/{id}/toggle-status` | Toggle status |
| GET | `/customers/{id}/users` | Get assigned users |
| POST | `/customers/{id}/assign-users` | Assign users |
| POST | `/customers/{id}/remove-users` | Remove users |
| * | `/customers/{id}` | Get, update, or delete |

### Feedback (`/feedback`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/feedback/public` | Submit anonymous feedback (no auth) |
| GET | `/feedback/stats` | Get feedback statistics |
| GET | `/feedback/all` | Get all feedback |
| GET | `/feedback/admin/list` | Admin paginated list |
| * | `/feedback`, `/feedback/{id}` | Create, get, or update |

### Dashboard (`/dashboard`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/stats` | Dashboard statistics |
| GET | `/dashboard/summary` | Detailed entity summary |
| GET | `/dashboard/recent-logins` | Recent login activity |
| GET | `/dashboard/analytics` | Analytics data |

### Activity Logs (`/activity-logs`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/activity-logs` | List activity logs |
| GET | `/activity-logs/stats` | Activity statistics |
| GET | `/activity-logs/actions` | Available action types |
| GET | `/activity-logs/entity-types` | Available entity types |
| DELETE | `/activity-logs/cleanup` | Cleanup old logs |
| GET | `/activity-logs/entity/{type}/{id}` | Entity history |
| GET | `/activity-logs/user/{email}` | User activity |

### Error Logs (`/error-logs`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/error-logs` | List error logs |
| GET | `/error-logs/stats` | Error statistics |
| GET | `/error-logs/levels` | Available log levels |
| GET | `/error-logs/types` | Distinct error types |
| GET | `/error-logs/current-file` | Current log file content |
| POST | `/error-logs/force-archive` | Force archive current file |
| DELETE | `/error-logs/cleanup` | Delete old archives |
| * | `/error-logs/archives/**` | List, download, delete archives |

### Bulk Upload (`/bulk`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/bulk/upload/{entity_type}` | Bulk upload (validates payload) |
| GET | `/bulk/template/{entity_type}` | Download upload template |
| * | `/bulk/gcs/**` | GCS status and file listing |

### Distribution Lists (`/distribution-lists`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/distribution-lists` | List distribution lists |
| GET | `/distribution-lists/types` | Get types |
| POST | `/distribution-lists` | Create distribution list |
| GET | `/distribution-lists/by-key/{key}` | Get by key |
| GET | `/distribution-lists/by-type/{type}` | Get by type |
| GET | `/distribution-lists/emails/{key}` | Get emails by key |
| POST | `/distribution-lists/{id}/toggle-status` | Toggle status |
| POST/DELETE | `/distribution-lists/{id}/emails` | Add/remove emails |
| * | `/distribution-lists/{id}` | Get, update, or delete |

### Jira Integration (`/jira`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/jira/status` | Connection status |
| GET | `/jira/projects`, `/jira/projects/latest` | Projects |
| * | `/jira/tasks/**` | My tasks, by request, create, transition |
| * | `/jira/attachments/**` | Add attachments |
| GET | `/jira/issue-types` | Issue types |
| GET | `/jira/statuses` | Workflow statuses |
| GET | `/jira/boards` | Boards / teams |
| GET | `/jira/assignable-users` | Assignable users |
| * | `/jira/sync/**` | Sync operations |

### Export (`/export`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/export/users/csv\|json` | Export users |
| GET | `/export/roles/csv\|json` | Export roles |
| GET | `/export/groups/csv\|json` | Export groups |
| GET | `/export/domains/csv\|json` | Export domains |
| GET | `/export/scenarios/csv\|json` | Export scenarios |
| GET | `/export/activity-logs/csv\|json` | Export activity logs |
| GET | `/export/customers/csv\|json` | Export customers |
| GET | `/export/permissions/csv\|json` | Export permissions |

### Prevail / Explorer (`/prevail`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/prevail/{scenario_key}` | Proxy query to Prevail service |

### Health & Info
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Comprehensive health check |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/metrics` | Detailed metrics (admin) |
| GET | `/info` | Application info |

## Deployment

### Prerequisites

1. Apigee Edge or Apigee X account
2. `apigeecli` or Apigee Management API access
3. Target servers configured in Apigee

### 1. Configure Target Servers

```bash
# Create backend target servers
apigeecli targetservers create \
  --name easylife-backend-1 \
  --host your-backend-host-1.com \
  --port 443 \
  --ssl true \
  --org YOUR_ORG \
  --env YOUR_ENV

apigeecli targetservers create \
  --name easylife-backend-2 \
  --host your-backend-host-2.com \
  --port 443 \
  --ssl true \
  --org YOUR_ORG \
  --env YOUR_ENV
```

### 2. Configure KVM (Key-Value Map)

Store the JWT secret used to verify access tokens:

```bash
apigeecli kvms create --name easylife-secrets --org YOUR_ORG --env YOUR_ENV
apigeecli kvms entries create \
  --map easylife-secrets \
  --key jwt.secret \
  --value "your-jwt-secret-key" \
  --org YOUR_ORG \
  --env YOUR_ENV
```

> The JWT secret must match the `AUTH_SECRET_KEY` used by the backend to sign tokens.

### 3. Deploy the Proxy

```bash
# Package and deploy
cd apigee/apiproxy
zip -r ../easylife-admin-api.zip .

apigeecli apis create \
  --name easylife-admin-api \
  --file ../easylife-admin-api.zip \
  --org YOUR_ORG

apigeecli apis deploy \
  --name easylife-admin-api \
  --rev 1 \
  --env YOUR_ENV \
  --org YOUR_ORG
```

Or using the Management API:

```bash
curl -X POST \
  "https://apigee.googleapis.com/v1/organizations/YOUR_ORG/apis?action=import&name=easylife-admin-api" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@easylife-admin-api.zip"
```

### 4. Updating After Changes

```bash
cd apigee/apiproxy
zip -r ../easylife-admin-api.zip .

apigeecli apis update \
  --name easylife-admin-api \
  --file ../easylife-admin-api.zip \
  --org YOUR_ORG

apigeecli apis deploy \
  --name easylife-admin-api \
  --rev LATEST \
  --env YOUR_ENV \
  --org YOUR_ORG
```

## Error Responses

All errors follow a consistent JSON format:

```json
{
  "error": "Error Type",
  "message": "Human-readable description",
  "code": "ERROR_CODE",
  "status": 401,
  "timestamp": "2024-12-08T12:00:00.000Z",
  "requestId": "abc-123-def-456"
}
```

| Code | Status | Trigger |
|------|--------|---------|
| `INVALID_JWT` | 401 | Missing, expired, or invalid JWT token |
| `QUOTA_EXCEEDED` | 429 | Monthly quota limit reached |
| `RATE_LIMIT_EXCEEDED` | 429 | Spike arrest triggered |
| `TARGET_UNAVAILABLE` | 503 | Backend unreachable |

## Target Configuration

The target endpoint uses a load balancer with two backend servers:

- Path rewrite: Apigee base `/easylife/v1` maps to backend `/api/v1`
- Connection timeout: 30s
- I/O timeout: 60s
- Keepalive: 60s
- Max failures before circuit break: 3
- Retry enabled: yes

## Unused Policy Files

The following policy files exist in `policies/` but are no longer referenced in the proxy flows. They can be safely removed:

- `VA-VerifyAPIKey.xml` — API key verification (removed; browser SPA uses JWT auth)
- `AM-InvalidAPIKeyResponse.xml` — API key error response (no longer triggered)

# How it is verifying JWT Token
 ┌─────────┬───────────────────┬───────────────────────────────────────────────┐
  │  Claim  │   Flow Variable   │                    Purpose                    │
  ├─────────┼───────────────────┼───────────────────────────────────────────────┤
  │ user_id │ jwt.user_id       │ Identifies the authenticated user             │
  ├─────────┼───────────────────┼───────────────────────────────────────────────┤
  │ email   │ jwt.email         │ User's email address                          │
  ├─────────┼───────────────────┼───────────────────────────────────────────────┤
  │ roles   │ jwt.roles (array) │ User's RBAC roles for authorization decisions │
  └─────────┴───────────────────┴───────────────────────────────────────────────┘

  What causes rejection

  The policy will reject the request (401) if any of these fail:
  1. No Authorization header present
  2. Signature doesn't match the secret key
  3. Token is expired (beyond 60s grace)
  4. sub is not "access_token"
  5. iss is not "easylife-auth"
  6. aud is not "easylife-api"
  7. Required claims (user_id, email, roles) are missing

  Security Note

  HS256 uses a symmetric shared secret - the same key signs and verifies. This means both the FastAPI backend (token issuer)
  and the Apigee gateway must share private.jwt.secret. If either is compromised, tokens can be forged. RS256 (asymmetric)
  would be more secure for production but requires key pair management.
