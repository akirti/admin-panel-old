# EasyLife Admin Panel - Postman Collection

## Quick Start

1. **Import the collection** into Postman:
   - Open Postman > Import > Upload Files
   - Select `EasyLife-Admin-Panel.postman_collection.json`

2. **Import the environment**:
   - Open Postman > Environments > Import
   - Select `EasyLife-Local.postman_environment.json`
   - Update `admin_email` and `admin_password` with valid credentials

3. **Select the environment** from the dropdown in the top-right corner

4. **Login first**: Run `Authentication > Login` - tokens are auto-saved

## Collection Structure

| Folder | Endpoints | Auth Level | Description |
|--------|-----------|------------|-------------|
| Health | 5 | None | Health checks, liveness, readiness probes |
| Authentication | 10 | Mixed | Login, register, password management |
| Dashboard | 4 | group-admin+ | Statistics and analytics |
| Users | 9 | group-admin+ | User CRUD, status toggle |
| Roles | 8 | group-admin+ | Role CRUD with permission resolution |
| Groups | 9 | group-admin+ | Group CRUD with domain resolution |
| Permissions | 5 | super-admin | Permission CRUD |
| Domains | 10 | super-admin | Domain and subdomain management |
| Scenarios | 6 | Mixed | Scenario CRUD |
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
| Distribution Lists | 2 | super-admin | Email distribution lists |

## Authentication Flow

```
POST /auth/login  -->  access_token + refresh_token (auto-saved)
                            |
                    Bearer {{access_token}} on all requests
                            |
                   Token expires (15min default)
                            |
POST /auth/refresh -->  new access_token (auto-saved)
```

The collection uses **Bearer token** auth at the collection level. After login, all requests automatically include the token.

## Environment Variables

| Variable | Description | Auto-Set |
|----------|-------------|----------|
| `base_url` | Backend URL (default: http://localhost:8000) | No |
| `api_prefix` | API version prefix (/api/v1) | No |
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
- **Create entities in order**: Domains > Scenarios > Playboards (parent-child relationships)
- **Test IDs auto-save**: Creating a user/role/group/domain saves its ID for subsequent requests
- Use the **Postman Runner** to execute entire folders sequentially for integration testing
