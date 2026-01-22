# AI Agent Implementation - Complete Documentation

## Overview

This document provides a complete explanation of how the AI Agent is implemented in this project. The AI Agent uses **Ollama** (Qwen2.5:32b-instruct model) with function calling to enable natural language querying of Amazon Seller Central data.

---

## Architecture Components

### File Structure

```
src/ai agent/
├── tools/
│   └── definitions.js          # Tool definitions (JSON schemas) for Ollama
├── utils/
│   └── dateHelper.js           # Date logic utilities (reference date: 2026-01-07)
├── services/
│   ├── agent.service.js        # Main Ollama integration service
│   └── toolExecutor.js         # Executes tool functions (database queries)
├── controllers/
│   └── agent.controller.js     # HTTP request handlers
└── routes/
    └── agent.routes.js         # Express routes
```

---

## How It Works - Complete Flow

### Step 1: User Query (Entry Point)

**File:** `src/ai agent/controllers/agent.controller.js`

- User sends POST request to `/api/agent/query` with natural language query
- Controller validates the query and passes it to the agent service

```javascript
exports.processQuery = async (req, res) => {
  const { query } = req.body;
  const result = await agentService.processQuery(query, req);
  res.json({ success: true, message: 'Query processed successfully', ...result });
};
```

**Route Registration:** `src/app.js`
```javascript
const agentRoutes = require('./ai agent/routes/agent.routes');
app.use('/api/agent', agentRoutes);
```

---

### Step 2: Initial Ollama Request

**File:** `src/ai agent/services/agent.service.js`

The service sends the user query to Ollama with:
1. **System Prompt** - Instructs the model to act as an Amazon Business Analyst
2. **Tool Definitions** - JSON schemas of all available tools
3. **User Query** - The natural language question

```javascript
const chatRequest = {
  model: OLLAMA_MODEL,  // 'qwen2.5:32b-instruct'
  messages: [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: userQuery
    }
  ],
  tools: toolDefinitions,  // All 10 tool schemas
  tool_choice: 'auto'  // Let model decide which tools to use
};
```

**System Prompt:**
```
You are an Amazon Business Analyst. Use the provided tools to fetch real-time data from the database. Today is 2026-01-07. Always return data in Markdown tables and provide insights on sales trends.

When users ask about:
- "current month" or "this month" → use filterType: "currentmonth"
- "previous month" or "last month" → use filterType: "previousmonth"
- "current year" or "this year" → use filterType: "currentyear"
- "last year" → use filterType: "lastyear"

Always format your responses with:
1. A summary of the data
2. Markdown tables for structured data
3. Key insights and trends
4. Recommendations when appropriate
```

---

### Step 3: Tool Call Detection

**File:** `src/ai agent/services/agent.service.js`

Ollama returns a streaming response. The service:
1. Parses the streaming chunks
2. Extracts tool calls (function name + parameters)
3. If no tool calls, returns direct response

```javascript
// Parse streaming response
let lastMessage = null;
let toolCalls = [];

for (const chunk of ollamaResponse) {
  if (chunk.message) {
    lastMessage = chunk.message;
    if (chunk.message.tool_calls) {
      toolCalls = chunk.message.tool_calls;
    }
  }
}

// If no tool calls, return direct response
if (!toolCalls || toolCalls.length === 0) {
  return {
    success: true,
    response: lastMessage?.content || 'No response from model',
    data: null
  };
}
```

---

### Step 4: Tool Execution

**File:** `src/ai agent/services/toolExecutor.js`

For each tool call:
1. Gets database connection from JWT token (`req.user.databaseName`)
2. Executes the appropriate SQL query based on tool name
3. Returns structured data

```javascript
const executeTool = async (toolName, parameters, req) => {
  // Get database connection
  if (!req.databaseName) {
    req.databaseName = req.user?.databaseName;
  }
  const pool = await getConnection(req);

  // Route to appropriate tool function
  switch (toolName) {
    case 'get_sales_data':
      return await executeGetSalesData(parameters, pool);
    case 'get_regional_sales':
      return await executeGetRegionalSales(parameters, pool);
    // ... 8 more tools
  }
};
```

**Database Connection:**
- Extracts `databaseName` from JWT token (`req.user.databaseName`)
- Uses connection pooling from `utils/database.js`
- Each client has their own database

---

### Step 5: Tool Results Back to Ollama

**File:** `src/ai agent/services/agent.service.js`

After executing tools, the service:
1. Formats tool results
2. Sends conversation history + tool results back to Ollama
3. Ollama generates natural language response with insights

```javascript
const toolResults = [];
for (const toolCall of toolCalls) {
  const result = await executeTool(toolName, parameters, req);
  toolResults.push({
    tool_call_id: toolCall.id,
    role: 'tool',
    name: toolName,
    content: JSON.stringify(result)
  });
}

// Send back to Ollama
const followUpMessages = [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: userQuery },
  lastMessage,  // Assistant's message with tool calls
  ...toolResults  // Tool execution results
];

const finalRequest = {
  model: OLLAMA_MODEL,
  messages: followUpMessages,
  stream: false
};
```

---

### Step 6: Final Response

**File:** `src/ai agent/services/agent.service.js`

Returns formatted response with:
- Natural language answer from Ollama
- Raw data from database
- Tool calls that were made

```javascript
return {
  success: true,
  response: finalMessage?.content || 'No response from model',
  data: extractedData.length === 1 ? extractedData[0] : extractedData,
  toolCalls: toolCalls.map(tc => ({
    name: tc.function.name,
    parameters: params
  }))
};
```

---

## Available Tools (10 Tools)

**File:** `src/ai agent/tools/definitions.js`

Each tool is defined as a JSON schema following Ollama's function calling format:

### 1. get_sales_data
- **Purpose:** Get sales data from std_orders table
- **Returns:** Purchase dates, SKUs, quantities, total sales, product names, categories, cities, states, AOV
- **Parameters:** filterType, sku, productName, category, city, state, country, platform, startDate, endDate

### 2. get_regional_sales
- **Purpose:** Get regional sales aggregated by state and city
- **Returns:** Total sales, quantities, order counts grouped by location
- **Parameters:** filterType, sku, productCategory, state, city, country, platform

### 3. get_inventory_data
- **Purpose:** Get inventory data from std_inventory table
- **Returns:** SKU, quantity, product name, category, country, platform, stock status, inventory value
- **Parameters:** sku, category, product, country, platform

### 4. get_pnl_data
- **Purpose:** Get Profit & Loss data from std_pnl table
- **Returns:** Total sales, ad costs, fees, COGS, contribution margins (CM1, CM2, CM3)
- **Parameters:** range, sku, category, productName, country, platform, startMonth, endMonth, cm3Type

### 5. get_pnl_executive
- **Purpose:** Get executive-level P&L summary
- **Returns:** Aggregated totals for current and previous periods
- **Parameters:** range, sku, category, productName, country, platform, startMonth, endMonth

### 6. get_ad_sales_spend
- **Purpose:** Get ad sales and ad spend data
- **Returns:** Ad sales, ad spend, total revenue, ACOS, TACOS, ROAS, organic revenue
- **Parameters:** filterType, platform, country, sku, startMonth, endMonth

### 7. get_orders_data
- **Purpose:** Get order data breakdown
- **Returns:** Daily breakdown of orders with total quantity, total sales, order count, AOV
- **Parameters:** filterType, sku, platform, state, city, country, startMonth, endMonth

### 8. get_inventory_overstock
- **Purpose:** Get overstock inventory items
- **Returns:** Items with stock_status='Overstock', dos_2 >= 90, afn_fulfillable_quantity >= 90
- **Parameters:** country, platform

### 9. get_inventory_understock
- **Purpose:** Get understock inventory items
- **Returns:** Items with stock_status='Understock', dos_2 <= 30, afn_fulfillable_quantity <= 30
- **Parameters:** country, platform

### 10. get_inventory_out_of_stock
- **Purpose:** Get active SKUs that are out of stock
- **Returns:** Items with stock_status='Understock', dos_2 = 0, afn_fulfillable_quantity = 0
- **Parameters:** country, platform

---

## Date Logic

**File:** `src/ai agent/utils/dateHelper.js`

The system uses a **reference date of 2026-01-07** for all date calculations:

```javascript
const REFERENCE_DATE = new Date('2026-01-07T00:00:00.000Z');
```

### Date Mappings:

- **currentmonth** → January 2026 (2026-01-01 to 2026-01-07)
- **previousmonth** → December 2025 (2025-12-01 to 2025-12-31)
- **currentyear** → 2026 year-to-date (2026-01-01 to 2026-01-07)
- **lastyear** → 2025 full year (2025-01-01 to 2025-12-31)

### Functions:

- `getDateRangeFromFilterType(filterType)` - Converts filterType to date range
- `getCurrentMonth()` - Returns current month date range
- `getPreviousMonth()` - Returns previous month date range
- `getCurrentYear()` - Returns current year date range
- `getLastYear()` - Returns last year date range
- `formatDate(date)` - Formats date to YYYY-MM-DD
- `formatYearMonth(date)` - Formats date to YYYY-MM

---

## API Endpoints

**File:** `src/ai agent/routes/agent.routes.js`

### POST `/api/agent/query`
- **Purpose:** Process natural language query
- **Auth:** Required (JWT token)
- **Request Body:**
  ```json
  {
    "query": "Show me sales data for the current month"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Query processed successfully",
    "response": "Here's the sales data for January 2026...",
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

### GET `/api/agent/tools`
- **Purpose:** Get list of available tools
- **Auth:** Required (JWT token)
- **Response:** List of all 10 tools with descriptions and parameters

### GET `/api/agent/health`
- **Purpose:** Health check for Ollama connection
- **Auth:** Not required
- **Response:** Connection status and recommendations

### GET `/api/agent/models`
- **Purpose:** Get available Ollama models
- **Auth:** Not required
- **Response:** List of installed models and configured model

---

## Ollama Integration Details

**File:** `src/ai agent/services/agent.service.js`

### Configuration

Environment variables (`.env`):
```env
OLLAMA_BASE_URL=http://192.168.50.29:11434  # or http://localhost:11434
OLLAMA_MODEL=qwen2.5:32b-instruct
```

### HTTP Request Implementation

- Uses native Node.js `http`/`https` modules (no npm package needed)
- Supports streaming responses
- Handles IPv4/IPv6 issues (forces IPv4 for localhost)
- 120-second timeout
- Automatic retry with alternative hosts (localhost → 127.0.0.1)

### Request Flow

```javascript
const ollamaRequest = (endpoint, data, baseUrl = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl || OLLAMA_BASE_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    // Force IPv4 for localhost
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      options.family = 4;
    }

    const req = http.request(options, (res) => {
      // Handle streaming response
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        // Parse line-by-line JSON (Ollama streams responses)
        const lines = responseData.trim().split('\n').filter(line => line);
        const parsed = lines.map(line => JSON.parse(line));
        resolve(parsed);
      });
    });
    
    req.on('error', (error) => {
      // Retry logic and error handling
    });
    
    req.setTimeout(120000, () => {
      req.destroy(new Error('Ollama request timed out'));
    });
    
    req.write(postData);
    req.end();
  });
};
```

---

## Database Integration

**File:** `src/ai agent/services/toolExecutor.js`

### Connection Management

- Extracts `databaseName` from JWT token (`req.user.databaseName`)
- Uses `getConnection(req)` from `utils/database.js`
- Supports connection pooling for performance
- Each client has their own database

### SQL Query Execution

Each tool function:
1. Builds dynamic WHERE clauses based on parameters
2. Executes parameterized queries (using `mssql` package)
3. Handles column existence fallbacks (e.g., `item_price`, `order_id`)
4. Returns structured data with success flag

**Example - get_sales_data:**
```javascript
const executeGetSalesData = async (params, pool) => {
  const { filterType, sku, productName, category, city, state, country, platform, startDate, endDate } = params;
  
  // Get date range
  let dateRange;
  if (startDate && endDate) {
    dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
  } else {
    dateRange = getDateRangeFromFilterType(filterType || 'previousmonth');
  }

  // Build WHERE conditions
  let whereConditions = [];
  if (sku) whereConditions.push(`sku IN (...)`);
  if (productName) whereConditions.push(`product_name LIKE '%...%'`);
  // ... more filters
  
  whereConditions.push(`purchase_date >= '...' AND purchase_date <= '...'`);

  // Execute query with fallback for missing columns
  let query = `SELECT ... FROM std_orders WHERE ${whereConditions.join(' AND ')}`;
  let result;
  try {
    result = await request.query(query);
  } catch (error) {
    // Retry without item_price if column doesn't exist
    if (error.message.includes("Invalid column name 'item_price'")) {
      query = `SELECT ... FROM std_orders WHERE ...`; // Without item_price
      result = await request.query(query);
    }
  }
  
  return {
    success: true,
    data: result.recordset,
    dateRange: { start: formatDate(dateRange.startDate), end: formatDate(dateRange.endDate) },
    filters: params
  };
};
```

---

## Error Handling

### Connection Errors

- **ECONNREFUSED:** Retries with alternative hosts (localhost → 127.0.0.1)
- **ENOTFOUND:** Clear error message about host not found
- **EADDRNOTAVAIL:** Suggests using 127.0.0.1 instead

### Model Errors

- **Model not found:** Error message with install command: `ollama pull qwen2.5:32b-instruct`
- **Empty response:** Checks if model is installed

### Timeout Errors

- 120-second timeout
- Clear error message about timeout

### Database Errors

- Caught in tool execution
- Returned in tool results as error object
- Doesn't crash the entire request

### Error Response Format

```javascript
catch (error) {
  console.error('Error processing agent query:', error);
  
  // Provide helpful error messages
  if (error.message.includes('not found')) {
    throw new Error(`Model '${OLLAMA_MODEL}' is not installed. Please run: ollama pull ${OLLAMA_MODEL}`);
  } else if (error.message.includes('ECONNREFUSED')) {
    throw new Error('Ollama is not running. Please start Ollama with: ollama serve');
  } else if (error.message.includes('timeout')) {
    throw new Error('Ollama request timed out. The model might be too slow or Ollama is not responding.');
  } else {
    throw error;
  }
}
```

---

## Complete Flow Diagram

```
┌─────────────┐
│   User      │
│   Query     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  POST /api/agent/query          │
│  (agent.controller.js)          │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  agent.service.processQuery()    │
│  - Builds chat request          │
│  - Includes system prompt       │
│  - Includes tool definitions    │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Ollama API Request             │
│  POST /api/chat                 │
│  (HTTP request to Ollama)       │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Ollama Response                │
│  - Streaming chunks             │
│  - Tool calls detected          │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Parse Tool Calls               │
│  - Extract function names       │
│  - Extract parameters           │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  toolExecutor.executeTool()     │
│  - Get database connection      │
│  - Execute SQL queries          │
│  - Return structured data       │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Format Tool Results            │
│  - JSON stringify results       │
│  - Add tool_call_id             │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Send Results Back to Ollama    │
│  - Conversation history         │
│  - Tool results                 │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Ollama Final Response          │
│  - Natural language answer      │
│  - Insights and recommendations │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Format Final Response          │
│  - Response text                │
│  - Raw data                    │
│  - Tool calls made             │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────┐
│   User      │
│   Response  │
└─────────────┘
```

---

## Setup Requirements

### 1. Install Ollama

```bash
# Visit: https://ollama.ai
# Or use package manager

# Pull the model
ollama pull qwen2.5:32b-instruct

# Start Ollama server
ollama serve
```

### 2. Environment Variables

Add to `.env`:
```env
OLLAMA_BASE_URL=http://192.168.50.29:11434  # or http://localhost:11434
OLLAMA_MODEL=qwen2.5:32b-instruct
```

### 3. Database Setup

- Ensure database connection is configured
- JWT token must include `databaseName` in user object
- Database tables: `std_orders`, `std_inventory`, `std_pnl`, `std_ad_sales`

---

## Example Queries

1. **"What are my sales for the current month?"**
   - Tool: `get_sales_data`
   - Parameters: `{ filterType: "currentmonth" }`

2. **"Show me inventory items that are out of stock"**
   - Tool: `get_inventory_out_of_stock`
   - Parameters: `{}`

3. **"Get P&L data for the previous month"**
   - Tool: `get_pnl_data`
   - Parameters: `{ range: "previousmonth" }`

4. **"What's my ad spend and ROAS for the current year?"**
   - Tool: `get_ad_sales_spend`
   - Parameters: `{ filterType: "currentyear" }`

5. **"Show me regional sales by state and city"**
   - Tool: `get_regional_sales`
   - Parameters: `{ filterType: "currentmonth" }`

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/ai agent/services/agent.service.js` | Main orchestration, Ollama integration |
| `src/ai agent/services/toolExecutor.js` | Database query execution |
| `src/ai agent/tools/definitions.js` | Tool schemas (JSON) |
| `src/ai agent/controllers/agent.controller.js` | HTTP request handlers |
| `src/ai agent/routes/agent.routes.js` | Express routes |
| `src/ai agent/utils/dateHelper.js` | Date logic utilities |
| `src/app.js` | Route registration |

---

## Notes

- Ollama doesn't need to be added as npm dependency (uses HTTP requests)
- The agent supports streaming responses from Ollama
- Tool results are automatically formatted and sent back to Ollama
- All routes require JWT authentication via `authenticateToken` middleware (except `/health`)
- Reference date is hardcoded to 2026-01-07 for consistent date calculations
- Database connection is per-client (multi-tenant architecture)

---

## Troubleshooting

### Ollama Connection Issues

1. **Check if Ollama is running:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. **Check health endpoint:**
   ```bash
   GET /api/agent/health
   ```

3. **Try different host:**
   - Update `OLLAMA_BASE_URL` in `.env`
   - Try `http://127.0.0.1:11434` instead of `localhost`

### Model Not Found

```bash
ollama pull qwen2.5:32b-instruct
# Or use smaller model for faster performance:
ollama pull qwen2.5:7b-instruct
```

### Database Connection Issues

- Ensure JWT token includes `databaseName`
- Check database connection pool configuration
- Verify database tables exist

---

## Summary

The AI Agent is a **function-calling agent** that:
1. ✅ Understands natural language queries
2. ✅ Maps them to appropriate database tools
3. ✅ Executes SQL queries dynamically
4. ✅ Formats results into natural language responses with insights

It uses **Ollama** as the LLM backend and implements a **multi-step conversation flow**:
- Initial query → Tool selection → Tool execution → Final response generation

The system is designed to be **multi-tenant** (each client has their own database) and **robust** (with error handling, retries, and fallbacks).

---

*Last Updated: 2026-01-20*
*Reference Date: 2026-01-07*

