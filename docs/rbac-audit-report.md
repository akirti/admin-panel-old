# Backend RBAC Access Control Audit Report

**Date**: 2026-02-24
**Auditor**: backend-tester
**Scope**: All route files in `backend/src/easylifeauth/api/`

---

## Access Control Reference

| Dependency | Allowed Roles |
|---|---|
| `get_current_user` | Any authenticated user |
| `require_admin` | administrator, super-administrator |
| `require_super_admin` | super-administrator only |
| `require_admin_or_editor` | administrator, super-administrator, editor, group-administrator, group-editor |
| `require_group_admin` | administrator, super-administrator, group-administrator, group-editor |

---

## CRITICAL Issues

### 1. Open User Registration - No Access Control
- **File**: `auth_routes.py:81-104`
- **Endpoint**: `POST /auth/register`
- **Issue**: The registration endpoint has NO authentication required. Anyone can register a new user account. The `UserRegister` model accepts `roles`, `groups`, and `domains` fields, meaning an attacker could self-register with arbitrary roles (including `super-administrator`), groups, and domain access.
- **Severity**: CRITICAL
- **Suggested Fix**: Either remove public registration entirely, or strip `roles`/`groups`/`domains` from the registration payload and assign default values (e.g., `viewer` role only). If self-registration is needed, add an admin-approval workflow.

### 2. Scenario Request Update - No Ownership Check
- **File**: `scenario_request_routes.py:164-182`
- **Endpoint**: `PUT /ask_scenarios/{request_id}`
- **Issue**: Any authenticated user can update ANY scenario request, not just their own. The endpoint uses `get_current_user` but passes `current_user` to the service without validating the user owns the request. A regular user could modify another user's scenario request.
- **Severity**: CRITICAL
- **Suggested Fix**: Add ownership check - verify `request.user_id == current_user.user_id` before allowing update, or require admin/editor role for updating others' requests.

---

## HIGH Issues

### 3. Jira Endpoints - Missing Admin Checks for Destructive Actions
- **File**: `jira_routes.py` (multiple endpoints)
- **Endpoints**:
  - `POST /jira/tasks/create` (line 110-182) - Any user can create Jira tickets
  - `POST /jira/tasks/transition` (line 185-203) - Any user can transition ticket statuses
  - `POST /jira/attachments/add` (line 206-229) - Any user can add attachments
  - `POST /jira/sync/request/{request_id}` (line 294-364) - Any user can sync requests to Jira
- **Issue**: All Jira write operations use only `get_current_user`. Any authenticated user (even a `viewer`) can create tickets, transition statuses, add attachments, and sync data to Jira. These should require at least `require_admin_or_editor`.
- **Severity**: HIGH
- **Suggested Fix**: Change `get_current_user` to `require_admin_or_editor` for all write operations (create, transition, add attachment, sync). Read-only endpoints (list projects, get tasks) can remain at `get_current_user`.

### 4. API Config Read Endpoints - Sensitive Data Exposure
- **File**: `api_config_routes.py:31-64, 67-75, 78-85, 88-101, 104-117`
- **Endpoints**: `GET /api-configs`, `GET /api-configs/count`, `GET /api-configs/tags`, `GET /api-configs/{config_id}`, `GET /api-configs/key/{key}`
- **Issue**: All read endpoints use `get_current_user`. API configurations may contain sensitive data such as API keys, authentication tokens, SSL certificate paths, endpoint URLs, and auth_config objects. Any authenticated user (including `viewer` role) can read all API configurations.
- **Severity**: HIGH
- **Suggested Fix**: Change read endpoints to `require_admin` or `require_super_admin`. If some configs need to be read by non-admins (e.g., prevail proxy), create a separate internal dependency.

### 5. Inconsistent User Delete Authorization
- **File**: `users_routes.py:426-463` vs `admin_routes.py:130-144`
- **Endpoints**: `DELETE /users/{user_id}` vs `DELETE /admin/management/users/{user_id}`
- **Issue**: Two separate endpoints for deleting users with different auth levels:
  - `/users/{user_id}` requires `require_group_admin` (allows group-editor)
  - `/admin/management/users/{user_id}` requires `require_super_admin`
  - A group-editor can bypass the stricter admin endpoint by using the users endpoint directly.
- **Severity**: HIGH
- **Suggested Fix**: Align both endpoints. User deletion should likely require `require_admin` or `require_super_admin`, not `require_group_admin`.

### 6. No Domain Scoping on User/Role/Group/Customer CRUD
- **Files**: `users_routes.py`, `roles_routes.py`, `groups_routes.py`, `customers_routes.py`
- **Issue**: All CRUD endpoints for users, roles, groups, and customers use `require_group_admin` but do NOT filter results by the current user's domain. A group-administrator from Domain A can:
  - View ALL users across ALL domains
  - Create/update/delete users in Domain B
  - View/modify roles and groups from other domains
  - View/modify customers they shouldn't access
- **Severity**: HIGH
- **Suggested Fix**: Add domain-based filtering. Group-admins should only see/manage entities within their resolved domains. Super-admins can manage all.

### 7. Scenario Request File Operations - No Ownership Check
- **File**: `scenario_request_routes.py:220-317`
- **Endpoints**:
  - `POST /ask_scenarios/{request_id}/files` (line 220) - upload files
  - `GET /ask_scenarios/{request_id}/files/{file_path}/preview` (line 270) - preview files
  - `GET /ask_scenarios/{request_id}/files/{file_path}/download` (line 289) - download files
- **Issue**: Any authenticated user can upload files to, preview, and download files from ANY scenario request, regardless of ownership. This could allow unauthorized file access and data exfiltration.
- **Severity**: HIGH
- **Suggested Fix**: Add ownership validation - the current user should be the request creator, or have admin/editor role.

---

## MEDIUM Issues

### 8. Distribution List Email Addresses Readable by Any User
- **File**: `distribution_list_routes.py:112-147`
- **Endpoints**:
  - `GET /distribution-lists/by-key/{key}` (line 112) - `get_current_user`
  - `GET /distribution-lists/by-type/{list_type}` (line 128) - `get_current_user`
  - `GET /distribution-lists/emails/{key}` (line 139) - `get_current_user`
  - `GET /distribution-lists/{list_id}` (line 150) - `get_current_user`
- **Issue**: Any authenticated user can read all distribution lists and email addresses. Write operations properly require `require_super_admin`, but read access is too permissive.
- **Severity**: MEDIUM
- **Suggested Fix**: Change to `require_admin` or at minimum `require_group_admin` for these read endpoints.

### 9. Feedback Update - No Ownership Check
- **File**: `feedback_routes.py:121-135`
- **Endpoint**: `PUT /feedback/{feedback_id}`
- **Issue**: Any authenticated user can update ANY feedback entry. No check that the user owns the feedback they're updating.
- **Severity**: MEDIUM
- **Suggested Fix**: Add ownership check or require admin role.

### 10. Feedback Admin Endpoints - Inconsistent Access Control Pattern
- **File**: `feedback_routes.py:33-101`
- **Endpoints**: `GET /feedback/stats`, `GET /feedback/admin/list`
- **Issue**: These endpoints use `get_current_user` plus inline admin role checks against `["super-administrator", "administrator"]` instead of using the standard `require_admin` dependency. This creates inconsistency with the rest of the codebase and makes it harder to maintain a unified access control policy.
- **Severity**: MEDIUM
- **Suggested Fix**: Replace inline checks with `require_admin` dependency.

### 11. Scenario Create/Update - No Domain Access Verification
- **File**: `scenario_routes.py:101-137`
- **Endpoints**: `POST /scenarios`, `PUT /scenarios/{key}`
- **Issue**: These endpoints use `require_admin_or_editor` but don't verify the user has access to the domain they're creating/updating the scenario in. An editor could create or modify scenarios in domains they don't have access to.
- **Severity**: MEDIUM
- **Suggested Fix**: Add domain access check - verify the scenario's `dataDomain` is in the user's resolved domains.

### 12. Scenario Request View - No Ownership/Access Check
- **File**: `scenario_request_routes.py:206-217`
- **Endpoint**: `GET /ask_scenarios/{request_id}`
- **Issue**: Any authenticated user can view any scenario request by ID. While the list endpoint (`/all`) properly filters by user role, the detail endpoint doesn't validate ownership or access.
- **Severity**: MEDIUM
- **Suggested Fix**: Add ownership check or require admin/editor to view others' requests.

### 13. Group-Editor Can Reset User Passwords
- **File**: `users_routes.py:541-581`
- **Endpoints**: `POST /users/{user_id}/reset-password`, `POST /users/{user_id}/send-password-reset`
- **Issue**: These sensitive operations use `require_group_admin`, allowing group-editors to reset passwords. The temp password is returned in the response body when `send_email=false` (line 581), which means a group-editor could reset any user's password and obtain the new password.
- **Severity**: MEDIUM
- **Suggested Fix**: Restrict to `require_admin` or `require_super_admin`. At minimum, don't return temp passwords in the response.

---

## LOW Issues

### 14. Health Metrics Endpoint Exposes System Info Without Auth
- **File**: `health_routes.py:227-234`
- **Endpoint**: `GET /health/metrics`
- **Issue**: Exposes detailed system metrics (CPU usage, memory, disk, process info, network I/O) without any authentication. This information could help an attacker profile the system.
- **Severity**: LOW
- **Suggested Fix**: Add `require_super_admin` or at least `get_current_user` to the metrics endpoint. Keep `/health/live` and `/health/ready` unauthenticated for monitoring probes.

### 15. Health Detailed Endpoint Exposes Host IP
- **File**: `health_routes.py:159`
- **Endpoint**: `GET /health?detailed=true`
- **Issue**: When `detailed=true`, the response includes `request.client.host` (the client's IP). This is low risk but worth noting.
- **Severity**: LOW

### 16. `require_admin` Dependency Is Never Used
- **File**: `access_control.py:158-165`
- **Issue**: The `require_admin` dependency function is defined but never imported or used in any route file. All admin-level endpoints use either `require_group_admin` (which is more permissive) or `require_super_admin` (which is more restrictive). This suggests a gap in the permission hierarchy.
- **Severity**: LOW (informational)
- **Suggested Fix**: Review whether some `require_group_admin` endpoints should use `require_admin` instead, especially for destructive operations like user deletion and password resets.

### 17. Bare except Clauses in ID Lookups
- **Files**: Multiple route files (users_routes.py, roles_routes.py, groups_routes.py, etc.)
- **Issue**: Many endpoints use bare `except:` clauses when trying to parse ObjectId, falling back to string-based lookups. Example: `users_routes.py:291-292`. While not strictly an RBAC issue, bare excepts could mask errors and make debugging harder.
- **Severity**: LOW
- **Suggested Fix**: Use `except (InvalidId, Exception):` or better yet, `except Exception:` with proper logging.

---

## Summary

| Severity | Count | Description |
|---|---|---|
| CRITICAL | 2 | Open registration with role assignment; No ownership check on request updates |
| HIGH | 5 | Jira endpoints missing auth; API config data exposure; Inconsistent delete auth; No domain scoping; File operations no ownership |
| MEDIUM | 6 | Distribution list exposure; Feedback ownership; Inline access control; Scenario domain check; Request view access; Password reset scope |
| LOW | 4 | Health metrics exposure; Unused dependency; Bare excepts; Host IP leak |

### Password Hash Protection: PASS
All user-facing endpoints properly exclude `password_hash` via `.pop("password_hash", None)` or MongoDB projection `{"password_hash": 0}`.

### Domain Filtering on Read Endpoints: PARTIAL
- Scenarios, playboards, domain-scenarios: Properly filter by user's domains
- Users, roles, groups, customers: NO domain filtering - any group-admin sees everything

### Endpoint Coverage Check:
- **17 route files audited** (excluding models.py and __init__.py)
- **~150+ endpoints reviewed**
- All endpoints mapped to their access control dependencies
