# MongoDB Init Script Fix Summary

## Problem Identified

The MongoDB initialization script was **failing partway through** due to:

1. **`.map()` syntax error** - The script was calling `.map()` directly on MongoDB cursors without converting to arrays first
2. **Missing error handling** - When the script failed, it failed silently with no clear error messages
3. **No validation checks** - The script didn't validate data before continuing

## Root Cause

At line 137-139, the script had:
```javascript
var allPermissions = db.permissions.find().map(function(p) { return p.key; });
var viewPermissions = db.permissions.find({ 'actions': 'read' }).map(function(p) { return p.key; });
var allDomains = db.domains.find().map(function(d) { return d.key; });
```

MongoDB cursors need `.toArray()` before `.map()` can be called. This caused a silent failure that stopped the script execution.

## Solution Applied

### 1. Fixed Cursor Mapping
```javascript
var allPermissions = db.permissions.find().toArray().map(function(p) { return p.key; });
var viewPermissions = db.permissions.find({ 'actions': 'read' }).toArray().map(function(p) { return p.key; });
var allDomains = db.domains.find().toArray().map(function(d) { return d.key; });
```

### 2. Added Comprehensive Error Handling

Wrapped each major section with try-catch blocks:
```javascript
print('Inserting permissions...');
try {
    db.permissions.insertMany([...]);
    print('✓ Permissions inserted: ' + db.permissions.countDocuments());
} catch (error) {
    print('✗ Error inserting permissions: ' + error);
    throw error;
}
```

### 3. Added Progress Indicators

Added checkmarks (✓) and crosses (✗) for visual feedback:
- ✓ = Operation succeeded
- ✗ = Operation failed

### 4. Added Initialization Check

Prevents re-running on existing data:
```javascript
var collectionsCount = db.getCollectionNames().length;
if (collectionsCount > 0) {
    print('Database already initialized. Skipping...');
    print('To reinitialize, run: docker-compose down -v');
    quit();
}
```

## Verification Results

After fixing, all collections are now properly populated:

```
✓ audit_logs: 24
✓ configurations: 3
✓ customers: 5
✓ domain_scenarios: 10
✓ domains: 6
✓ groups: 5
✓ permissions: 30
✓ playboards: 3
✓ roles: 5
✓ tokens: 0 (EMPTY - expected)
✓ users: 6
```

## How to Reinitialize

If you need to reinitialize the database in the future:

```bash
# Option 1: Use the helper script
./fix_mongo_init.sh

# Option 2: Manual commands
docker-compose down -v
docker-compose up -d

# Option 3: Just remove the volume
docker-compose down
docker volume rm admin-panel-scratch-3_mongodb_data
docker-compose up -d
```

## Monitoring Initialization

Check logs to see initialization progress:
```bash
docker-compose logs mongodb | grep -E "(✓|✗|Starting|COMPLETE)"
```

Expected output:
```
Starting database initialization...
✓ Collections created successfully
✓ Permissions inserted: 30
✓ Customers inserted: 5
✓ Loaded 30 permissions, 6 domains
✓ Roles inserted: 5
✓ Groups inserted: 5
✓ Users inserted: 6
✓ Domain Scenarios inserted: 10
✓ Playboards inserted: 3
✓ Configurations inserted: 3
✓ Audit logs inserted: 24
✓ Indexes created successfully
DATABASE INITIALIZATION COMPLETE
```

## Files Modified

1. **mongo-init/01-init.js**
   - Added initialization check at start
   - Fixed cursor.toArray() bug on line 139-141
   - Added try-catch blocks for all insert operations
   - Added progress indicators with ✓/✗
   - Improved error messages

2. **MONGODB_INIT_README.md** (NEW)
   - Comprehensive guide on MongoDB initialization
   - Troubleshooting steps
   - Expected data counts

3. **fix_mongo_init.sh** (NEW)
   - Helper script for easy reinitialization
   - Automatically checks data after init

## Important Notes

- The init script **only runs ONCE** when MongoDB starts with an empty volume
- To re-run the script, you **must** remove the `mongodb_data` volume
- The script now has safety checks to prevent duplicate data
- All errors are now logged with clear messages
- Progress is tracked with visual indicators

## Test Users Created

The script creates these test users (all with password `admin123`):

- `admin@example.com` - Super Admin
- `manager@example.com` - Admin role
- `editor@example.com` - Editor role
- `viewer@example.com` - Viewer role
- `sales@example.com` - Sales Manager role
- `inactive@example.com` - Inactive user

## Next Steps

The database is now fully initialized and ready for use. You can:

1. Access the frontend at: http://localhost:3000
2. Access the backend API docs at: http://localhost:8000/docs
3. Connect to MongoDB at: mongodb://admin:admin123@localhost:27017/admin_panel?authSource=admin

Login with: `admin@example.com` / `admin123` (the super admin account created by the backend)
