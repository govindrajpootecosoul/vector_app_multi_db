# Quick Test APIs for AI Agent

## 🚀 Server Status

The server should be running on: **http://localhost:3111**

---

## 📋 Test APIs (Copy & Paste Ready)

### 1. Health Check (No Auth Required)
```bash
GET http://localhost:3111/health
```

**cURL:**
```bash
curl http://localhost:3111/health
```

**Expected:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

---

### 2. Ollama Health Check (No Auth Required)
```bash
GET http://localhost:3111/api/agent/health
```

**cURL:**
```bash
curl http://localhost:3111/api/agent/health
```

**Expected:**
```json
{
  "success": true,
  "message": "Ollama is accessible",
  "data": {
    "ollamaRunning": true,
    "workingHost": "192.168.50.29",
    "workingUrl": "http://192.168.50.29:11434"
  }
}
```

---

### 3. Get Available Tools (Requires Auth)
```bash
GET http://localhost:3111/api/agent/tools
Authorization: Bearer YOUR_JWT_TOKEN
```

**cURL:**
```bash
curl -X GET http://localhost:3111/api/agent/tools \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 4. Process Query - Sales Data (Requires Auth)
```bash
POST http://localhost:3111/api/agent/query
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "Show me sales data for the current month"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me sales data for the current month\"}"
```

---

### 5. Process Query - Inventory
```bash
POST http://localhost:3111/api/agent/query
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "What inventory items are out of stock?"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"What inventory items are out of stock?\"}"
```

---

### 6. Process Query - P&L Data
```bash
POST http://localhost:3111/api/agent/query
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "Get P&L data for the previous month"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Get P&L data for the previous month\"}"
```

---

### 7. Process Query - Ad Spend
```bash
POST http://localhost:3111/api/agent/query
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "What is my ad spend and ROAS for the current year?"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"What is my ad spend and ROAS for the current year?\"}"
```

---

### 8. Process Query - Regional Sales
```bash
POST http://localhost:3111/api/agent/query
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "Show me regional sales by state and city for the current month"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me regional sales by state and city for the current month\"}"
```

---

### 9. Process Query - Overstock Items
```bash
POST http://localhost:3111/api/agent/query
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "List all overstock items in the US"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"List all overstock items in the US\"}"
```

---

### 10. Process Query - Orders
```bash
POST http://localhost:3111/api/agent/query
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "Show me daily order breakdown for the previous month"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me daily order breakdown for the previous month\"}"
```

---

## 🔑 How to Get JWT Token

### Login Endpoint
```bash
POST http://localhost:3111/api/user/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3111/api/user/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"your-email@example.com\", \"password\": \"your-password\"}"
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "databaseName": "your-database-name"
  }
}
```

Copy the `token` value and use it in the `Authorization: Bearer YOUR_JWT_TOKEN` header.

---

## 📝 Postman Collection Setup

### Environment Variables
Create a new environment in Postman:
- `base_url`: `http://localhost:3111`
- `jwt_token`: `YOUR_JWT_TOKEN_HERE`

### Collection Requests

1. **Health Check**
   - Method: GET
   - URL: `{{base_url}}/health`

2. **Ollama Health**
   - Method: GET
   - URL: `{{base_url}}/api/agent/health`

3. **Get Tools**
   - Method: GET
   - URL: `{{base_url}}/api/agent/tools`
   - Headers: `Authorization: Bearer {{jwt_token}}`

4. **Process Query**
   - Method: POST
   - URL: `{{base_url}}/api/agent/query`
   - Headers: 
     - `Authorization: Bearer {{jwt_token}}`
     - `Content-Type: application/json`
   - Body (raw JSON):
   ```json
   {
     "query": "Show me sales data for the current month"
   }
   ```

---

## 🧪 Quick Test Sequence

1. **Check Server:**
   ```bash
   curl http://localhost:3111/health
   ```

2. **Check Ollama:**
   ```bash
   curl http://localhost:3111/api/agent/health
   ```

3. **Get Token:**
   ```bash
   curl -X POST http://localhost:3111/api/user/login \
     -H "Content-Type: application/json" \
     -d "{\"email\": \"your-email\", \"password\": \"your-password\"}"
   ```

4. **Test Query:**
   ```bash
   curl -X POST http://localhost:3111/api/agent/query \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"query\": \"Show me sales data for the current month\"}"
   ```

---

## ✅ Expected Response Format

```json
{
  "success": true,
  "message": "Query processed successfully",
  "response": "Here's the sales data...",
  "data": {
    "success": true,
    "data": [...],
    "dateRange": {
      "start": "2026-01-01",
      "end": "2026-01-07"
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

---

## 🐛 Troubleshooting

- **401 Unauthorized**: Check your JWT token
- **500 Error**: Check server logs and Ollama connection
- **Timeout**: Ollama requests can take 30-120 seconds
- **Connection Refused**: Verify Ollama is running on Mac at `192.168.50.29:11434`

---

## 📚 More Examples

See `src/ai agent/API_TESTING_GUIDE.md` for comprehensive testing guide.

