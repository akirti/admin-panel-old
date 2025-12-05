# Password Consistency Fix

## Problem Identified

The MongoDB initialization script and backend were using **different passwords** for the default admin user, causing login failures.

### Root Cause

1. **mongo-init/01-init.js** - Used a hardcoded bcrypt hash that didn't match any standard password
   - Original comment claimed it was for `password123`, but it wasn't
   - Hash: `$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYV0q1I6YVUK`

2. **backend/app/main.py** - Creates super admin with password `admin123`
   - Used in `create_default_super_admin()` function
   - Documented in API docs as the default password

3. **Inconsistency** - Users couldn't log in because:
   - mongo-init created users with an unknown password
   - Backend documentation said password was `admin123`
   - Neither password worked with the hardcoded hash

## Solution Applied

### 1. Generated Correct Password Hash

Used backend's bcrypt configuration to generate a proper hash for `admin123`:

```bash
# Generated with passlib using bcrypt
$2b$12$V4Stl/Nn.3qoopgu9ZzDI.bjvdtZnQomVJLk2sJrwEXcG38jMyk6a
```

This hash was verified to work with `admin123`:
```python
pwd_context.verify('admin123', hash) # Returns True
```

### 2. Updated mongo-init/01-init.js

**Before:**
```javascript
// Password hash is for 'password123' using bcrypt
var passwordHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYV0q1I6YVUK';
```

**After:**
```javascript
// Password hash is for 'admin123' using bcrypt (matches backend default)
var passwordHash = '$2b$12$V4Stl/Nn.3qoopgu9ZzDI.bjvdtZnQomVJLk2sJrwEXcG38jMyk6a';
```

Also updated the output message:
```javascript
// Before:
print('Test Users (password: password123):');

// After:
print('Test Users (password: admin123):');
```

### 3. Updated Documentation Files

Updated password information in:
- **MONGODB_FIX_SUMMARY.md** - Changed test user password from `password123` to `admin123`
- **MONGODB_INIT_README.md** - Changed test user password from `password123` to `admin123`

## Verification

After reinitialization with `docker-compose down -v && docker-compose up -d`:

### Database Check
```bash
$ docker exec admin-panel-mongodb mongosh "mongodb://admin:admin123@localhost:27017/admin_panel?authSource=admin" --eval "
  db.users.findOne({email: 'admin@example.com'}, {password_hash: 1, is_super_admin: 1})
"
```

Output:
```json
{
  "password_hash": "$2b$12$V4Stl/Nn.3qoopgu9ZzDI.bjvdtZnQomVJLk2sJrwEXcG38jMyk6a",
  "is_super_admin": true
}
```

### Password Verification
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

stored_hash = '$2b$12$V4Stl/Nn.3qoopgu9ZzDI.bjvdtZnQomVJLk2sJrwEXcG38jMyk6a'
pwd_context.verify('admin123', stored_hash)  # ✓ True
pwd_context.verify('password123', stored_hash)  # ✗ False
```

### Login Test
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "admin@example.com", "password": "admin123"}'
```

Expected: Returns JWT token (after rate limit clears)

## Current Status

✅ **All test users now use password: `admin123`**

This matches:
- Backend default password for super admin
- API documentation
- All README files

## Test User Credentials

All users created by mongo-init script now have the same password:

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | Super Admin |
| manager@example.com | admin123 | Admin |
| editor@example.com | admin123 | Editor |
| viewer@example.com | admin123 | Viewer |
| sales@example.com | admin123 | Sales Manager |
| inactive@example.com | admin123 | Inactive User |

## Files Modified

1. **mongo-init/01-init.js**
   - Line 294-296: Updated password hash and comment
   - Line 717: Updated output message

2. **MONGODB_FIX_SUMMARY.md**
   - Line 150-159: Updated test user password documentation

3. **MONGODB_INIT_README.md**
   - Line 155-160: Updated notes section

4. **PASSWORD_FIX_SUMMARY.md** (NEW)
   - This file - comprehensive documentation of password fix

## Important Notes

- **Security Warning**: The password `admin123` is meant for development/testing only
- **Production**: Always change default passwords in production environments
- **Password Hash**: Each bcrypt hash includes a random salt, so generating a new hash for the same password will produce a different result (this is normal and secure)
- **Consistency**: All documentation now consistently references `admin123` as the default password

## How to Regenerate Password Hash

If you need to change the default password in the future:

```bash
# Inside backend container
docker exec admin-panel-backend python3 -c "
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
print(pwd_context.hash('your_new_password'))
"
```

Then update line 296 in `mongo-init/01-init.js` with the new hash.
