# AI Agent API Testing Guide

## Prerequisites

1. **Server Running**: Make sure your Node.js server is running on port 3111
2. **Ollama Running**: Ollama should be running on your Mac at `192.168.50.29:11434`
3. **JWT Token**: You need a valid JWT token from the login endpoint

## Quick Health Check

### 1. Check Server Health
```bash
curl http://localhost:3111/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

### 2. Check Ollama Connection
```bash
curl http://localhost:3111/api/agent/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Ollama is accessible",
  "data": {
    "ollamaRunning": true,
    "workingHost": "192.168.50.29",
    "workingUrl": "http://192.168.50.29:11434",
    "model": "qwen2.5:32b"
  }
}
```

---

## Get JWT Token (If Needed)

### Login to Get Token
```bash
POST http://localhost:3111/api/user/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "databaseName": "your-database-name",
    ...
  }
}
```

**Save the token** - you'll need it for all agent API calls.

---

## AI Agent API Endpoints

### 1. Get Available Tools

**Endpoint:** `GET /api/agent/tools`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**cURL:**
```bash
curl -X GET http://localhost:3111/api/agent/tools \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Tools retrieved successfully",
  "data": [
    {
      "name": "get_sales_data",
      "description": "Get sales data from std_orders table...",
      "parameters": {...}
    },
    ...
  ]
}
```

---

### 2. Process Natural Language Query

**Endpoint:** `POST /api/agent/query`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

#### Example 1: Sales Data Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me sales data for the current month"
  }'
```

#### Example 2: Inventory Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What inventory items are out of stock?"
  }'
```

#### Example 3: P&L Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Get P&L data for the previous month"
  }'
```

#### Example 4: Ad Spend Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is my ad spend and ROAS for the current year?"
  }'
```

#### Example 5: Regional Sales Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me regional sales by state and city for the current month"
  }'
```

#### Example 6: Overstock Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "List all overstock items in the US"
  }'
```

#### Example 7: Orders Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me daily order breakdown for the previous month"
  }'
```

#### Example 8: Complex Query with Filters
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Get sales data for SKU ABC123 in California for the current month"
  }'
```

#### Example 9: Executive P&L Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me executive P&L summary for the current year"
  }'
```

#### Example 10: Understock Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What items are understocked?"
  }'
```

---

## Expected Response Format

### Successful Query Response
```json
{
  "success": true,
  "message": "Query processed successfully",
  "response": "Here's the sales data for January 2026...\n\n| purchase-date | SKU | Quantity | Total_Sales | ... |\n| --- | --- | --- | --- | --- |\n| 2026-01-07 | ABC123 | 10 | 150.00 | ... |\n\n**Key Insights:**\n- Total sales: $1,500.00\n- Average order value: $150.00\n...",
  "data": {
    "success": true,
    "data": [
      {
        "purchase-date": "2026-01-07",
        "SKU": "ABC123",
        "Quantity": 10,
        "Total_Sales": 150.00,
        ...
      }
    ],
    "dateRange": {
      "start": "2026-01-01",
      "end": "2026-01-07"
    },
    "filters": {
      "filterType": "currentmonth"
    }
  },
  "toolCalls": [
    {
      "name": "get_sales_data",
      "parameters": {
        "filterType": "currentmonth"
      }
    }
  ]
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here",
  "message": "Failed to process query"
}
```

---

## Postman Collection

### Setup Postman

1. **Create Environment Variables:**
   - `base_url`: `http://localhost:3111`
   - `jwt_token`: `YOUR_JWT_TOKEN`

2. **Create Collection: "AI Agent APIs"**

### Request 1: Health Check
- **Method:** GET
- **URL:** `{{base_url}}/api/agent/health`
- **Auth:** None

### Request 2: Get Tools
- **Method:** GET
- **URL:** `{{base_url}}/api/agent/tools`
- **Auth:** Bearer Token
- **Token:** `{{jwt_token}}`

### Request 3: Process Query
- **Method:** POST
- **URL:** `{{base_url}}/api/agent/query`
- **Auth:** Bearer Token
- **Token:** `{{jwt_token}}`
- **Body (JSON):**
```json
{
  "query": "Show me sales data for the current month"
}
```

---

## Testing Workflow

### Step 1: Verify Server
```bash
curl http://localhost:3111/health
```

### Step 2: Verify Ollama Connection
```bash
curl http://localhost:3111/api/agent/health
```

### Step 3: Get Your JWT Token
```bash
curl -X POST http://localhost:3111/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email", "password": "your-password"}'
```

### Step 4: Test Simple Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me sales data for the current month"}'
```

### Step 5: Test Complex Query
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is my total ad spend and ROAS for the previous month?"}'
```

---

## Common Query Patterns

### Date Queries
- "current month" → Uses `filterType: "currentmonth"`
- "previous month" → Uses `filterType: "previousmonth"`
- "current year" → Uses `filterType: "currentyear"`
- "last year" → Uses `filterType: "lastyear"`

### Data Type Queries
- "sales" → Uses `get_sales_data`
- "inventory" → Uses `get_inventory_data`
- "P&L" or "profit and loss" → Uses `get_pnl_data`
- "ad spend" or "advertising" → Uses `get_ad_sales_spend`
- "orders" → Uses `get_orders_data`

### Filter Queries
- "SKU ABC123" → Adds `sku: "ABC123"`
- "in California" → Adds `state: "California"`
- "US" or "United States" → Adds `country: "US"`

---

## Troubleshooting

### 401 Unauthorized
- Make sure your JWT token is valid
- Check token hasn't expired
- Verify Authorization header format: `Bearer YOUR_TOKEN`

### 500 Internal Server Error
- Check server logs for detailed error
- Verify Ollama is running: `curl http://192.168.50.29:11434/api/tags`
- Check database connection
- Verify JWT token contains `databaseName` field

### Empty Response
- Check if Ollama model is installed: `ollama list`
- Verify model name in `.env`: `OLLAMA_MODEL=qwen2.5:32b`
- Check Ollama logs for errors

### Timeout
- Ollama requests can take 30-120 seconds
- Check if model is too large for your system
- Try a smaller model: `qwen2.5:14b` or `qwen2.5:7b`

---

## Quick Test Script

Save this as `test-agent.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3111"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"

echo "1. Testing server health..."
curl -s $BASE_URL/health | jq

echo -e "\n2. Testing Ollama connection..."
curl -s $BASE_URL/api/agent/health | jq

echo -e "\n3. Getting available tools..."
curl -s -X GET $BASE_URL/api/agent/tools \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.data | length'

echo -e "\n4. Testing simple query..."
curl -s -X POST $BASE_URL/api/agent/query \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me sales data for the current month"}' | jq '.success'
```

Make it executable and run:
```bash
chmod +x test-agent.sh
./test-agent.sh
```

---

## Next Steps

1. **Test Health Endpoint** - Verify Ollama connection
2. **Get JWT Token** - Login to get authentication token
3. **Test Simple Query** - Start with basic queries
4. **Test Complex Queries** - Try filters and combinations
5. **Check Responses** - Verify data format and insights

Good luck testing! 🚀

