#!/bin/bash
echo "========================================="
echo "MongoDB Database Status Check"
echo "========================================="
echo ""

# Check if container is running
if ! docker ps | grep -q admin-panel-mongodb; then
    echo "❌ MongoDB container is not running!"
    echo "Run: docker-compose up -d"
    exit 1
fi

echo "✓ MongoDB container is running"
echo ""

# Check collection counts
echo "Collection Counts:"
echo "=================="
docker exec admin-panel-mongodb mongosh "mongodb://admin:admin123@localhost:27017/admin_panel?authSource=admin" --quiet --eval "
db.getCollectionNames().sort().forEach(function(c) {
  var count = db[c].countDocuments();
  var expected = {
    'audit_logs': 24,
    'configurations': 3,
    'customers': 5,
    'domain_scenarios': 10,
    'domains': 6,
    'groups': 5,
    'permissions': 30,
    'playboards': 3,
    'roles': 5,
    'users': 6,
    'tokens': 0
  };
  
  var exp = expected[c] || 0;
  var icon = (count >= exp && exp > 0) || (c === 'tokens' && count === 0) ? '✓' : '✗';
  var status = (count >= exp && exp > 0) || (c === 'tokens' && count === 0) ? 'OK' : 'MISSING DATA';
  
  print(icon + ' ' + c + ': ' + count + ' (expected: ' + exp + ') - ' + status);
});
"

echo ""
echo "========================================="
echo "Status: $(docker exec admin-panel-mongodb mongosh "mongodb://admin:admin123@localhost:27017/admin_panel?authSource=admin" --quiet --eval "db.users.countDocuments() > 0 ? '✓ Database initialized' : '✗ Database needs initialization'")"
echo "========================================="
