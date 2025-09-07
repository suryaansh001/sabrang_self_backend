#!/bin/bash

# Backend Payment Integration Test Script

echo "🧪 Testing Sabrang Backend Payment Integration"
echo "=============================================="

# Backend URL
BACKEND_URL="http://localhost:5000"

# Test credentials (you should have these in your .env file)
echo "📋 Pre-test checklist:"
echo "1. ✅ Backend server is running on port 5000"
echo "2. ✅ MongoDB is connected"
echo "3. ✅ Cashfree credentials are set in .env"
echo "4. ✅ Frontend URL is set in CORS configuration"
echo ""

# Function to test API endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo "🔍 Testing: $description"
    echo "   Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BACKEND_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo "   ✅ Success ($http_code)"
    else
        echo "   ❌ Failed ($http_code)"
        echo "   Response: $body"
    fi
    echo ""
}

# Test basic server health
test_endpoint "GET" "/health" "" "Server Health Check"

# Test events endpoint
test_endpoint "GET" "/admin/events-public" "" "Get Public Events"

# Test promo code validation (public endpoint)
test_data='{"code": "EARLYBIRD", "userEmail": "test@example.com", "orderAmount": 200}'
test_endpoint "POST" "/admin/promo-codes/validate" "$test_data" "Promo Code Validation"

echo "🎯 Manual Testing Steps:"
echo "1. Start the backend server: npm run dev"
echo "2. Start the frontend: npm run dev (in frontend directory)"
echo "3. Navigate to /checkout page"
echo "4. Select events and try payment flow"
echo "5. Use test promo codes: EARLYBIRD, STUDENT50, WELCOME10"
echo ""

echo "📝 Cashfree Testing:"
echo "1. Use sandbox mode for testing"
echo "2. Test cards:"
echo "   - Success: 4111 1111 1111 1111"
echo "   - Failure: 4012 0010 3714 1112"
echo "3. Use any valid expiry date and CVV"
echo ""

echo "🚀 Production Deployment Checklist:"
echo "1. [ ] Update CASHFREE_APP_ID and CASHFREE_SECRET_KEY with production values"
echo "2. [ ] Change CFEnvironment to PRODUCTION in payment routes"
echo "3. [ ] Update FRONTEND_URL to production domain"
echo "4. [ ] Update CORS origins to include production domain"
echo "5. [ ] Set up SSL/HTTPS"
echo "6. [ ] Configure webhook URLs in Cashfree dashboard"
echo "7. [ ] Test end-to-end payment flow"
echo ""

echo "📊 Monitoring Endpoints:"
echo "- GET /admin/purchases - View all purchases"
echo "- GET /admin/purchases/analytics - Payment analytics"
echo "- GET /admin/promo-codes - Manage promo codes"
echo "- GET /admin/checkout-offers - Manage combo offers"
echo ""

echo "🔧 Environment Variables Required:"
echo "CASHFREE_APP_ID=your-app-id"
echo "CASHFREE_SECRET_KEY=your-secret-key"
echo "FRONTEND_URL=http://localhost:3000"
echo "mongodb=your-mongodb-connection-string"
echo "jwtkey=your-jwt-secret"
echo ""

echo "Test completed! Check the results above."
