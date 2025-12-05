#!/bin/bash
# This script will reinitialize the MongoDB database by removing the volume and restarting

echo "========================================="
echo "MongoDB Database Reinitialization Script"
echo "========================================="
echo ""
echo "This will:"
echo "  1. Stop all containers"
echo "  2. Remove MongoDB data volume"
echo "  3. Restart containers (init script will run)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo "Stopping containers..."
docker-compose down

echo "Removing MongoDB volume..."
docker volume rm admin-panel-scratch-3_mongodb_data 2>/dev/null || echo "Volume already removed or doesn't exist"

echo "Starting containers..."
docker-compose up -d

echo ""
echo "Waiting for MongoDB to be ready..."
sleep 5

echo ""
echo "Checking initialization progress..."
docker-compose logs mongodb | tail -30

echo ""
echo "========================================="
echo "Checking database contents..."
docker exec admin-panel-mongodb mongosh "mongodb://admin:admin123@localhost:27017/admin_panel?authSource=admin" --quiet --eval "
  print('Collection counts:');
  db.getCollectionNames().sort().forEach(function(c) {
    var count = db[c].countDocuments();
    if (count > 0) {
      print('  ✓ ' + c + ': ' + count);
    } else {
      print('  ✗ ' + c + ': 0 (EMPTY)');
    }
  });
"

echo ""
echo "========================================="
echo "Done! Check the output above."
echo "If collections are still empty, check: docker-compose logs mongodb"
