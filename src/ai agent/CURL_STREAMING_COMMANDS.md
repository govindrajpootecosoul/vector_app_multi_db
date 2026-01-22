# AI Agent Streaming API - cURL Commands Guide

Complete guide for testing the streaming AI Agent API with cURL commands.

---

## 🔑 Prerequisites

1. **Get JWT Token** (from login endpoint)
2. **Set Environment Variables** (or replace in commands):
   ```bash
   export JWT_TOKEN="your_jwt_token_here"
   export BASE_URL="http://localhost:3000"
   ```

---

## 🚀 STREAMING ENDPOINTS

### 1. **POST `/api/agent/chat/stream`** - Main Streaming Chat

**Purpose:** ChatGPT-like streaming chat interface with SSE

#### Basic Request (New Session)
```bash
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me sales data for the current month"
  }' \
  --no-buffer
```

#### With Existing Session
```bash
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What about last month?",
    "sessionId": "session_1234567890_abc123"
  }' \
  --no-buffer
```

#### Example Queries
```bash
# Sales data
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me sales data for the current month"}' \
  --no-buffer

# Inventory
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "What items are out of stock?"}' \
  --no-buffer

# P&L Analysis
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "Get P&L data for the previous month"}' \
  --no-buffer

# Regional Sales
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me regional sales by state"}' \
  --no-buffer

# Ad Performance
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is my ROAS and ACOS for the current year?"}' \
  --no-buffer
```

#### Expected SSE Response Format
```
data: {"id":1234567890,"type":"start","content":"🔍 Analyzing your Amazon data..."}

data: {"id":1234567891,"type":"session","sessionId":"session_1234567890_abc123"}

data: {"id":1234567892,"type":"tool","tool":"get_sales_data","status":"running","message":"Executing get_sales_data..."}

data: {"id":1234567893,"type":"tool","tool":"get_sales_data","status":"done","preview":"150 records, $45,230.50 total"}

data: {"id":1234567894,"type":"thinking","content":"💭 Generating insights..."}

data: {"id":1234567895,"type":"chunk","content":"Based"}

data: {"id":1234567896,"type":"chunk","content":" on"}

data: {"id":1234567897,"type":"chunk","content":" your"}

... (more chunks)

data: {"id":1234567898,"type":"end","complete":true,"sessionId":"session_1234567890_abc123","messageLength":1250}
```

---

### 2. **GET `/api/agent/chat/sessions`** - Get All Sessions

**Purpose:** Retrieve all chat sessions for the authenticated user

```bash
curl -X GET "${BASE_URL}/api/agent/chat/sessions" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

#### Response Example
```json
{
  "success": true,
  "message": "Sessions retrieved successfully",
  "data": [
    {
      "id": "session_1234567890_abc123",
      "title": "Sales data for current month",
      "createdAt": "2026-01-20T10:00:00.000Z",
      "updatedAt": "2026-01-20T10:05:00.000Z",
      "messageCount": 4
    },
    {
      "id": "session_1234567891_def456",
      "title": "Inventory analysis",
      "createdAt": "2026-01-20T09:00:00.000Z",
      "updatedAt": "2026-01-20T09:15:00.000Z",
      "messageCount": 6
    }
  ]
}
```

---

### 3. **GET `/api/agent/chat/sessions/:sessionId`** - Get Session History

**Purpose:** Retrieve full conversation history for a specific session

```bash
curl -X GET "${BASE_URL}/api/agent/chat/sessions/session_1234567890_abc123" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

#### Response Example
```json
{
  "success": true,
  "message": "Session history retrieved successfully",
  "data": {
    "id": "session_1234567890_abc123",
    "title": "Sales data for current month",
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:05:00.000Z",
    "messages": [
      {
        "role": "user",
        "content": "Show me sales data for the current month",
        "timestamp": "2026-01-20T10:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "Based on your sales data for January 2026...",
        "timestamp": "2026-01-20T10:00:15.000Z"
      }
    ]
  }
}
```

---

### 4. **DELETE `/api/agent/chat/sessions/:sessionId`** - Delete Session

**Purpose:** Delete a specific chat session

```bash
curl -X DELETE "${BASE_URL}/api/agent/chat/sessions/session_1234567890_abc123" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

#### Response Example
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

---

### 5. **DELETE `/api/agent/chat/sessions`** - Clear All Sessions

**Purpose:** Delete all chat sessions for the authenticated user

```bash
curl -X DELETE "${BASE_URL}/api/agent/chat/sessions" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

#### Response Example
```json
{
  "success": true,
  "message": "Cleared 5 sessions",
  "data": {
    "deleted": 5
  }
}
```

---

## 📋 EXISTING ENDPOINTS (Still Available)

### 6. **POST `/api/agent/query`** - Non-Streaming Query

**Purpose:** Traditional non-streaming query (backwards compatible)

```bash
curl -X POST "${BASE_URL}/api/agent/query" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me sales data for the current month"
  }'
```

#### Response Example
```json
{
  "success": true,
  "message": "Query processed successfully",
  "response": "Based on your sales data for January 2026...",
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

### 7. **GET `/api/agent/tools`** - Get Available Tools

**Purpose:** List all available tools

```bash
curl -X GET "${BASE_URL}/api/agent/tools" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

---

### 8. **GET `/api/agent/health`** - Health Check

**Purpose:** Check Ollama connection status (no auth required)

```bash
curl -X GET "${BASE_URL}/api/agent/health" \
  -H "Content-Type: application/json"
```

---

### 9. **GET `/api/agent/models`** - Get Available Models

**Purpose:** List available Ollama models (no auth required)

```bash
curl -X GET "${BASE_URL}/api/agent/models" \
  -H "Content-Type: application/json"
```

---

## 🧪 Complete Testing Workflow

### Step 1: Health Check
```bash
curl -X GET "${BASE_URL}/api/agent/health"
```

### Step 2: Start Streaming Chat (New Session)
```bash
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me sales data for the current month"
  }' \
  --no-buffer
```

**Save the `sessionId` from the response!**

### Step 3: Continue Conversation (Same Session)
```bash
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What about last month?",
    "sessionId": "session_1234567890_abc123"
  }' \
  --no-buffer
```

### Step 4: Get All Sessions
```bash
curl -X GET "${BASE_URL}/api/agent/chat/sessions" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Step 5: Get Session History
```bash
curl -X GET "${BASE_URL}/api/agent/chat/sessions/session_1234567890_abc123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Step 6: Delete Session (Optional)
```bash
curl -X DELETE "${BASE_URL}/api/agent/chat/sessions/session_1234567890_abc123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

---

## 💡 Tips for Testing SSE Streams

### 1. Use `--no-buffer` Flag
Essential for seeing real-time streaming:
```bash
curl ... --no-buffer
```

### 2. Parse SSE Events (Bash Script)
```bash
#!/bin/bash

curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me sales data"}' \
  --no-buffer | while IFS= read -r line; do
  if [[ $line == data:* ]]; then
    data="${line#data: }"
    echo "$data" | jq '.'
  fi
done
```

### 3. Save Stream to File
```bash
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me sales data"}' \
  --no-buffer > stream_output.txt
```

### 4. Filter Specific Event Types
```bash
curl ... --no-buffer | grep '"type":"chunk"' | jq -r '.content' | tr -d '\n'
```

---

## 🔧 Troubleshooting

### Issue: No Response / Connection Closed

**Solution:** Check authentication
```bash
# Verify token is valid
curl -X GET "${BASE_URL}/api/agent/chat/sessions" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Issue: SSE Not Streaming

**Solution:** Ensure `--no-buffer` flag is used
```bash
curl ... --no-buffer
```

### Issue: Connection Timeout

**Solution:** Increase timeout
```bash
curl --max-time 300 ... # 5 minutes
```

### Issue: Invalid Session

**Solution:** Create new session (omit sessionId)
```bash
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "Your query"}' \
  --no-buffer
```

---

## 📝 Example Session Flow

### Complete Conversation Example

```bash
# 1. First message (creates session)
SESSION_ID=$(curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me sales for current month"}' \
  --no-buffer | grep '"type":"session"' | jq -r '.sessionId')

echo "Session ID: $SESSION_ID"

# 2. Follow-up message (uses same session)
curl -X POST "${BASE_URL}/api/agent/chat/stream" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Compare with last month\", \"sessionId\": \"$SESSION_ID\"}" \
  --no-buffer

# 3. Get full history
curl -X GET "${BASE_URL}/api/agent/chat/sessions/$SESSION_ID" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.'
```

---

## 🎯 Quick Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/agent/chat/stream` | POST | ✅ | Main streaming chat |
| `/api/agent/chat/sessions` | GET | ✅ | List all sessions |
| `/api/agent/chat/sessions/:id` | GET | ✅ | Get session history |
| `/api/agent/chat/sessions/:id` | DELETE | ✅ | Delete session |
| `/api/agent/chat/sessions` | DELETE | ✅ | Clear all sessions |
| `/api/agent/query` | POST | ✅ | Non-streaming query |
| `/api/agent/tools` | GET | ✅ | List tools |
| `/api/agent/health` | GET | ❌ | Health check |
| `/api/agent/models` | GET | ❌ | List models |

---

## 📚 Additional Resources

- **Full Documentation:** `brain/STREAMING_AI_AGENT_IMPLEMENTATION.md`
- **API Testing Guide:** `src/ai agent/API_TESTING_GUIDE.md`
- **Original README:** `src/ai agent/README.md`

---

*Last Updated: 2026-01-20*

