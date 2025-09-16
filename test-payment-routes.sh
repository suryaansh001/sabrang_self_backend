#!/bin/bash

# Payment Routes Test Script
# Usage: ./test-payment-routes.sh [endpoint]

BASE_URL="https://surprising-balance-production.up.railway.app"
API_BASE="$BASE_URL/api/payment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_title() {
    echo -e "\n${CYAN}🧪 $1${NC}"
    echo "============================================================"
}

# Test data
TEST_USER='{
  "userDetails": {
    "name": "Test User",
    "email": "test@example.com",
    "contactNo": "9999999999",
    "gender": "Other",
    "age": 22,
    "universityName": "Test University",
    "address": "Test Address"
  },
  "items": [
    {
      "eventId": "test_event_1",
      "eventName": "Test Event 1",
      "price": 100
    }
  ],
  "totalAmount": 100,
  "promoCode": null,
  "metadata": {
    "source": "curl_test"
  }
}'

# Test functions
test_health() {
    log_title "Health Check"
    log_info "Testing server connectivity..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
    
    if [ "$response" = "200" ]; then
        log_success "Server is running (Status: $response)"
    else
        log_error "Server health check failed (Status: $response)"
        return 1
    fi
}

test_validate_promo() {
    log_title "Testing Promo Code Validation"
    
    log_info "Testing valid promo code..."
    curl -X POST "$API_BASE/validate-promo" \
         -H "Content-Type: application/json" \
         -d '{"code": "WELCOME25", "totalAmount": 500}' \
         -w "\nStatus: %{http_code}\n" -s
    
    echo ""
    log_info "Testing invalid promo code..."
    curl -X POST "$API_BASE/validate-promo" \
         -H "Content-Type: application/json" \
         -d '{"code": "INVALID", "totalAmount": 500}' \
         -w "\nStatus: %{http_code}\n" -s
}

test_create_session() {
    log_title "Testing Create Session Endpoint"
    
    log_info "Making POST request to /create-session..."
    response=$(curl -X POST "$API_BASE/create-session" \
                    -H "Content-Type: application/json" \
                    -d "$TEST_USER" \
                    -w "\nHTTP_STATUS:%{http_code}" -s)
    
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    response_body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    echo "$response_body" | jq . 2>/dev/null || echo "$response_body"
    echo "Status: $http_status"
    
    # Extract order ID if successful
    if [ "$http_status" = "200" ]; then
        ORDER_ID=$(echo "$response_body" | jq -r '.data.orderId' 2>/dev/null)
        if [ "$ORDER_ID" != "null" ] && [ "$ORDER_ID" != "" ]; then
            log_success "Order ID extracted: $ORDER_ID"
            echo "$ORDER_ID" > /tmp/test_order_id
        fi
    fi
}

test_create_order() {
    log_title "Testing Create Order Endpoint"
    
    log_info "Making POST request to /create-order..."
    curl -X POST "$API_BASE/create-order" \
         -H "Content-Type: application/json" \
         -d "$TEST_USER" \
         -w "\nStatus: %{http_code}\n" -s | jq . 2>/dev/null || curl -X POST "$API_BASE/create-order" \
         -H "Content-Type: application/json" \
         -d "$TEST_USER" \
         -w "\nStatus: %{http_code}\n" -s
}

test_fetch_payments() {
    log_title "Testing Fetch Payments Endpoint"
    
    ORDER_ID=$1
    if [ -z "$ORDER_ID" ] && [ -f "/tmp/test_order_id" ]; then
        ORDER_ID=$(cat /tmp/test_order_id)
    fi
    
    if [ -z "$ORDER_ID" ]; then
        ORDER_ID="SABRANG_test_123"
        log_warn "Using default order ID: $ORDER_ID"
    fi
    
    log_info "Fetching payments for order: $ORDER_ID"
    curl -X GET "$API_BASE/fetch-payments/$ORDER_ID" \
         -w "\nStatus: %{http_code}\n" -s | jq . 2>/dev/null || curl -X GET "$API_BASE/fetch-payments/$ORDER_ID" \
         -w "\nStatus: %{http_code}\n" -s
}

test_verify_payment() {
    log_title "Testing Verify Payment Endpoint"
    
    ORDER_ID=$1
    if [ -z "$ORDER_ID" ] && [ -f "/tmp/test_order_id" ]; then
        ORDER_ID=$(cat /tmp/test_order_id)
    fi
    
    if [ -z "$ORDER_ID" ]; then
        ORDER_ID="SABRANG_test_123"
        log_warn "Using default order ID: $ORDER_ID"
    fi
    
    log_info "Verifying payment for order: $ORDER_ID"
    curl -X POST "$API_BASE/verify-payment" \
         -H "Content-Type: application/json" \
         -d "{\"orderId\": \"$ORDER_ID\", \"paymentId\": \"test_payment_id\"}" \
         -w "\nStatus: %{http_code}\n" -s | jq . 2>/dev/null || curl -X POST "$API_BASE/verify-payment" \
         -H "Content-Type: application/json" \
         -d "{\"orderId\": \"$ORDER_ID\", \"paymentId\": \"test_payment_id\"}" \
         -w "\nStatus: %{http_code}\n" -s
}

test_webhook() {
    log_title "Testing Webhook Endpoint"
    
    log_info "Testing webhook with sample data..."
    curl -X POST "$API_BASE/webhook" \
         -H "Content-Type: application/json" \
         -d '{
           "type": "PAYMENT_SUCCESS_WEBHOOK",
           "data": {
             "order": {
               "order_id": "SABRANG_test_123"
             },
             "payment": {
               "payment_status": "SUCCESS",
               "payment_amount": 100
             }
           }
         }' \
         -w "\nStatus: %{http_code}\n" -s | jq . 2>/dev/null || curl -X POST "$API_BASE/webhook" \
         -H "Content-Type: application/json" \
         -d '{
           "type": "PAYMENT_SUCCESS_WEBHOOK",
           "data": {
             "order": {
               "order_id": "SABRANG_test_123"
             },
             "payment": {
               "payment_status": "SUCCESS",
               "payment_amount": 100
             }
           }
         }' \
         -w "\nStatus: %{http_code}\n" -s
}

test_payment_status() {
    log_title "Testing Payment Status Endpoint"
    
    ORDER_ID=$1
    if [ -z "$ORDER_ID" ] && [ -f "/tmp/test_order_id" ]; then
        ORDER_ID=$(cat /tmp/test_order_id)
    fi
    
    if [ -z "$ORDER_ID" ]; then
        ORDER_ID="SABRANG_test_123"
        log_warn "Using default order ID: $ORDER_ID"
    fi
    
    log_info "Getting status for order: $ORDER_ID"
    curl -X GET "$API_BASE/status/$ORDER_ID" \
         -w "\nStatus: %{http_code}\n" -s | jq . 2>/dev/null || curl -X GET "$API_BASE/status/$ORDER_ID" \
         -w "\nStatus: %{http_code}\n" -s
}

run_all_tests() {
    echo -e "${CYAN}🚀 Payment Routes Test Suite${NC}"
    echo "======================================"
    echo "Base URL: $BASE_URL"
    echo "API Base: $API_BASE"
    echo "======================================"
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        log_warn "jq is not installed. JSON responses will not be formatted."
    fi
    
    # Health check first
    if ! test_health; then
        log_error "Server is not responding. Aborting tests."
        exit 1
    fi
    
    # Run all tests
    test_validate_promo
    test_create_session
    test_create_order
    test_fetch_payments
    test_verify_payment
    test_webhook
    test_payment_status
    
    log_title "Test Summary"
    log_success "All tests completed! Check the results above."
    log_info "Note: Some endpoints may fail if Cashfree credentials are not properly configured."
    
    # Cleanup
    rm -f /tmp/test_order_id
}

# Main execution
case "$1" in
    "health")
        test_health
        ;;
    "promo")
        test_validate_promo
        ;;
    "create-session")
        test_create_session
        ;;
    "create-order")
        test_create_order
        ;;
    "fetch")
        test_fetch_payments "$2"
        ;;
    "verify")
        test_verify_payment "$2"
        ;;
    "webhook")
        test_webhook
        ;;
    "status")
        test_payment_status "$2"
        ;;
    "all"|"")
        run_all_tests
        ;;
    *)
        echo "Usage: $0 [health|promo|create-session|create-order|fetch|verify|webhook|status|all]"
        echo ""
        echo "Examples:"
        echo "  $0 health                    # Test server connectivity"
        echo "  $0 create-session           # Test create session endpoint"
        echo "  $0 create-order             # Test create order endpoint"
        echo "  $0 fetch ORDER_ID           # Test fetch payments for specific order"
        echo "  $0 all                      # Run all tests"
        exit 1
        ;;
esac
