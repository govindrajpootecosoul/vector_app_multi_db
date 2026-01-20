# Quick Fix - Model Name Update

## ✅ Code Updated

The code has been updated to use `qwen2.5:32b-instruct` (which matches your installed model).

## 🔄 Restart Server

If you see old error messages, **restart your server**:

1. **Stop the current server** (Ctrl+C in the terminal)
2. **Start it again:**
   ```bash
   npm run dev
   # or
   node server.js
   ```

## ✅ Current Configuration

- **Default Model:** `qwen2.5:32b-instruct` ✅
- **Ollama URL:** `http://192.168.50.29:11434` ✅
- **Model Installed:** `qwen2.5:32b-instruct` ✅ (confirmed from health check)

## 🧪 Test Now

After restarting, try your query again:

```bash
curl -X POST http://localhost:3111/api/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Show me sales data for the current month\"}"
```

It should work now! 🚀

