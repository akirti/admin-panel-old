# MongoDB Initialization Guide

## Important: Init Script Behavior

The MongoDB initialization script (`mongo-init/01-init.js`) **only runs ONCE** when the MongoDB container is first created with an empty data volume. This is standard Docker behavior for MongoDB init scripts.

## Common Issue: Database Not Initializing

If your database appears empty or data is not being inserted, it's likely because:

1. **The MongoDB volume already exists** - Docker persists the `mongodb_data` volume across container restarts
2. **The init script already ran** - It won't run again unless you remove the volume

## How to Reinitialize the Database

To force the initialization script to run again, you need to remove the existing MongoDB volume:

### Option 1: Remove volumes and restart (Recommended)

```bash
# Stop containers and remove volumes
docker-compose down -v

# Start fresh - init script will run
docker-compose up -d

# Check logs to see initialization progress
docker-compose logs mongodb
```

### Option 2: Remove only MongoDB data

```bash
# Stop containers
docker-compose down

# Remove the MongoDB volume specifically
docker volume rm admin-panel-scratch-3_mongodb_data

# Start again
docker-compose up -d
```

### Option 3: Check if data already exists

```bash
# Connect to MongoDB
docker exec -it admin-panel-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin

# Switch to admin_panel database
use admin_panel

# Check collections
show collections

# Count documents in a collection
db.users.countDocuments()
db.permissions.countDocuments()
```

## Verifying Initialization

After running `docker-compose up`, check the MongoDB logs:

```bash
docker-compose logs mongodb | grep -E "(✓|✗|inserted|created)"
```

You should see output like:
```
✓ Collections created successfully
✓ Permissions inserted: 25
✓ Customers inserted: 5
✓ Domains inserted: 4
✓ Roles inserted: 4
✓ Groups inserted: 3
✓ Users inserted: 6
... etc
```

## Expected Data Counts

After successful initialization, you should have:

- **Permissions**: ~25 entries
- **Customers**: 5 entries
- **Domains**: 4 entries
- **Roles**: 4 entries
- **Groups**: 3 entries
- **Users**: 6 entries
- **Domain Scenarios**: 10 entries
- **Playboards**: 4 entries
- **Configurations**: 4 entries
- **Audit Logs**: 24 entries

## Troubleshooting

### Issue: "Database already initialized. Skipping..."

This means the init script detected existing collections and skipped initialization. If you need to reset:

```bash
docker-compose down -v
docker-compose up -d
```

### Issue: Init script fails partway through

Check the MongoDB logs for error messages:

```bash
docker-compose logs mongodb
```

Common causes:
- Syntax errors in the init script
- Memory/resource constraints
- Duplicate key errors (if data exists)

### Issue: Cannot connect to MongoDB

Check if MongoDB is running and healthy:

```bash
docker-compose ps
docker-compose logs mongodb
```

Wait for the health check to pass:
```
mongodb | {"t":{"$date":"..."},"s":"I","c":"NETWORK","id":23016,"ctx":"listener","msg":"Waiting for connections","attr":{"port":27017,"ssl":"off"}}
```

## Manual Data Insertion (Alternative)

If you need to insert data without reinitializing:

```bash
# Connect to MongoDB
docker exec -it admin-panel-mongodb mongosh mongodb://admin:admin123@localhost:27017/admin_panel?authSource=admin

# Run the init script manually
load('/docker-entrypoint-initdb.d/01-init.js')
```

## Development Workflow

For development, if you frequently need to reset data:

1. Keep the volume between sessions: `docker-compose up -d`
2. Reset when needed: `docker-compose down -v && docker-compose up -d`
3. Use the backend's seed endpoint: `POST /api/seed` (if available)
4. Or manually truncate collections via MongoDB shell

## Notes

- The init script includes safety checks to prevent duplicate insertions
- Root credentials are: `admin` / `admin123` (change in production!)
- Default super admin: `admin@example.com` / `admin123`
- All test users have password: `admin123`
