# AI Agent - Amazon Business Analyst

This folder contains the Agentic API layer that integrates with Ollama (Qwen2.5:32b) to provide natural language querying of Amazon Seller Central data.

## Overview

The AI Agent allows users to query sales, inventory, P&L, and ad data using natural language. The agent uses function calling to execute database queries based on the user's intent.

## Architecture

```
ai agent/
├── tools/
│   └── definitions.js          # Tool definitions (JSON schemas) for Ollama
├── utils/
│   └── dateHelper.js           # Date logic utilities (based on 2026-01-07)
├── services/
│   ├── agent.service.js        # Main Ollama integration service
│   └── toolExecutor.js         # Executes tool functions
├── controllers/
│   └── agent.controller.js    # HTTP request handlers
├── routes/
│   └── agent.routes.js         # Express routes
└── README.md                   # This file
```

## Setup

### 1. Install Ollama

Make sure Ollama is installed and running on your system:

```bash
# Install Ollama (if not already installed)
# Visit: https://ollama.ai

# Pull the Qwen2.5:32b-instruct model (or use qwen2.5:7b for faster performance)
ollama pull qwen2.5:32b-instruct
```

### 2. Environment Variables

Add these to your `.env` file:

```env
# Ollama Configuration
# For remote Ollama (Mac): Use Mac's IP address
OLLAMA_BASE_URL=http://192.168.50.29:11434
# For local Ollama: Use localhost
# OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:32b-instruct
```

**Note:** The default is set to `http://192.168.50.29:11434` for your Mac setup. If Ollama is running on the same machine as your backend, change it to `http://localhost:11434` or `http://127.0.0.1:11434`.

### 3. Start Ollama Server

```bash
# Start Ollama server (if not running)
ollama serve
```

## API Endpoints

### POST `/api/agent/query`

Process a natural language query.

**Request:**
```json
{
  "query": "Show me sales data for the current month"
}
```

**Response:**
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

Get list of available tools.

### GET `/api/agent/health`

Health check for Ollama connection (no auth required).

## Available Tools

1. **get_sales_data** - Get sales data from orders
2. **get_regional_sales** - Get sales aggregated by region
3. **get_inventory_data** - Get inventory information
4. **get_pnl_data** - Get Profit & Loss data
5. **get_pnl_executive** - Get executive P&L summary
6. **get_ad_sales_spend** - Get ad sales and spend metrics
7. **get_orders_data** - Get order breakdown
8. **get_inventory_overstock** - Get overstock items
9. **get_inventory_understock** - Get understock items
10. **get_inventory_out_of_stock** - Get out of stock items

## Date Logic

The system uses a reference date of **2026-01-07** for date calculations:

- **currentmonth** → January 2026 (2026-01-01 to 2026-01-07)
- **previousmonth** → December 2025 (2025-12-01 to 2025-12-31)
- **currentyear** → 2026 year-to-date (2026-01-01 to 2026-01-07)
- **lastyear** → 2025 full year (2025-01-01 to 2025-12-31)

## Example Queries

- "What are my sales for the current month?"
- "Show me inventory items that are out of stock"
- "Get P&L data for the previous month"
- "What's my ad spend and ROAS for the current year?"
- "Show me regional sales by state and city"
- "Get all overstock items in the US"

## System Prompt

The agent uses this system prompt:

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

## Database Connection

The agent uses the existing database connection logic from `utils/database.js`. It automatically:
- Extracts `databaseName` from the JWT token
- Uses cached connection pools for performance
- Queries the appropriate client-specific database

## Error Handling

- If Ollama is not running, the request will timeout after 120 seconds
- If a tool execution fails, the error is returned in the tool result
- Database connection errors are caught and returned as error responses

## Notes

- Ollama doesn't need to be added as an npm dependency since we use HTTP requests directly
- The agent supports streaming responses from Ollama
- Tool results are automatically formatted and sent back to Ollama for final response generation
- All routes require JWT authentication via `authenticateToken` middleware (except `/health`)

