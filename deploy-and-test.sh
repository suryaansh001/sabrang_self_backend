#!/bin/bash

# Deploy and Test Script
# This script helps deploy changes and test the payment routes

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
log_title() { echo -e "\n${CYAN}🚀 $1${NC}\n${'='.repeat(50)}"; }

BACKEND_URL="https://surprising-balance-production.up.railway.app"

deploy_changes() {
    log_title "Deploying Changes"
    
    log_info "Checking git status..."
    if [[ -n $(git status --porcelain) ]]; then
        log_warn "Uncommitted changes found. Committing..."
        git add .
        git commit -m "Update payment routes with create-order endpoint"
    fi
    
    log_info "Pushing to remote..."
    git push origin main
    
    log_success "Changes pushed. Railway should auto-deploy."
    log_warn "Note: Deployment may take 2-3 minutes."
}

wait_for_deployment() {
    log_title "Waiting for Deployment"
    
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for deployment to complete..."
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Attempt $attempt/$max_attempts - Checking server status..."
        
        response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL" || echo "000")
        
        if [ "$response" = "200" ]; then
            log_success "Server is responding!"
            break
        else
            log_warn "Server not ready (Status: $response). Waiting 10 seconds..."
            sleep 10
        fi
        
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log_error "Deployment check timed out. Please check Railway dashboard."
        return 1
    fi
}

test_routes() {
    log_title "Testing Payment Routes"
    
    log_info "Testing create-session endpoint..."
    create_session_status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$BACKEND_URL/api/payment/create-session" \
        -H "Content-Type: application/json" \
        -d '{"userDetails":{"name":"Test","email":"test@test.com"},"items":[{"eventId":"test","eventName":"Test","price":100}],"totalAmount":100}')
    
    log_info "Testing create-order endpoint..."
    create_order_status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$BACKEND_URL/api/payment/create-order" \
        -H "Content-Type: application/json" \
        -d '{"userDetails":{"name":"Test","email":"test@test.com"},"items":[{"eventId":"test","eventName":"Test","price":100}],"totalAmount":100}')
    
    log_info "Testing status endpoint..."
    status_status=$(curl -s -o /dev/null -w "%{http_code}" \
        "$BACKEND_URL/api/payment/status/test")
    
    echo ""
    log_title "Test Results"
    
    if [ "$create_session_status" != "404" ]; then
        log_success "create-session: Available (Status: $create_session_status)"
    else
        log_error "create-session: Not found (Status: $create_session_status)"
    fi
    
    if [ "$create_order_status" != "404" ]; then
        log_success "create-order: Available (Status: $create_order_status)"
    else
        log_error "create-order: Not found (Status: $create_order_status)"
    fi
    
    if [ "$status_status" = "200" ]; then
        log_success "status: Available (Status: $status_status)"
    else
        log_warn "status: Unexpected response (Status: $status_status)"
    fi
}

run_comprehensive_tests() {
    log_title "Running Comprehensive Tests"
    
    if command -v node &> /dev/null; then
        log_info "Running Node.js test suite..."
        node test-payment-routes.js all
    else
        log_warn "Node.js not found. Running bash tests..."
        ./test-payment-routes.sh all
    fi
}

show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy     - Deploy changes to Railway"
    echo "  wait       - Wait for deployment to complete"
    echo "  test       - Test basic route availability"
    echo "  full-test  - Run comprehensive test suite"
    echo "  all        - Deploy, wait, and test (default)"
    echo ""
    echo "Examples:"
    echo "  $0 deploy     # Just deploy changes"
    echo "  $0 test       # Just test routes"
    echo "  $0 all        # Full deploy and test cycle"
}

main() {
    case "${1:-all}" in
        "deploy")
            deploy_changes
            ;;
        "wait")
            wait_for_deployment
            ;;
        "test")
            test_routes
            ;;
        "full-test")
            run_comprehensive_tests
            ;;
        "all")
            deploy_changes
            wait_for_deployment
            test_routes
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
