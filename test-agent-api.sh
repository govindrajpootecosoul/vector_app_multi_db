#!/bin/bash

# AI Agent API Testing Script for Bash/Linux/Mac

BASE_URL="http://localhost:3111"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"  # Replace with your actual JWT token

echo "========================================"
echo "AI Agent API Testing"
echo "========================================"

# Test 1: Server Health
echo ""
echo "1. Testing server health..."
curl -s $BASE_URL/health | jq '.' || echo "❌ Server is not running"

# Test 2: Ollama Health Check
echo ""
echo "2. Testing Ollama connection..."
curl -s $BASE_URL/api/agent/health | jq '.' || echo "❌ Ollama health check failed"

# Test 3: Get Available Tools (requires auth)
if [ "$JWT_TOKEN" != "YOUR_JWT_TOKEN_HERE" ]; then
    echo ""
    echo "3. Getting available tools..."
    curl -s -X GET $BASE_URL/api/agent/tools \
        -H "Authorization: Bearer $JWT_TOKEN" | jq '.data | length' || echo "❌ Failed to get tools"
    
    # Test 4: Simple Query
    echo ""
    echo "4. Testing simple query..."
    curl -s -X POST $BASE_URL/api/agent/query \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"query": "Show me sales data for the current month"}' | jq '.success' || echo "❌ Query failed"
else
    echo ""
    echo "⚠️  Skipping authenticated tests. Please set JWT_TOKEN in the script."
fi

echo ""
echo "========================================"
echo "Testing Complete"
echo "========================================"

