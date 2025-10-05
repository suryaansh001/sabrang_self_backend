#!/bin/bash

# Complete Payment Flow Test Setup and Execution
# This script ensures the server is running and then tests the payment flow

echo "🚀 Setting up Complete Payment Flow Test"
echo "========================================"

# Check if the server is already running
if curl -s http://localhost:5000/ > /dev/null 2>&1; then
    echo "✅ Server is already running"
    echo "🧪 Running payment flow test..."
    node test-payment-flow-complete.js
else
    echo "📡 Server not running, starting it in background..."
    
    # Start the server in background
    npm start > server.log 2>&1 &
    SERVER_PID=$!
    
    echo "⏳ Waiting for server to start..."
    
    # Wait for server to be ready (max 30 seconds)
    for i in {1..30}; do
        if curl -s http://localhost:5000/ > /dev/null 2>&1; then
            echo "✅ Server is ready (took ${i} seconds)"
            break
        fi
        echo "   Waiting... (${i}/30)"
        sleep 1
    done
    
    # Check if server is running
    if curl -s http://localhost:5000/ > /dev/null 2>&1; then
        echo "🧪 Running payment flow test..."
        node test-payment-flow-complete.js
        TEST_RESULT=$?
        
        echo "🛑 Stopping server..."
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
        
        exit $TEST_RESULT
    else
        echo "❌ Server failed to start after 30 seconds"
        echo "📋 Server logs:"
        cat server.log
        
        # Clean up
        kill $SERVER_PID 2>/dev/null
        exit 1
    fi
fi