# EasyLife Admin API - Apigee Policy Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Request Flow Pipeline](#request-flow-pipeline)
3. [Policy Reference](#policy-reference)
   - [KVM-Get-Credentials](#1-kvm-get-credentials)
   - [RF-CORSPreflight](#2-rf-corspreflight)
   - [SA-RateLimit](#3-sa-ratelimit)
   - [JWT-VerifyAccessToken](#4-jwt-verifyaccesstoken)
   - [Q-EnforceQuota](#5-q-enforcequota)
   - [AM-AddCORSHeaders](#6-am-addcorsheaders)
   - [AM-AddSecurityHeaders](#7-am-addsecurityheaders)
   - [AM-SetTargetHeaders](#8-am-settargetheaders)
   - [JS-ValidateLoginRequest](#9-js-validateloginrequest)
   - [JS-ValidateRegisterRequest](#10-js-validateregisterrequest)
   - [JS-ValidateUserCreate](#11-js-validateusercreate)
   - [JS-ValidateBulkUpload](#12-js-validatebulkupload)
   - [JS-LogResponse](#13-js-logresponse)
   - [Error Response Policies](#14-error-response-policies)
4. [Target Endpoint & Load Balancing](#target-endpoint--load-balancing)
5. [KVM Setup Guide](#kvm-setup-guide)
6. [Debug & Troubleshooting Guide](#debug--troubleshooting-guide)

---

## Architecture Overview

```
                          ┌──────────────────────────────────────────────┐
                          │              Apigee Gateway                  │
                          │          Base: /easylife/v1                  │
                          │                                              │
  Browser/Client ────────►│  ProxyEndpoint         TargetEndpoint        │
                          │  ┌──────────┐          ┌──────────┐         │
                          │  │ PreFlow  │──────────│ PreFlow  │─────┐   │
                          │  │ Flows    │          │ PostFlow │     │   │
                          │  │ PostFlow │          └──────────┘     │   │
                          │  │ Faults   │                           │   │
                          │  └──────────┘                           │   │
                          └─────────────────────────────────────────┘   │
                                                                        │
                                                          RoundRobin    │
                                                       LoadBalancer     │
                                                            │           │
                                              ┌─────────────┼───────────┘
                                              │             │
                                              ▼             ▼
                                    ┌──────────────┐ ┌──────────────┐
                                    │ easylife-    │ │ easylife-    │
                                    │ backend-1    │ │ backend-2    │
                                    │ /api/v1      │ │ /api/v1      │
                                    └──────────────┘ └──────────────┘
```

## Request Flow Pipeline

### Proxy Endpoint - PreFlow (Request)

Every incoming request passes through these steps **in order**:

```
Step 1: RF-CORSPreflight      (OPTIONS only → returns 200, stops pipeline)
Step 2: KVM-Get-Credentials   (non-OPTIONS → loads hostname + JWT secret from KVM)
Step 3: SA-RateLimit           (always → spike arrest 100 req/sec per IP)
Step 4: JWT-VerifyAccessToken  (protected endpoints → verifies JWT token)
Step 5: Q-EnforceQuota         (authenticated endpoints → 10K req/month per user)
```

### Proxy Endpoint - Conditional Flows

Route-specific validation policies execute after PreFlow:

| Flow | Policy | Trigger |
|------|--------|---------|
| Auth-Login | `JS-ValidateLoginRequest` | `POST /auth/login` |
| Auth-Register | `JS-ValidateRegisterRequest` | `POST /auth/register` |
| Users-Create | `JS-ValidateUserCreate` | `POST /users` |
| Bulk-Upload | `JS-ValidateBulkUpload` | `POST /bulk/upload/**` |

### Proxy Endpoint - PostFlow (Response)

| Step | Policy | Purpose |
|------|--------|---------|
| 1 | `AM-AddSecurityHeaders` | Adds HSTS, CSP, X-Frame-Options, etc. |

### Proxy Endpoint - PreFlow (Response)

| Step | Policy | Purpose |
|------|--------|---------|
| 1 | `AM-AddCORSHeaders` | Adds CORS headers to every response |

### Target Endpoint - PreFlow (Request)

| Step | Policy | Purpose |
|------|--------|---------|
| 1 | `AM-SetTargetHeaders` | Adds X-Forwarded-*, X-Request-Id headers |

### Target Endpoint - PostFlow (Response)

| Step | Policy | Purpose |
|------|--------|---------|
| 1 | `JS-LogResponse` | Logs response status, latency for analytics |

### Fault Handling

| Fault Rule | Policy | Condition |
|-----------|--------|-----------|
| InvalidJWT | `AM-InvalidJWTResponse` | `fault.name` matches `*JWT*` or `*jwt*` |
| QuotaViolation | `AM-QuotaExceededResponse` | `fault.name = "QuotaViolation"` |
| SpikeArrestViolation | `AM-RateLimitExceededResponse` | `fault.name = "SpikeArrestViolation"` |
| TargetUnavailable | `AM-TargetUnavailableResponse` | `ConnectionRefused` or `ConnectionTimeout` |
| DefaultFaultRule | `AM-DefaultErrorResponse` | Any unmatched proxy fault |
| DefaultTargetFaultRule | `AM-DefaultTargetErrorResponse` | Any unmatched target fault |

---

## Policy Reference

### 1. KVM-Get-Credentials

**File:** `policies/KVM-Get-Credentials.xml`
**Type:** KeyValueMapOperations
**Purpose:** Retrieves encrypted credentials from Apigee's Key Value Map (KVM) at runtime. This MUST execute before any policy that needs the JWT secret or backend hostname.

**What it does:**
- Reads from KVM named `easylife-proxykvm` (environment-scoped)
- Retrieves `hostname` key → assigns to `private.p.easylife.hostname`
- Retrieves `secretKey` key → assigns to `private.jwt.secret`
- Caches values for 300 seconds (5 min) to reduce KVM lookup overhead

**Why it's needed:**
- The `JWT-VerifyAccessToken` policy references `private.jwt.secret` to verify token signatures
- Without this policy running first, `private.jwt.secret` would be unresolved and JWT verification would fail with `IgnoreUnresolvedVariables=false`
- The `private.` prefix ensures values are encrypted in memory and masked in Apigee Trace/Debug tool

**Flow variables set:**

| Variable | Source KVM Key | Purpose | Visible in Trace? |
|----------|---------------|---------|-------------------|
| `private.p.easylife.hostname` | `hostname` | Backend hostname | No (private prefix) |
| `private.jwt.secret` | `secretKey` | JWT signing/verification secret (HS256) | No (private prefix) |

**Condition:** Runs on all non-OPTIONS requests. OPTIONS requests are handled by CORS preflight and don't need credentials.

**Execution order:** Step 2 in PreFlow (after CORS preflight check, before spike arrest and JWT verification).

---

### 2. RF-CORSPreflight

**File:** `policies/RF-CORSPreflight.xml`
**Type:** RaiseFault
**Purpose:** Immediately responds to browser CORS preflight (OPTIONS) requests without forwarding to the backend.

**What it does:**
- Returns HTTP 200 with CORS headers
- Sets `Access-Control-Allow-Origin` to the request's `Origin` header (dynamic)
- Allows methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
- Allows headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-CSRF-Token
- Sets `Access-Control-Max-Age: 86400` (browser caches preflight for 24 hours)

**Why it's needed:**
- Browsers send OPTIONS requests before cross-origin requests with custom headers
- Using RaiseFault stops the pipeline immediately (no KVM lookup, JWT verification, or backend call needed)
- Reduces latency and backend load for preflight requests

**Condition:** `request.verb == "OPTIONS"` (PreFlow Step 1)

---

### 3. SA-RateLimit

**File:** `policies/SA-RateLimit.xml`
**Type:** SpikeArrest
**Purpose:** Protects the backend from traffic spikes by rate-limiting requests per client IP.

**What it does:**
- Limits to 100 requests per second per client IP
- Uses `proxy.client.ip` as the identifier
- Supports `x-message-weight` header for weighted requests
- Uses distributed counting (`UseEffectiveCount=true`) for multi-MP deployments

**Why it's needed:**
- Prevents DDoS and abuse from individual clients
- Protects backend services from sudden traffic spikes
- Acts as the first defense layer before more expensive JWT verification

**On violation:** Triggers `SpikeArrestViolation` fault → `AM-RateLimitExceededResponse` (429)

**Condition:** Always runs (no condition - applies to all requests including auth endpoints)

---

### 4. JWT-VerifyAccessToken

**File:** `policies/JWT-VerifyAccessToken.xml`
**Type:** VerifyJWT
**Purpose:** Verifies the JWT access token on protected API endpoints using HS256 symmetric key verification.

**What it does:**
1. Extracts JWT from `Authorization: Bearer <token>` header
2. Verifies the HMAC-SHA256 signature using `private.jwt.secret` (populated by KVM-Get-Credentials)
3. Validates standard claims:
   - `sub` must equal `"access_token"` (distinguishes from refresh tokens)
   - `iss` must equal `"easylife-auth"` (token came from our auth backend)
   - `aud` must equal `"easylife-api"` (token is intended for this API)
4. Allows 60 seconds of clock skew for `exp`/`nbf` validation
5. Extracts custom claims into flow variables:

| JWT Claim | Flow Variable | Type | Purpose |
|-----------|--------------|------|---------|
| `user_id` | `jwt.user_id` | string | Authenticated user ID |
| `email` | `jwt.email` | string | User email |
| `roles` | `jwt.roles` | string[] | RBAC roles |

**Why it's needed:**
- Gateway-level authentication prevents unauthorized requests from reaching the backend
- Extracts user identity for downstream policies (quota enforcement uses `user_id`)
- The `continueOnError=false` setting stops the pipeline immediately on failure

**Dependency:** Requires `KVM-Get-Credentials` to run first to populate `private.jwt.secret`

**Exempt endpoints:** Login, register, forgot/reset password, refresh, logout, CSRF token, health checks, info, public feedback, OPTIONS

**On failure:** Triggers JWT fault → `AM-InvalidJWTResponse` (401)

**Backend requirement:** The FastAPI backend must include these claims when creating access tokens:
```python
access_payload = {
    "sub": "access_token",
    "iss": "easylife-auth",
    "aud": "easylife-api",
    "user_id": user_id,
    "email": email,
    "roles": roles or [],
    # ... other claims
}
```

---

### 5. Q-EnforceQuota

**File:** `policies/Q-EnforceQuota.xml`
**Type:** Quota (calendar-based)
**Purpose:** Enforces a monthly API usage quota per authenticated user.

**What it does:**
- Allows 10,000 requests per month per user
- Uses `jwt.JWT-VerifyAccessToken.decoded.claim.user_id` as the identifier
- Calendar-based: resets on the 1st of each month (from `StartTime: 2024-01-01`)
- Distributed + Synchronous: accurate counts across Apigee message processors

**Why it's needed:**
- Prevents individual users from consuming excessive API resources
- Per-user tracking (not per-IP) ensures fair usage across accounts
- Calendar-based provides predictable monthly reset

**Exempt endpoints:** Health checks, info, all auth endpoints, public feedback, OPTIONS

**On violation:** Triggers `QuotaViolation` fault → `AM-QuotaExceededResponse` (429)

---

### 6. AM-AddCORSHeaders

**File:** `policies/AM-AddCORSHeaders.xml`
**Type:** AssignMessage
**Purpose:** Adds CORS response headers to all API responses.

**What it does:**
- `Access-Control-Allow-Origin: {request.header.origin}` (mirrors request origin)
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS`
- `Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-CSRF-Token`
- `Access-Control-Allow-Credentials: true` (allows cookies/auth headers)
- `Access-Control-Max-Age: 86400` (24-hour preflight cache)
- `Access-Control-Expose-Headers: X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining`

**Why it's needed:**
- React SPA running on a different origin needs CORS headers to access the API
- Dynamic origin mirroring supports multiple frontend environments (dev, staging, prod)
- Exposes rate-limit headers so the frontend can display remaining quota

**Execution:** PreFlow Response (runs on every response)

---

### 7. AM-AddSecurityHeaders

**File:** `policies/AM-AddSecurityHeaders.xml`
**Type:** AssignMessage
**Purpose:** Adds HTTP security headers to all responses for browser protection.

**Headers set:**

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking (no iframes) |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS for 1 year |
| `Content-Security-Policy` | `default-src 'self'` | Restricts resource loading |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referer header |
| `X-Request-Id` | `{messageid}` | Unique request identifier for tracing |

**Execution:** PostFlow Response (runs after all conditional flows)

---

### 8. AM-SetTargetHeaders

**File:** `policies/AM-SetTargetHeaders.xml`
**Type:** AssignMessage
**Purpose:** Adds forwarding and tracing headers to the request before it reaches the backend.

**Headers set:**

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Forwarded-For` | `{client.ip}` | Original client IP |
| `X-Forwarded-Proto` | `{client.scheme}` | Original protocol (http/https) |
| `X-Forwarded-Host` | `{request.header.host}` | Original host header |
| `X-Request-Id` | `{messageid}` | Correlates proxy and backend logs |
| `X-Apigee-Proxy-Name` | `{apiproxy.name}` | Identifies which proxy forwarded the request |
| `X-Apigee-Proxy-Revision` | `{apiproxy.revision}` | Proxy revision for debugging |

**Why it's needed:**
- Backend needs the real client IP for logging, rate limiting, and geo-location
- `X-Request-Id` enables end-to-end request tracing across proxy and backend
- Proxy name/revision helps debug which version of the proxy is in production

**Execution:** Target PreFlow Request (runs before the request is sent to the backend)

---

### 9. JS-ValidateLoginRequest

**File:** `policies/JS-ValidateLoginRequest.xml`
**Resource:** `jsc://validateLoginRequest.js`
**Type:** JavaScript
**Purpose:** Validates the login request payload at the gateway level before forwarding to the backend.
**Trigger:** `POST /auth/login`

---

### 10. JS-ValidateRegisterRequest

**File:** `policies/JS-ValidateRegisterRequest.xml`
**Resource:** `jsc://validateRegisterRequest.js`
**Type:** JavaScript
**Purpose:** Validates the registration request payload (required fields, email format, password strength).
**Trigger:** `POST /auth/register`

---

### 11. JS-ValidateUserCreate

**File:** `policies/JS-ValidateUserCreate.xml`
**Resource:** `jsc://validateUserCreate.js`
**Type:** JavaScript
**Purpose:** Validates user creation payload submitted by admins.
**Trigger:** `POST /users`

---

### 12. JS-ValidateBulkUpload

**File:** `policies/JS-ValidateBulkUpload.xml`
**Resource:** `jsc://validateBulkUpload.js`
**Type:** JavaScript
**Purpose:** Validates bulk upload request (file type, size, format).
**Trigger:** `POST /bulk/upload/**`

---

### 13. JS-LogResponse

**File:** `policies/JS-LogResponse.xml`
**Resource:** `jsc://logResponse.js`
**Type:** JavaScript
**Purpose:** Logs response metadata (status code, latency, target info) for analytics and monitoring.
**Execution:** Target PostFlow Response (runs after backend response is received, before sending to client)

---

### 14. Error Response Policies

All error responses follow a consistent JSON format:

```json
{
    "error": "Error Type",
    "message": "Human-readable description",
    "code": "ERROR_CODE",
    "status": <http_status>,
    "timestamp": "<ISO timestamp>",
    "requestId": "<unique_id>"
}
```

| Policy | HTTP Status | Code | Trigger |
|--------|------------|------|---------|
| `AM-InvalidJWTResponse` | 401 | `INVALID_TOKEN` | JWT verification failure |
| `AM-InvalidAPIKeyResponse` | 401 | `INVALID_API_KEY` | API key verification failure (unused) |
| `AM-QuotaExceededResponse` | 429 | `QUOTA_EXCEEDED` | Monthly quota limit reached |
| `AM-RateLimitExceededResponse` | 429 | `RATE_LIMIT_EXCEEDED` | Spike arrest triggered |
| `AM-TargetUnavailableResponse` | 503 | `SERVICE_UNAVAILABLE` | Backend connection refused/timeout |
| `AM-DefaultTargetErrorResponse` | 502 | `BAD_GATEWAY` | Other target communication errors |
| `AM-DefaultErrorResponse` | 500 | `INTERNAL_ERROR` | Any unhandled proxy error |

**Note:** `AM-InvalidAPIKeyResponse` and `VA-VerifyAPIKey` exist but are unused. The browser SPA uses JWT auth, not API keys.

---

## Target Endpoint & Load Balancing

### Configuration

**File:** `targets/default.xml`

```xml
<LoadBalancer>
    <Algorithm>RoundRobin</Algorithm>
    <Server name="easylife-backend-1"/>
    <Server name="easylife-backend-2"/>
    <MaxFailures>3</MaxFailures>
    <RetryEnabled>true</RetryEnabled>
</LoadBalancer>
<Path>/api/v1</Path>
```

### Load Balancing Details

| Setting | Value | Description |
|---------|-------|-------------|
| Algorithm | `RoundRobin` | Alternates requests evenly between servers |
| Servers | `easylife-backend-1`, `easylife-backend-2` | Named target servers (configured in Apigee env) |
| MaxFailures | 3 | After 3 consecutive failures, server is marked unhealthy |
| RetryEnabled | true | Automatically retries on another server if one fails |

### Connection Timeouts

| Property | Value | Description |
|----------|-------|-------------|
| `keepalive.timeout.millis` | 60000 (60s) | Keep-alive connection timeout |
| `connect.timeout.millis` | 30000 (30s) | TCP connection establishment timeout |
| `io.timeout.millis` | 60000 (60s) | Read/write timeout after connection |

### Path Rewriting

Apigee base path: `/easylife/v1` → Backend path: `/api/v1`

Example: `GET /easylife/v1/users` → `GET /api/v1/users` on backend

### Target Server Setup

Target servers are configured in the Apigee environment (not in the proxy bundle):

```bash
# Create target server 1
apigeecli targetservers create \
  --name easylife-backend-1 \
  --host <backend-host-1> \
  --port 443 \
  --ssl true \
  --org YOUR_ORG \
  --env YOUR_ENV

# Create target server 2
apigeecli targetservers create \
  --name easylife-backend-2 \
  --host <backend-host-2> \
  --port 443 \
  --ssl true \
  --org YOUR_ORG \
  --env YOUR_ENV
```

---

## KVM Setup Guide

### What is KVM?

Apigee Key Value Maps (KVM) are encrypted key-value stores scoped to an organization, environment, or API proxy. Values stored with the `private.` prefix are encrypted at rest and masked in all Apigee debug/trace output.

### KVM Name

**`easylife-proxykvm`** (environment-scoped)

### Required Entries

| KVM Key | Maps To Variable | Purpose |
|---------|-----------------|---------|
| `hostname` | `private.p.easylife.hostname` | Backend hostname for target routing |
| `secretKey` | `private.jwt.secret` | JWT signing secret (must match backend `AUTH_SECRET_KEY`) |

### Setup Commands

```bash
# 1. Create the KVM (one-time)
apigeecli kvms create \
  --name easylife-proxykvm \
  --encrypted true \
  --org YOUR_ORG \
  --env YOUR_ENV

# 2. Store the backend hostname
apigeecli kvms entries create \
  --map easylife-proxykvm \
  --key hostname \
  --value "your-backend-hostname.com" \
  --org YOUR_ORG \
  --env YOUR_ENV

# 3. Store the JWT secret (MUST match backend AUTH_SECRET_KEY)
apigeecli kvms entries create \
  --map easylife-proxykvm \
  --key secretKey \
  --value "your-jwt-secret-key-here" \
  --org YOUR_ORG \
  --env YOUR_ENV
```

### Updating KVM Values

```bash
# Update an existing entry
apigeecli kvms entries update \
  --map easylife-proxykvm \
  --key secretKey \
  --value "new-secret-value" \
  --org YOUR_ORG \
  --env YOUR_ENV
```

### Caching Behavior

The `KVM-Get-Credentials` policy has `<ExpiryTimeInSecs>300</ExpiryTimeInSecs>`, meaning:
- KVM values are cached for 5 minutes per message processor
- After updating KVM values, changes take up to 5 minutes to propagate
- For immediate effect, redeploy the proxy or wait for cache expiry

---

## Debug & Troubleshooting Guide

### Using Apigee Trace/Debug Tool

1. Open the Apigee Console → API Proxies → `easylife-admin-api`
2. Click **Debug** tab → **Start Debug Session**
3. Send a test request
4. Review the trace to see each policy execution, variables set, and any faults

**Important:** Variables with `private.` prefix will appear as `****` in trace output. This is by design for security.

### Common Issues & Solutions

---

#### Issue: 401 - "Invalid or expired access token" on all protected requests

**Symptoms:**
- All authenticated API calls return 401
- Public endpoints (login, health) work fine

**Possible causes:**

1. **KVM not configured or KVM key missing**
   ```
   Check: Does the KVM `easylife-proxykvm` exist in the environment?
   Check: Do keys `hostname` and `secretKey` exist in the KVM?
   ```
   **Fix:**
   ```bash
   apigeecli kvms list --org YOUR_ORG --env YOUR_ENV
   apigeecli kvms entries list --map easylife-proxykvm --org YOUR_ORG --env YOUR_ENV
   ```

2. **JWT secret mismatch between Apigee KVM and backend**
   ```
   The value stored in KVM key `secretKey` must EXACTLY match
   the backend's AUTH_SECRET_KEY environment variable.
   ```
   **Fix:** Update the KVM entry with the correct secret:
   ```bash
   apigeecli kvms entries update \
     --map easylife-proxykvm \
     --key secretKey \
     --value "correct-secret-from-backend" \
     --org YOUR_ORG \
     --env YOUR_ENV
   ```

3. **Backend not including required JWT claims (sub, iss, aud)**
   ```
   Apigee expects: sub="access_token", iss="easylife-auth", aud="easylife-api"
   Backend must include these in the JWT payload.
   ```
   **Fix:** Update `backend/src/easylifeauth/services/token_manager.py`:
   ```python
   access_payload = {
       "sub": "access_token",
       "iss": "easylife-auth",
       "aud": "easylife-api",
       "user_id": user_id,
       "email": email,
       "roles": roles or [],
       ...
   }
   ```

4. **KVM-Get-Credentials policy not running before JWT verification**
   ```
   If KVM policy is missing or runs after JWT policy, private.jwt.secret
   will be unresolved and JWT verification will fail.
   ```
   **Fix:** Verify in `proxies/default.xml` that `KVM-Get-Credentials` step appears BEFORE `JWT-VerifyAccessToken` in PreFlow.

---

#### Issue: 401 on specific endpoints that should be public

**Symptoms:**
- Login, register work but another public endpoint returns 401

**Fix:** Check the JWT exemption condition in `proxies/default.xml` PreFlow. Ensure the endpoint is listed in the `!(proxy.pathsuffix MatchesPath ...)` condition for `JWT-VerifyAccessToken`.

---

#### Issue: 429 - "Rate limit exceeded"

**Symptoms:**
- Requests return 429 with `RATE_LIMIT_EXCEEDED`

**Possible causes:**
- Client sending > 100 requests/second from the same IP
- Multiple users behind the same NAT/proxy IP

**Debug:**
- Check `SA-RateLimit` policy in trace - see `ratelimit.SA-RateLimit.exceed.count`
- Adjust `<Rate>100ps</Rate>` if 100/sec is too low

---

#### Issue: 429 - "Quota exceeded"

**Symptoms:**
- Requests return 429 with `QUOTA_EXCEEDED`

**Possible causes:**
- User exceeded 10,000 requests in the current month

**Debug:**
- Check quota variables in trace:
  - `ratelimit.Q-EnforceQuota.allowed.count` = 10000
  - `ratelimit.Q-EnforceQuota.used.count` = current usage
  - `ratelimit.Q-EnforceQuota.available.count` = remaining
- Quota resets on the 1st of each month

**Fix (temporary):** Increase `<Allow count="10000"/>` in `Q-EnforceQuota.xml`

---

#### Issue: 503 - "Service Unavailable"

**Symptoms:**
- Backend is unreachable
- Load balancer can't connect to either server

**Debug:**
1. Check target server health:
   ```bash
   apigeecli targetservers get \
     --name easylife-backend-1 \
     --org YOUR_ORG \
     --env YOUR_ENV
   ```
2. Verify backend is running and accessible
3. Check `connect.timeout.millis` (30s) and `io.timeout.millis` (60s)
4. In trace, check `target.url` to see which server was selected

**With RoundRobin + RetryEnabled:**
- If `easylife-backend-1` fails, the request is retried on `easylife-backend-2`
- After 3 consecutive failures (`MaxFailures`), the server is temporarily removed from rotation
- The server is re-added after Apigee's health check interval

---

#### Issue: 502 - "Bad Gateway"

**Symptoms:**
- Backend responds with an error that Apigee can't process

**Debug:**
- Check trace for `target.status.code` and `target.reason.phrase`
- Check `fault.name` in the FaultRule that triggered
- Review `JS-LogResponse` output for response details

---

#### Issue: CORS errors in browser console

**Symptoms:**
- Browser shows "CORS policy" errors
- API calls fail from the frontend

**Debug:**
1. Verify the request includes an `Origin` header
2. Check that `AM-AddCORSHeaders` runs in the response flow
3. For OPTIONS requests, verify `RF-CORSPreflight` returns 200 with correct headers
4. In trace, check response headers for `Access-Control-Allow-Origin`

**Common pitfall:** If a policy fails before `AM-AddCORSHeaders` runs (e.g., JWT fails), the CORS headers won't be set on the error response. The CORS policy is in PreFlow Response, which should run even on faults, but verify in trace.

---

#### Issue: KVM cache stale after updating secret

**Symptoms:**
- Updated KVM secret but JWT verification still fails

**Fix:**
- Wait up to 5 minutes (ExpiryTimeInSecs=300) for the cache to expire
- Or redeploy the proxy to force cache clear:
  ```bash
  apigeecli apis deploy \
    --name easylife-admin-api \
    --rev CURRENT_REV \
    --env YOUR_ENV \
    --org YOUR_ORG \
    --override
  ```

---

### Debug Checklist for Production Deployment

1. **KVM Setup**
   - [ ] KVM `easylife-proxykvm` created with `--encrypted true`
   - [ ] Key `hostname` set to correct backend hostname
   - [ ] Key `secretKey` set to exact same value as backend `AUTH_SECRET_KEY`

2. **Target Servers**
   - [ ] `easylife-backend-1` target server created with correct host/port/SSL
   - [ ] `easylife-backend-2` target server created with correct host/port/SSL
   - [ ] Both backends are running and accessible from Apigee

3. **Backend JWT Claims**
   - [ ] Backend includes `sub: "access_token"` in JWT payload
   - [ ] Backend includes `iss: "easylife-auth"` in JWT payload
   - [ ] Backend includes `aud: "easylife-api"` in JWT payload
   - [ ] Backend signs with same secret as KVM `secretKey`

4. **Proxy Deployment**
   - [ ] Proxy deployed to correct environment
   - [ ] VirtualHost `secure` is configured for HTTPS
   - [ ] Base path `/easylife/v1` doesn't conflict with other proxies

5. **Connectivity Test**
   ```bash
   # Test health endpoint (no auth required)
   curl -v https://YOUR_APIGEE_HOST/easylife/v1/health

   # Test CORS preflight
   curl -v -X OPTIONS https://YOUR_APIGEE_HOST/easylife/v1/users \
     -H "Origin: https://your-frontend.com"

   # Test authenticated endpoint
   curl -v https://YOUR_APIGEE_HOST/easylife/v1/users \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

---

### Flow Variable Reference

Key flow variables available after PreFlow execution:

| Variable | Set By | Available When | Description |
|----------|--------|---------------|-------------|
| `private.p.easylife.hostname` | KVM-Get-Credentials | After Step 2 | Backend hostname (masked in trace) |
| `private.jwt.secret` | KVM-Get-Credentials | After Step 2 | JWT secret (masked in trace) |
| `jwt.JWT-VerifyAccessToken.decoded.claim.user_id` | JWT-VerifyAccessToken | After Step 4 | Authenticated user ID |
| `jwt.JWT-VerifyAccessToken.decoded.claim.email` | JWT-VerifyAccessToken | After Step 4 | Authenticated user email |
| `jwt.JWT-VerifyAccessToken.decoded.claim.roles` | JWT-VerifyAccessToken | After Step 4 | User roles (array) |
| `jwt.user_id` | JWT-VerifyAccessToken (AdditionalClaims) | After Step 4 | Shorthand for user_id |
| `jwt.email` | JWT-VerifyAccessToken (AdditionalClaims) | After Step 4 | Shorthand for email |
| `jwt.roles` | JWT-VerifyAccessToken (AdditionalClaims) | After Step 4 | Shorthand for roles |
| `messageid` | Apigee Runtime | Always | Unique request ID |
| `client.ip` | Apigee Runtime | Always | Client IP address |
| `proxy.pathsuffix` | Apigee Runtime | Always | Path after base path |
| `ratelimit.Q-EnforceQuota.used.count` | Q-EnforceQuota | After Step 5 | Current month quota usage |
| `ratelimit.Q-EnforceQuota.available.count` | Q-EnforceQuota | After Step 5 | Remaining monthly quota |
