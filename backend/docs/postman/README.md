# EasyLife Admin Panel - Postman Collection

## Quick Start

1. **Import the collection** into Postman:
   - Open Postman > Import > Upload Files
   - Select `EasyLife-Admin-Panel.postman_collection.json`

2. **Import an environment**:
   - Open Postman > Environments > Import
   - Select one of:
     - `EasyLife-Local.postman_environment.json` (local development)
     - `EasyLife-QA-Apigee.postman_environment.json` (QA via Apigee)
     - `EasyLife-STG-Apigee.postman_environment.json` (STG via Apigee)
   - Update `admin_email` and `admin_password` with valid credentials

3. **Select the environment** from the dropdown in the top-right corner

4. **Login first**: Run `Authentication > Login` - tokens are auto-saved

## Two-Tier Routing

The API uses two tiers of routing:

| Tier | Endpoints | URL Pattern | Auth |
|------|-----------|-------------|------|
| Infrastructure | Health, docs, info | `{{base_url}}/health/*`, `{{base_url}}/docs` | None |
| Business API | All other endpoints | `{{base_url}}{{api_prefix}}/*` | JWT Bearer |

Health and documentation endpoints are at the **root** (no `/api/v1` prefix). All business endpoints are under `/api/v1`.

## JWT Standard Claims

Tokens now include RFC 7519 standard claims:

| Claim | Value | Purpose |
|-------|-------|---------|
| `sub` | `access_token` / `refresh_token` | Subject (token type) |
| `iss` | `easylife-auth` | Issuer |
| `aud` | `easylife-api` | Audience |

These are validated by both the backend and the Apigee proxy (`JWT-VerifyAccessToken` policy).

## Collection Structure

| Folder | Endpoints | Auth Level | Description |
|--------|-----------|------------|-------------|
| Health | 8 | None | Health checks, probes, docs, OpenAPI spec |
| Authentication | 10 | Mixed | Login, register, password management |
| Dashboard | 4 | group-admin+ | Statistics and analytics |
| Users | 9 | group-admin+ | User CRUD, status toggle |
| Roles | 8 | group-admin+ | Role CRUD with permission resolution |
| Groups | 9 | group-admin+ | Group CRUD with domain resolution |
| Permissions | 5 | super-admin | Permission CRUD |
| Domains | 10 | super-admin | Domain and subdomain management |
| Scenarios | 6 | Mixed | Scenario CRUD |
| Domain Scenarios | 5 | Mixed | Domain-specific scenario management |
| Playboards | 5 | Mixed | Playboard management |
| Scenario Requests | 8 | Mixed | Ask Scenario workflow |
| Feedback | 4 | Mixed | Feedback submission and admin view |
| Customers | 3 | group-admin+ | Customer management |
| Jira Integration | 7 | Mixed | Jira project/task management |
| Export | 4 | super-admin | CSV/JSON data export |
| Bulk Upload | 3 | super-admin | CSV/Excel bulk import |
| Activity Logs | 4 | super-admin | Audit trail |
| Error Logs | 4 | super-admin | Error monitoring |
| Admin Management | 5 | group-admin+ | User role/group/domain assignment |
| Configurations | 3 | super-admin | App configuration management |
| API Configs | 3 | super-admin | External API configuration |
| Prevail Proxy | 1 | JWT required | Scenario execution proxy |
| Distribution Lists | 2 | super-admin | Email distribution lists |

## Environments

### Local Development
- **base_url**: `http://localhost:8000`
- Direct backend access (no Apigee proxy)
- Health at `http://localhost:8000/health/*`
- API at `http://localhost:8000/api/v1/*`

### QA (Apigee)
- **base_url**: `https://api.qa.localhost.net/easylife/v1`
- All traffic routed through Apigee proxy
- JWT verified by Apigee (`JWT-VerifyAccessToken` policy)
- Rate limiting and quota enforced by Apigee

### STG (Apigee)
- **base_url**: `https://api.stage.localhost.net/easylife/v1`
- Same as QA but against staging backend

## Authentication Flow

```
POST /api/v1/auth/login  -->  access_token + refresh_token (auto-saved)
                                    |
                            Bearer {{access_token}} on all requests
                                    |
                           Token expires (15min default)
                                    |
POST /api/v1/auth/refresh -->  new access_token (auto-saved)
```

The collection uses **Bearer token** auth at the collection level. After login, all requests automatically include the token.

## Environment Variables

| Variable | Description | Auto-Set |
|----------|-------------|----------|
| `base_url` | Backend or Apigee URL | No |
| `api_prefix` | API version prefix (`/api/v1`) | No |
| `access_token` | JWT access token | Yes (on login) |
| `refresh_token` | JWT refresh token | Yes (on login) |
| `admin_email` | Admin email for login | No |
| `admin_password` | Admin password for login | No |
| `test_user_id` | Last created user ID | Yes (on create) |
| `test_role_id` | Last created role ID | Yes (on create) |
| `test_group_id` | Last created group ID | Yes (on create) |
| `test_domain_id` | Last created domain ID | Yes (on create) |

## Role Hierarchy (7 tiers)

1. **super-administrator** - Full system access
2. **administrator** - Admin panel access
3. **group-admin** - Group-level management
4. **editor** - Content editing
5. **analyst** - Data analysis/viewing
6. **user** - Basic access
7. **viewer** - Read-only access

## Disabled Query Parameters

Many requests include disabled query parameters (shown in gray in Postman). Enable them to apply filters:
- `status` - Filter by active/inactive
- `search` - Text search
- `domain` / `permission` - Filter by domain or permission
- `page` / `limit` - Pagination controls

## Tips

- **Run Login first** after importing - all other requests depend on the token
- **Create entities in order**: Domains > Scenarios > Domain Scenarios > Playboards (parent-child relationships)
- **Test IDs auto-save**: Creating a user/role/group/domain saves its ID for subsequent requests
- **Health endpoints work without auth** - use them to verify connectivity before login
- Use the **Postman Runner** to execute entire folders sequentially for integration testing
- When using Apigee environments, ensure your Apigee KVM has the correct CORS origins configured
