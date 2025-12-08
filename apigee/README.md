# EasyLife Admin API - Apigee Proxy

This directory contains the Apigee API Proxy configuration for the EasyLife Admin Panel API.

## Structure

```
apigee/
├── apiproxy/
│   ├── easylife-admin-api.xml          # Main proxy configuration
│   ├── proxies/
│   │   └── default.xml                  # Proxy endpoint configuration
│   ├── targets/
│   │   └── default.xml                  # Target endpoint configuration
│   ├── policies/
│   │   ├── SA-RateLimit.xml            # Spike Arrest (rate limiting)
│   │   ├── VA-VerifyAPIKey.xml         # API Key verification
│   │   ├── JWT-VerifyAccessToken.xml   # JWT token verification
│   │   ├── Q-EnforceQuota.xml          # Quota enforcement
│   │   ├── AM-AddCORSHeaders.xml       # CORS headers
│   │   ├── RF-CORSPreflight.xml        # CORS preflight handling
│   │   ├── AM-AddSecurityHeaders.xml   # Security headers
│   │   ├── AM-SetTargetHeaders.xml     # Target request headers
│   │   ├── AM-*Response.xml            # Error response policies
│   │   ├── JS-Validate*.xml            # JavaScript validation policies
│   │   └── JS-LogResponse.xml          # Response logging
│   └── resources/
│       └── jsc/
│           ├── validateLoginRequest.js
│           ├── validateRegisterRequest.js
│           ├── validateUserCreate.js
│           ├── validateBulkUpload.js
│           └── logResponse.js
└── README.md
```

## Features

### Security
- **API Key Verification**: Required for all non-auth endpoints
- **JWT Token Verification**: Validates access tokens for protected endpoints
- **CORS Support**: Full CORS handling with preflight requests
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.

### Rate Limiting
- **Spike Arrest**: 100 requests per second per client
- **Quota**: 10,000 requests per month (configurable per API product)

### Error Handling
- Consistent error response format
- Specific error codes for different failure scenarios
- Retry-After headers for rate limit errors

### Logging & Analytics
- Request/response logging
- Response time tracking
- Custom analytics dimensions

## Deployment

### Prerequisites
1. Apigee Edge or Apigee X account
2. `apigeecli` or Apigee Management API access
3. Target servers configured in Apigee

### Configure Target Servers

Create target servers in Apigee:

```bash
# For Apigee X
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

### Configure KVM (Key-Value Map)

Store the JWT secret:

```bash
apigeecli kvms create --name easylife-secrets --org YOUR_ORG --env YOUR_ENV
apigeecli kvms entries create \
  --map easylife-secrets \
  --key jwt.secret \
  --value "your-jwt-secret-key" \
  --org YOUR_ORG \
  --env YOUR_ENV
```

### Deploy the Proxy

```bash
# Using apigeecli
cd apigee/apiproxy
zip -r ../easylife-admin-api.zip .
apigeecli apis create --name easylife-admin-api --file ../easylife-admin-api.zip --org YOUR_ORG
apigeecli apis deploy --name easylife-admin-api --rev 1 --env YOUR_ENV --org YOUR_ORG

# Or using the Management API
curl -X POST \
  "https://apigee.googleapis.com/v1/organizations/YOUR_ORG/apis?action=import&name=easylife-admin-api" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@easylife-admin-api.zip"
```

## API Products

Create an API Product to manage access:

```json
{
  "name": "easylife-admin-api-product",
  "displayName": "EasyLife Admin API",
  "description": "Access to EasyLife Admin Panel API",
  "approvalType": "auto",
  "proxies": ["easylife-admin-api"],
  "environments": ["dev", "prod"],
  "quota": "10000",
  "quotaInterval": "1",
  "quotaTimeUnit": "month",
  "scopes": ["read", "write", "admin"]
}
```

## Endpoints

### Authentication
- `POST /easylife/v1/auth/login` - User login
- `POST /easylife/v1/auth/register` - User registration
- `POST /easylife/v1/auth/refresh` - Token refresh
- `POST /easylife/v1/auth/forgot-password` - Password reset request
- `GET /easylife/v1/auth/csrf-token` - Get CSRF token

### Users
- `GET /easylife/v1/users` - List users
- `POST /easylife/v1/users` - Create user
- `GET /easylife/v1/users/{id}` - Get user
- `PUT /easylife/v1/users/{id}` - Update user
- `DELETE /easylife/v1/users/{id}` - Delete user

### Roles, Groups, Domains, Scenarios, etc.
Standard CRUD operations available for all entity types.

### Health
- `GET /easylife/v1/health/live` - Liveness check
- `GET /easylife/v1/health/ready` - Readiness check

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable message",
  "code": "ERROR_CODE",
  "status": 400,
  "timestamp": "2024-12-08T12:00:00.000Z",
  "requestId": "abc-123-def-456"
}
```

## Development

### Testing Locally

Use Apigee Emulator or deploy to a development environment:

```bash
# Start Apigee Emulator (if available)
npm install -g @apigee/emulator
apigee-emulator start --port 8080 --proxy ./apiproxy
```

### Updating Policies

After modifying policies, redeploy:

```bash
apigeecli apis update --name easylife-admin-api --file easylife-admin-api.zip --org YOUR_ORG
apigeecli apis deploy --name easylife-admin-api --rev LATEST --env YOUR_ENV --org YOUR_ORG
```
