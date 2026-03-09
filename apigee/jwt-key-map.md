# JWT-VerifyAccessToken Policy - How It Works

## Policy Location

`apigee/apiproxy/policies/JWT-VerifyAccessToken.xml`

```xml
<VerifyJWT async="false" continueOnError="false" enabled="true" name="JWT-VerifyAccessToken">
    <DisplayName>Verify JWT Access Token</DisplayName>
    <Algorithm>HS256</Algorithm>
    <Source>request.header.Authorization</Source>
    <IgnoreUnresolvedVariables>false</IgnoreUnresolvedVariables>
    <SecretKey>
        <Value ref="private.jwt.secret"/>
    </SecretKey>
    <Subject>access_token</Subject>
    <Issuer>easylife-auth</Issuer>
    <Audience>easylife-api</Audience>
    <AdditionalClaims>
        <Claim name="user_id" ref="jwt.user_id" type="string"/>
        <Claim name="email" ref="jwt.email" type="string"/>
        <Claim name="roles" ref="jwt.roles" type="string" array="true"/>
    </AdditionalClaims>
    <TimeAllowance>60s</TimeAllowance>
</VerifyJWT>
```

## Request Flow

```
Client Request --> Apigee Gateway --> [JWT-VerifyAccessToken] --> Backend (FastAPI)
                                           | (if invalid)
                                      401 Unauthorized
```

The policy runs in the **PreFlow** of `proxies/default.xml` (line 17-20) for all protected endpoints. It skips `/auth/login`, `/auth/register`, `/auth/forgot_password`, `/auth/reset_password`, `/auth/refresh`, `/auth/logout`, `/auth/csrf-token`, `/health/**`, `/info`, `/feedback/public`, and `OPTIONS` requests.

## Element-by-Element Breakdown

| Element | Value | What it does |
|---------|-------|-------------|
| `Algorithm` | `HS256` | Expects tokens signed with HMAC-SHA256 (symmetric key) |
| `Source` | `request.header.Authorization` | Reads the JWT from the `Authorization` header (expects `Bearer <token>`) |
| `SecretKey ref="private.jwt.secret"` | Encrypted KVM variable | The shared secret stored in Apigee's encrypted KVM - used to verify the HMAC signature |
| `Subject` | `access_token` | Validates the `sub` claim equals `"access_token"` (distinguishes from refresh tokens) |
| `Issuer` | `easylife-auth` | Validates `iss` claim equals `"easylife-auth"` - ensures the token came from your auth backend |
| `Audience` | `easylife-api` | Validates `aud` claim equals `"easylife-api"` - ensures the token was meant for this API |
| `TimeAllowance` | `60s` | Allows 60 seconds of clock skew when checking `exp` (expiry) and `nbf` (not-before) claims |
| `continueOnError` | `false` | If verification fails, stop processing and return an error immediately |

## AdditionalClaims Extraction

After successful verification, the policy extracts custom claims into Apigee flow variables for use by downstream policies:

| Claim | Flow Variable | Purpose |
|-------|--------------|---------|
| `user_id` | `jwt.user_id` | Identifies the authenticated user |
| `email` | `jwt.email` | User's email address |
| `roles` | `jwt.roles` (array) | User's RBAC roles for authorization decisions |

## What Causes Rejection (401)

1. No `Authorization` header present
2. Signature doesn't match the secret key
3. Token is expired (beyond 60s grace)
4. `sub` is not `"access_token"`
5. `iss` is not `"easylife-auth"`
6. `aud` is not `"easylife-api"`
7. Required claims (`user_id`, `email`, `roles`) are missing

---

## Who Sends `sub`, `iss`, `aud` Claims

### Token Creation (Backend)

The FastAPI backend creates tokens in `backend/src/easylifeauth/services/token_manager.py`:

```python
# token_manager.py lines 114-123
access_payload = {
    "user_id": user_id,
    "email": email,
    "roles": roles or [],
    "groups": groups or [],
    "domains": domains or [],
    "iat": now,
    "exp": now + self.access_token_expires,
    "type": 'access'
}
access_token = jwt.encode(access_payload, self.secret_key, algorithm="HS256")
```

This is called from:
- `POST /auth/login` -> `user_service.login_user()` -> `token_manager.generate_tokens()`
- `POST /auth/register` -> `user_service.register_user()` -> `token_manager.generate_tokens()`
- `POST /auth/refresh` -> `token_manager.refresh_access_token()`

### CRITICAL MISMATCH

The Apigee policy **expects** these claims:
- `sub: "access_token"`
- `iss: "easylife-auth"`
- `aud: "easylife-api"`

But the backend payload has **none of them**. It uses `"type": "access"` instead of `"sub": "access_token"`.

**To fix**, the backend payload should include:
```python
access_payload = {
    "sub": "access_token",        # <-- missing
    "iss": "easylife-auth",       # <-- missing
    "aud": "easylife-api",        # <-- missing
    "user_id": user_id,
    "email": email,
    "roles": roles or [],
    ...
}
```

---

## How `private.jwt.secret` Is Resolved

There is **no config file** in the proxy bundle that contains the actual secret. It is stored in Apigee's **server-side encrypted KVM** (Key Value Map), and the `ref=` attribute tells Apigee to look it up at runtime.

### Step 1: Admin Creates the KVM Entry (One-Time Setup)

From `apigee/README.md`:

```bash
# Create the encrypted key-value store
apigeecli kvms create --name easylife-secrets --org YOUR_ORG --env YOUR_ENV

# Store the secret in it
apigeecli kvms entries create \
  --map easylife-secrets \
  --key jwt.secret \
  --value "your-jwt-secret-key" \
  --org YOUR_ORG \
  --env YOUR_ENV
```

This stores `jwt.secret = "your-jwt-secret-key"` in Apigee's encrypted storage on the server. It is **never** in the proxy XML files or source code.

### Step 2: At Runtime, Apigee Resolves the `ref`

When a request hits the policy:

```xml
<SecretKey>
    <Value ref="private.jwt.secret"/>
</SecretKey>
```

Apigee does this internally:

```
1. Sees ref="private.jwt.secret"
2. The "private." prefix tells Apigee -> look in encrypted KVM
3. Looks up key "jwt.secret" in the environment's KVM named "easylife-secrets"
4. Retrieves the value "your-jwt-secret-key"
5. Uses it to verify the HMAC-SHA256 signature
```

### The `private.` Prefix Is Special

| Prefix | Meaning | Visible in debug/trace? |
|--------|---------|------------------------|
| `private.` | Encrypted KVM variable | **No** - masked in all logs/traces |
| (no prefix) | Regular flow variable | Yes - visible in debug |

This ensures the secret **never appears** in Apigee's debug/trace tool, even when admins are debugging.

### Full Picture

```
+-- One-time Setup -----------------------------------+
|  Admin runs: apigeecli kvms entries create          |
|    --map easylife-secrets                           |
|    --key jwt.secret                                 |
|    --value "same-secret-as-backend"                 |
|                                                     |
|  Stored encrypted on Apigee servers                 |
+-----------------------------------------------------+
                    | (at runtime)
+-- Every Request ------------------------------------+
|  Policy XML: ref="private.jwt.secret"               |
|       |                                             |
|  Apigee runtime resolves -> KVM lookup              |
|       |                                             |
|  Gets decrypted value in memory                     |
|       |                                             |
|  Uses it for HS256 signature verification           |
|       |                                             |
|  Value is NEVER logged or exposed                   |
+-----------------------------------------------------+
```

### Key Requirement

The value stored in KVM (`jwt.secret`) **must match exactly** the `AUTH_SECRET_KEY` used by the FastAPI backend in `token_manager.py` to sign tokens. If they differ, every token verification will fail.

## Security Note

`HS256` uses a **symmetric shared secret** - the same key signs and verifies. This means both the FastAPI backend (token issuer) and the Apigee gateway must share `private.jwt.secret`. If either is compromised, tokens can be forged. RS256 (asymmetric) would be more secure for production but requires key pair management.
