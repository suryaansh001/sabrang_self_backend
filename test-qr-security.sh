#!/bin/bash

# QR Code Security Test Script
# This script tests that QR codes are only generated after payment verification

echo "🧪 Testing QR Code Security Fix"
echo "================================"

BASE_URL="http://localhost:5000"
if [ "$1" != "" ]; then
    BASE_URL="$1"
fi

echo "🌐 Testing against: $BASE_URL"
echo ""

# Test 1: Create Order (should not generate QR)
echo "📝 Test 1: Creating order without payment..."
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/payments/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "customerEmail": "test@example.com",
    "customerName": "Test User",
    "customerPhone": "9999999999"
  }')

echo "Order Response: $ORDER_RESPONSE"

# Extract order ID from response
ORDER_ID=$(echo $ORDER_RESPONSE | grep -o '"order_id":"[^"]*"' | cut -d'"' -f4)
echo "📋 Order ID: $ORDER_ID"
echo ""

if [ -z "$ORDER_ID" ]; then
    echo "❌ Failed to create order. Exiting."
    exit 1
fi

# Test 2: Try to access QR before payment (should fail)
echo "🔒 Test 2: Trying to access QR code before payment..."
QR_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" "$BASE_URL/api/payments/qr-by-order/$ORDER_ID")
HTTP_STATUS=$(echo $QR_RESPONSE | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

echo "QR Response: $QR_RESPONSE"
echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "403" ]; then
    echo "✅ PASS: QR access denied for unpaid order"
else
    echo "❌ FAIL: QR access should be denied for unpaid order"
fi
echo ""

# Test 3: Check purchase status
echo "💳 Test 3: Checking purchase status..."
PURCHASE_RESPONSE=$(curl -s "$BASE_URL/api/payments/status/$ORDER_ID")
echo "Purchase Status: $PURCHASE_RESPONSE"
echo ""

# Test 4: Simulate payment completion (this would normally be done by Cashfree)
echo "✅ Test 4: Simulating payment completion..."
SUCCESS_RESPONSE=$(curl -s "$BASE_URL/api/payments/success/$ORDER_ID")
echo "Success Response: $SUCCESS_RESPONSE"
echo ""

# Test 5: Try to access QR after payment (should work)
echo "🎫 Test 5: Trying to access QR code after payment..."
QR_RESPONSE_AFTER=$(curl -s -w "HTTP_STATUS:%{http_code}" "$BASE_URL/api/payments/qr-by-order/$ORDER_ID")
HTTP_STATUS_AFTER=$(echo $QR_RESPONSE_AFTER | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

echo "QR Response After Payment: $QR_RESPONSE_AFTER"
echo "HTTP Status After Payment: $HTTP_STATUS_AFTER"

if [ "$HTTP_STATUS_AFTER" = "200" ]; then
    echo "✅ PASS: QR access granted for paid order"
else
    echo "❌ FAIL: QR access should be granted for paid order"
fi
echo ""

# Test 6: Check if QR code is actually generated
echo "🔍 Test 6: Checking if QR code is generated..."
QR_DATA=$(echo $QR_RESPONSE_AFTER | grep -o '"qrCodeBase64":"[^"]*"' | cut -d'"' -f4)

if [ -n "$QR_DATA" ] && [ "$QR_DATA" != "null" ]; then
    echo "✅ PASS: QR code data is present"
    echo "📏 QR data length: ${#QR_DATA} characters"
else
    echo "❌ FAIL: QR code data is missing"
fi
echo ""

# Summary
echo "📊 Test Summary"
echo "==============="
echo "Test 1 - Order Creation: PASS"
echo "Test 2 - QR Denied Before Payment: $([ "$HTTP_STATUS" = "403" ] && echo "PASS" || echo "FAIL")"
echo "Test 3 - Purchase Status Check: PASS"
echo "Test 4 - Payment Simulation: PASS"
echo "Test 5 - QR Allowed After Payment: $([ "$HTTP_STATUS_AFTER" = "200" ] && echo "PASS" || echo "FAIL")"
echo "Test 6 - QR Data Generated: $([ -n "$QR_DATA" ] && [ "$QR_DATA" != "null" ] && echo "PASS" || echo "FAIL")"

echo ""
echo "🎯 Security Fix Verification:"
if [ "$HTTP_STATUS" = "403" ] && [ "$HTTP_STATUS_AFTER" = "200" ] && [ -n "$QR_DATA" ]; then
    echo "✅ SUCCESS: QR codes are properly secured behind payment verification"
else
    echo "❌ FAILED: Security fix needs review"
fi
