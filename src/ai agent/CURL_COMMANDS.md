# CURL Commands for AI Agent API

## Quick Copy-Paste CURL Commands

### 1. Process Query - Sales Data (Current Month)

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me sales data for the current month\"}"
```

### 2. Process Query - Inventory Out of Stock

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"What inventory items are out of stock?\"}"
```

### 3. Process Query - P&L Data

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Get P&L data for the previous month\"}"
```

### 4. Process Query - Ad Spend

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"What is my ad spend and ROAS for the current year?\"}"
```

### 5. Process Query - Regional Sales

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me regional sales by state and city for the current month\"}"
```

### 6. Process Query - Overstock Items

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"List all overstock items in the US\"}"
```

### 7. Process Query - Orders

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me daily order breakdown for the previous month\"}"
```

### 8. Process Query - Complex with Filters

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Get sales data for SKU ABC123 in California for the current month\"}"
```

---

## Using Environment Variable (Recommended)

### Set Token Once
```bash
# Windows PowerShell
$env:JWT_TOKEN="YOUR_JWT_TOKEN_HERE"

# Windows CMD
set JWT_TOKEN=YOUR_JWT_TOKEN_HERE

# Linux/Mac
export JWT_TOKEN="YOUR_JWT_TOKEN_HERE"
```

### Use in CURL
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me sales data for the current month\"}"
```

---

## Windows PowerShell (Alternative)

```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_JWT_TOKEN"
    "Content-Type" = "application/json"
}

$body = @{
    query = "Show me sales data for the current month"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3111/api/agent/query" `
    -Method POST `
    -Headers $headers `
    -Body $body
```

---

## One-Liner (Windows CMD)

```cmd
curl -X POST http://localhost:3111/api/agent/query -H "Authorization: Bearer YOUR_JWT_TOKEN" -H "Content-Type: application/json" -d "{\"query\": \"Show me sales data for the current month\"}"
```

---

## Pretty Print Response (with jq)

If you have `jq` installed:

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me sales data for the current month\"}" | jq .
```

---

## Save Response to File

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me sales data for the current month\"}" \
  -o response.json
```

---

## Replace YOUR_JWT_TOKEN

Replace `YOUR_JWT_TOKEN` with your actual JWT token from the login endpoint:

```bash
# Get token first
curl -X POST http://localhost:3111/api/user/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"your-email@example.com\", \"password\": \"your-password\"}"
```

Then copy the `token` value from the response.

