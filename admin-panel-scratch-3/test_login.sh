#!/bin/bash

echo "========================================"
echo "Admin Panel Login Test"
echo "========================================"
echo ""

# Test login
echo "Testing login with admin@example.com / admin123..."
RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "admin@example.com", "password": "admin123"}')

# Check if we got a token
if echo "$RESPONSE" | grep -q "access_token"; then
  echo "✓ Login successful!"
  TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")
  echo "✓ JWT Token received (length: ${#TOKEN} chars)"
  
  # Test authenticated endpoint
  echo ""
  echo "Testing authenticated endpoint..."
  USER_RESPONSE=$(curl -s http://localhost:8000/api/users/me \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$USER_RESPONSE" | grep -q "admin@example.com"; then
    echo "✓ Authenticated endpoint works!"
    echo "✓ User data retrieved successfully"
  else
    echo "✗ Authenticated endpoint failed"
    echo "Response: $USER_RESPONSE"
  fi
else
  echo "✗ Login failed!"
  echo "Response: $RESPONSE"
  exit 1
fi

echo ""
echo "========================================"
echo "All tests passed!"
echo "========================================"
