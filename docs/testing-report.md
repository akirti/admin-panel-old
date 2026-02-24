# EasyLife Admin Panel - Comprehensive Testing Report

**Date**: 2026-02-24
**Team**: 6-member testing team (team-lead, backend-tester, ui-tester, integration-tester, security-tester, unit-test-dev)
**Scope**: Roles, Permissions, Groups, Domains, Scenarios, Playboards - RBAC enforcement

---

## Executive Summary

Audited ~150+ backend endpoints across 17 route files and all major frontend components. Found **45 unique issues** after deduplication (8 CRITICAL, 14 HIGH, 13 MEDIUM, 10 LOW). The application has solid foundations (password hash protection, domain filtering on read endpoints, httpOnly cookies) but critical gaps in registration security, privilege escalation, and ownership validation.

### Scores

| Area | Score | Notes |
|------|-------|-------|
| Role Enforcement (Backend) | 5/10 | Many endpoints use wrong access level |
| Role Enforcement (Frontend) | 7/10 | Route guards work but UI lacks internal scoping |
| Domain Access Control | 6/10 | Read endpoints filter correctly; CRUD has no domain scoping |
| Group Integration | 6/10 | Works but token refresh misses group domains |
| Security | 4/10 | Critical: open registration, CSRF gaps, privilege escalation |
| Unit Test Coverage | 3/10 | 131 new tests added; existing coverage unknown |

---

## 1. CRITICAL Issues (8)

### C1. Self-Registration Allows Arbitrary Role Assignment
- **Source**: Backend Tester + Security Tester
- **File**: `auth_routes.py:81-104`, `models.py:9-16`
- **Description**: `POST /auth/register` accepts `roles`, `groups`, `domains` in request body. Anyone can register as `super-administrator` with `domains: ["all"]`.
- **Impact**: Complete system takeover without authentication.

### C2. Scenario Request Update - No Ownership Check
- **Source**: Backend Tester
- **File**: `scenario_request_routes.py:164-182`
- **Description**: `PUT /ask_scenarios/{request_id}` lets any authenticated user modify ANY request.
- **Impact**: Data tampering, unauthorized workflow manipulation.

### C3. Privilege Escalation via PUT /users/{user_id}
- **Source**: Security Tester
- **File**: `users_routes.py:373-423`
- **Description**: A `group-administrator` can set `roles: ["super-administrator"]` on any user. No role hierarchy validation (unlike `admin_routes.py` which has `_check_role_assignment_permission`).
- **Impact**: Group-admin can escalate any user (including themselves) to super-admin.

### C4. CSRF Protection Exempts ALL Auth Endpoints
- **Source**: Security Tester
- **File**: `app.py:169-171`
- **Description**: Exempt path `"/api/v1/auth/*"` disables CSRF on `/auth/logout`, `/auth/profile`, `/auth/update_password`.
- **Impact**: Cross-site password change, forced logout attacks.

### C5. JWT Token Validation Timestamp Bug
- **Source**: Security Tester (confirmed known issue)
- **File**: `token_manager.py:170-175`
- **Description**: Custom expiry checks compare access token exp against refresh token expiry. Redundant with PyJWT's built-in check but logically flawed.
- **Impact**: Low practical impact (PyJWT handles it), but indicates fragile security code.

### C6. Stored XSS via dangerouslySetInnerHTML
- **Source**: UI Tester
- **File**: `RequestDetailPage.jsx:312, 320, 343, 509`
- **Description**: User-submitted HTML (descriptions, comments) rendered without sanitization.
- **Impact**: Malicious users can execute JavaScript in admin/editor browsers.

### C7. Explorer Shows ALL Domains Unfiltered (Frontend)
- **Source**: UI Tester
- **File**: `v1_ExplorerContext.jsx:16-18`
- **Description**: `domainAPI.getAll()` and `scenarioAPI.getAll()` are called without domain access filtering on the frontend side.
- **Impact**: Mitigated if backend filters correctly (it does for domains/scenarios), but no client-side defense-in-depth. If backend filtering breaks, all data is exposed.

### C8. Group-Admin Can Delete Any User Including Super-Admins
- **Source**: Security Tester + Backend Tester
- **File**: `users_routes.py:426-463`
- **Description**: `DELETE /users/{user_id}` uses `require_group_admin`. A group-editor can delete super-admin accounts.
- **Impact**: Denial of service, privilege removal of higher-level users.

---

## 2. HIGH Issues (14)

### H1. Jira Write Endpoints Missing Admin Checks
- **File**: `jira_routes.py` (lines 110, 185, 206, 294)
- Any viewer can create tickets, transition statuses, add attachments.

### H2. API Config Data Exposed to All Users
- **File**: `api_config_routes.py:31-117`
- API keys, auth tokens, endpoint URLs readable by any authenticated user.

### H3. Inconsistent User Delete Authorization
- **File**: `users_routes.py:426` vs `admin_routes.py:130`
- Two delete endpoints with different auth levels; group-editor can bypass stricter one.

### H4. No Domain Scoping on User/Role/Group/Customer CRUD
- **Files**: `users_routes.py`, `roles_routes.py`, `groups_routes.py`, `customers_routes.py`
- Group-admin from Domain A can manage all entities across all domains.

### H5. Scenario Request File Operations - No Ownership Check
- **File**: `scenario_request_routes.py:220-317`
- Any user can upload/preview/download files on any request.

### H6. CORS Allows All Origins with Credentials
- **File**: `app.py:146-154`
- Default `cors_origins = ["*"]` with `allow_credentials=True`.

### H7. NoSQL Injection via Unescaped Regex
- **Files**: 10+ route files using `$regex` with raw user input
- `users_routes.py:129`, `domain_routes.py:150`, `groups_routes.py:153`, etc.
- ReDoS and timing attacks possible.

### H8. Password Reset Token Not Stored/Validated
- **File**: `users_routes.py:504-538`
- Token generated but never stored in DB; returned in response when `send_email=False`.

### H9. Temp Password Returned in API Response
- **File**: `users_routes.py:579-581`
- Plaintext temp password in response body.

### H10. Rate Limiter Weak/Disabled + IP Spoofable
- **Files**: `rate_limit.py`, `app.py:177-181`
- Disabled in dev, trusts X-Forwarded-For, cleanup task may not run.

### H11. resolve_domains Uses Wrong Field Name
- **File**: `groups_routes.py:68`
- Looks for `domainId` but domains collection uses `key`. Key-based lookups never match.

### H12. Token Refresh Doesn't Resolve Domains from Groups/Roles
- **File**: `token_manager.py:187-203`
- `refresh_access_token()` uses `user.get("domains")` (direct only), not resolved domains.

### H13. Inconsistent Domain Field Between Scenario and Playboard Routes
- **Files**: `scenario_routes.py:59` uses `dataDomain`, `playboard_routes.py:98` uses `domainKey`
- Can cause access control gaps if fields differ on documents.

### H14. Register Doesn't Resolve Domains from Groups
- **File**: `user_service.py:234-239`
- Newly registered users with groups don't get group domains in initial token.

---

## 3. MEDIUM Issues (13)

### M1. Invalid Domain/Permission/Customer Refs Silently Accepted
- **File**: `groups_routes.py:42-44, 72-73, 101`

### M2. Group Deactivation Doesn't Invalidate Tokens
- Existing JWTs retain stale group data until refresh/expiry.

### M3. Distribution List Emails Readable by Any User
- **File**: `distribution_list_routes.py:112-147`

### M4. Feedback Update - No Ownership Check
- **File**: `feedback_routes.py:121-135`

### M5. Feedback Admin Endpoints Use Inline Role Checks
- **File**: `feedback_routes.py:33-101`

### M6. Scenario Create/Update - No Domain Access Verification
- **File**: `scenario_routes.py:101-137`

### M7. Scenario Request View - No Ownership Check
- **File**: `scenario_request_routes.py:206-217`

### M8. Group-Editor Can Reset Passwords + Get Temp Password
- **File**: `users_routes.py:541-581`

### M9. get_user_accessible_domains Duplicated in 3 Files
- **Files**: `scenario_routes.py:16-30`, `domain_routes.py:22-36`, `playboard_routes.py:22-36`

### M10. No Real-Time Refresh of Explorer Domain Data
- **File**: `v1_ExplorerContext.jsx:12-38`

### M11. Domain Deletion Doesn't Clean user.domains References
- **File**: `domain_routes.py:290-327`

### M12. "All Domains" Badge Contradicts hasAccessToDomain()
- **Files**: `ProfilePage.jsx:188-193` vs `AuthContext.jsx:108`
- Empty domains shows "All Domains" label but access function returns false.

### M13. ScenarioRequestsManagement Hardcodes /admin/ Navigation
- **File**: `ScenarioRequestsManagement.jsx:388`
- Group-admin view navigates to `/admin/` path, causing redirect.

---

## 4. LOW Issues (10)

### L1. None Values in $in Query from ObjectId Conversion
- **File**: `user_service.py:124, 138`

### L2. Inconsistent Scenario Status Values ("A" vs "active")
- **File**: `scenario_routes.py:55`

### L3. Health Metrics Endpoint Exposes System Info Without Auth
- **File**: `health_routes.py:227-234`

### L4. `require_admin` Dependency Defined But Never Used
- **File**: `access_control.py:158-165`

### L5. Bare except Clauses Throughout Routes
- **Files**: Multiple route files (17+ occurrences)

### L6. `canAccessAdminPanel()` Defined But Never Used
- **File**: `AuthContext.jsx:94-96`

### L7. requireAdmin Prop Name Misleading (Checks isSuperAdmin)
- **File**: `App.jsx:54-69`

### L8. AdminDashboard Shared Without Role-Based Scoping
- **File**: `App.jsx:157, 184`

### L9. Password Reset Token Reuse (Multiple Valid Tokens)
- **File**: `password_service.py:60-100`

### L10. Tokens Stored Unhashed in DB
- **File**: `token_manager.py:45-71`

---

## 5. Unit Tests Created

| File | Tests | Coverage Area |
|------|-------|---------------|
| `test_access_control_rbac.py` | 29 (60+ with params) | Access control dependencies, token validation |
| `test_route_access.py` | 22 | Cross-role endpoint access matrix |
| `test_domain_access.py` | 43 | Domain filtering, check_domain_access, resolve |
| `test_group_rbac.py` | 37 | Group CRUD, resolve_*, domain propagation |
| **Total** | **131** | ~180+ with parametrization |

---

## 6. Positive Findings

- Password hash consistently excluded from all API responses
- Domain filtering on scenario/playboard/domain read endpoints works correctly
- httpOnly cookies used for JWT (prevents XSS token theft)
- Cookie secure flag properly set based on environment
- Profile update correctly limits editable fields (no self-role-modification via UI)
- CSRF implementation uses HMAC-signed tokens with constant-time comparison
- Password hashing uses werkzeug (pbkdf2) with scrypt and bcrypt fallbacks
- Inactive groups/roles properly excluded from domain resolution
- Overlapping domains from multiple groups properly deduplicated
- File upload validation implemented with MIME type + magic bytes checking
- admin_service.py has proper role hierarchy checks for admin routes
