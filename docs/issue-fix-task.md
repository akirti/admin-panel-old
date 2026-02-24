# Issue Fix Task List

**Date**: 2026-02-24
**Status**: Prioritized by severity. Fix in order.

---

## CRITICAL Fixes (Do First)

### [x] FIX-C1: Strip roles/groups/domains from self-registration
- **File**: `backend/src/easylifeauth/api/auth_routes.py:81-104`
- **Action**: In the register endpoint, ignore any `roles`, `groups`, `domains` from the request body. Always set defaults: `roles=["user"]`, `groups=["viewer"]`, `domains=[]`.
- **Status**: PENDING

### [ ] FIX-C2: Add ownership check to scenario request update
- **File**: `backend/src/easylifeauth/api/scenario_request_routes.py:164-182`
- **Action**: Before updating, verify `request.created_by == current_user.email` OR user has editor+ role. Same for file operations (lines 220-317) and detail view (line 206).
- **Status**: PENDING

### [ ] FIX-C3: Add role hierarchy validation to PUT /users/{user_id}
- **File**: `backend/src/easylifeauth/api/users_routes.py:373-423`
- **Action**: Before writing roles, check that the current user has permission to assign those roles (similar to `admin_service._check_role_assignment_permission()`). Group-admins should NOT be able to assign admin/super-admin roles.
- **Status**: PENDING

### [ ] FIX-C4: Narrow CSRF exemption to only login/register/refresh
- **File**: `backend/src/easylifeauth/app.py:169-171`
- **Action**: Change exempt_paths from `"/api/v1/auth/*"` to specific paths: `{"/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh", "/api/v1/auth/csrf-token", "/api/v1/auth/forgot_password", "/api/v1/auth/reset_password"}`.
- **Status**: PENDING

### [ ] FIX-C5: Fix token validation timestamp logic
- **File**: `backend/src/easylifeauth/services/token_manager.py:170-175`
- **Action**: Remove the redundant custom expiry checks on lines 170-175. PyJWT already handles expiry via `ExpiredSignatureError`. The custom logic is flawed (compares access exp with refresh expiry).
- **Status**: PENDING

### [ ] FIX-C6: Sanitize HTML in RequestDetailPage
- **File**: `frontend/src/pages/user/RequestDetailPage.jsx:312, 320, 343, 509`
- **Action**: Install DOMPurify (`npm install dompurify`). Replace all `dangerouslySetInnerHTML={{ __html: content }}` with `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}`.
- **Status**: PENDING

### [ ] FIX-C7: Restrict user deletion to require_admin
- **File**: `backend/src/easylifeauth/api/users_routes.py:426-463`
- **Action**: Change `require_group_admin` to `require_admin` for DELETE endpoint. Group-editors/group-admins should not delete users.
- **Status**: PENDING

---

## HIGH Fixes

### [ ] FIX-H1: Add require_admin_or_editor to Jira write endpoints
- **File**: `backend/src/easylifeauth/api/jira_routes.py`
- **Action**: Change `get_current_user` to `require_admin_or_editor` on: `POST /jira/tasks/create`, `POST /jira/tasks/transition`, `POST /jira/attachments/add`, `POST /jira/sync/request/{id}`.
- **Status**: PENDING

### [ ] FIX-H2: Restrict API config read endpoints to admin
- **File**: `backend/src/easylifeauth/api/api_config_routes.py:31-117`
- **Action**: Change `get_current_user` to `require_admin` on all GET endpoints (list, count, tags, get by id, get by key).
- **Status**: PENDING

### [ ] FIX-H3: Align user delete to require_admin on both endpoints
- **File**: `backend/src/easylifeauth/api/users_routes.py:426` (covered by FIX-C7)
- **Status**: PENDING (merged with FIX-C7)

### [ ] FIX-H4: Add domain scoping to group-admin CRUD operations
- **Files**: `users_routes.py`, `roles_routes.py`, `groups_routes.py`, `customers_routes.py`
- **Action**: For group-admin users, filter list results by current_user.domains. For create/update/delete, verify the target entity's domains overlap with current_user.domains.
- **Status**: PENDING

### [ ] FIX-H5: Add ownership check to scenario request file operations
- **File**: `backend/src/easylifeauth/api/scenario_request_routes.py:220-317`
- **Action**: Verify request creator == current_user OR user is editor+. (Part of FIX-C2)
- **Status**: PENDING (merged with FIX-C2)

### [ ] FIX-H6: Set explicit CORS origins
- **File**: `backend/src/easylifeauth/app.py:146-154`
- **Action**: Change default `cors_origins` from `["*"]` to `["http://localhost:3000", "http://localhost:5173"]` (or read from environment variable).
- **Status**: PENDING

### [ ] FIX-H7: Escape regex in all search parameters
- **Files**: `users_routes.py:129`, `domain_routes.py:150`, `groups_routes.py:153`, `permissions_routes.py:46`, `domain_scenarios_routes.py:108`, `activity_log_routes.py:63`, `playboard_routes.py:127`, `roles_routes.py`, `customers_routes.py`, `feedback_service.py:157`, `error_log_service.py:434`
- **Action**: Add `import re` and wrap all search params: `re.escape(search)` before passing to `$regex`.
- **Status**: PENDING

### [ ] FIX-H8: Remove temp password from API response
- **File**: `backend/src/easylifeauth/api/users_routes.py:579-581`
- **Action**: Remove `"temp_password": temp_password` from response. Always require email delivery for password resets.
- **Status**: PENDING

### [ ] FIX-H9: Fix resolve_domains field name
- **File**: `backend/src/easylifeauth/api/groups_routes.py:68`
- **Action**: Change `db.domains.find_one({"domainId": ref})` to `db.domains.find_one({"key": ref})`.
- **Status**: PENDING

### [ ] FIX-H10: Fix token refresh to resolve domains from groups/roles
- **File**: `backend/src/easylifeauth/services/token_manager.py:187-203`
- **Action**: Import `UserService` or pass resolved domains. Before calling `generate_tokens()`, resolve user domains from groups/roles same as `login_user` does.
- **Status**: PENDING

### [ ] FIX-H11: Standardize domain field in playboard routes
- **File**: `backend/src/easylifeauth/api/playboard_routes.py:98`
- **Action**: Change `scenario_query["domainKey"]` to `scenario_query["dataDomain"]` to match scenario_routes.py.
- **Status**: PENDING

### [ ] FIX-H12: Fix register to resolve domains from assigned groups
- **File**: `backend/src/easylifeauth/services/user_service.py:234-239`
- **Action**: Call `resolve_user_domains(user_data)` before `generate_tokens()`.
- **Status**: PENDING

---

## MEDIUM Fixes

### [ ] FIX-M1: Validate domain/permission/customer refs in group create/update
- **File**: `backend/src/easylifeauth/api/groups_routes.py:42-44, 72-73, 101`
- **Action**: Log warnings for unresolved references. Optionally reject invalid refs with 400 error.
- **Status**: PENDING

### [ ] FIX-M2: Restrict distribution list read to require_group_admin
- **File**: `backend/src/easylifeauth/api/distribution_list_routes.py:112-147`
- **Action**: Change `get_current_user` to `require_group_admin` on read endpoints.
- **Status**: PENDING

### [ ] FIX-M3: Add ownership check to feedback update
- **File**: `backend/src/easylifeauth/api/feedback_routes.py:121-135`
- **Action**: Verify feedback creator == current_user OR user is admin.
- **Status**: PENDING

### [ ] FIX-M4: Use standard require_admin for feedback admin endpoints
- **File**: `backend/src/easylifeauth/api/feedback_routes.py:33-101`
- **Action**: Replace inline role checks with `require_admin` dependency.
- **Status**: PENDING

### [ ] FIX-M5: Add domain access check to scenario create/update
- **File**: `backend/src/easylifeauth/api/scenario_routes.py:101-137`
- **Action**: After `require_admin_or_editor`, verify the scenario's `dataDomain` is in user's resolved domains.
- **Status**: PENDING

### [ ] FIX-M6: Restrict password reset to require_admin
- **File**: `backend/src/easylifeauth/api/users_routes.py:541-581`
- **Action**: Change `require_group_admin` to `require_admin`.
- **Status**: PENDING

### [ ] FIX-M7: Extract get_user_accessible_domains to shared util
- **Files**: `scenario_routes.py:16-30`, `domain_routes.py:22-36`, `playboard_routes.py:22-36`
- **Action**: Move to a shared module and import in all three files.
- **Status**: PENDING

### [ ] FIX-M8: Clean user.domains on domain deletion
- **File**: `backend/src/easylifeauth/api/domain_routes.py:290-327`
- **Action**: Add `await db.users.update_many({"domains": domain_key}, {"$pull": {"domains": domain_key}})`.
- **Status**: PENDING

### [ ] FIX-M9: Fix "All Domains" badge for empty domains
- **Files**: `frontend/src/pages/user/ProfilePage.jsx:188-193`, `frontend/src/pages/user/DashboardPage.jsx:341-344`
- **Action**: Change to show "No Domains Assigned" when domains list is empty (for non-admins).
- **Status**: PENDING

### [ ] FIX-M10: Fix hardcoded /admin/ path in ScenarioRequestsManagement
- **File**: `frontend/src/pages/admin/ScenarioRequestsManagement.jsx:388`
- **Action**: Use `useLocation()` to detect base path: `/admin` vs `/management`.
- **Status**: PENDING

---

## LOW Fixes (Nice to Have)

### [ ] FIX-L1: Filter None from ObjectId conversion arrays
- **File**: `backend/src/easylifeauth/services/user_service.py:124, 138`

### [ ] FIX-L2: Standardize scenario status to "active"/"inactive"
- **File**: `backend/src/easylifeauth/api/scenario_routes.py:55`

### [ ] FIX-L3: Add auth to health metrics endpoint
- **File**: `backend/src/easylifeauth/api/health_routes.py:227-234`

### [ ] FIX-L4: Replace bare except with except Exception
- **Files**: All route files with bare `except:` clauses

### [ ] FIX-L5: Use canAccessAdminPanel() or remove it
- **File**: `frontend/src/contexts/AuthContext.jsx:94-96`

### [ ] FIX-L6: Delete all reset tokens for user after successful reset
- **File**: `backend/src/easylifeauth/services/password_service.py:98`
- **Action**: Change to `delete_many({"user_id": reset_record["user_id"]})`.

### [ ] FIX-L7: Reduce validation error detail in production
- **File**: `backend/src/easylifeauth/app.py:219-242`

---

## Progress Tracking

| Priority | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 7 | 0 | 7 |
| HIGH | 12 | 0 | 12 |
| MEDIUM | 10 | 0 | 10 |
| LOW | 7 | 0 | 7 |
| **Total** | **36** | **0** | **36** |
