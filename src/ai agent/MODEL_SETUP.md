# Ollama Model Setup Guide

## Error: Model 'qwen2.5:32b' not found

If you see this error, the model is not installed on your Ollama instance.

## Solution 1: Install the Model (Recommended)

### On Your Mac (where Ollama is running):

```bash
# Pull the qwen2.5:32b model
ollama pull qwen2.5:32b
```

**Note:** This is a large model (32B parameters). It requires:
- At least 32GB RAM (64GB recommended)
- Several GB of disk space
- Download time depends on your internet speed

### Check Installation:
```bash
ollama list
```

You should see `qwen2.5:32b` in the list.

---

## Solution 2: Use a Smaller Model

If your system doesn't have enough resources for 32B, use a smaller model:

### Option A: qwen2.5:14b (Recommended)
```bash
# Pull the model
ollama pull qwen2.5:14b
```

Then update your `.env` file:
```env
OLLAMA_MODEL=qwen2.5:14b
```

### Option B: qwen2.5:7b (Smallest)
```bash
# Pull the model
ollama pull qwen2.5:7b
```

Then update your `.env` file:
```env
OLLAMA_MODEL=qwen2.5:7b
```

### Option C: llama2 (Alternative)
```bash
# Pull the model
ollama pull llama2
```

Then update your `.env` file:
```env
OLLAMA_MODEL=llama2
```

---

## Check Available Models

### Via API (No Auth Required):
```bash
GET http://localhost:3111/api/agent/models
```

**cURL:**
```bash
curl http://localhost:3111/api/agent/models
```

**Response:**
```json
{
  "success": true,
  "message": "Models retrieved successfully",
  "data": {
    "models": [
      {
        "name": "qwen2.5:7b",
        "size": 4718129152,
        ...
      },
      ...
    ],
    "configuredModel": "qwen2.5:32b"
  }
}
```

### Via Terminal (on Mac):
```bash
ollama list
```

---

## Recommended Models by System

### High-End System (64GB+ RAM):
- `qwen2.5:32b` - Best quality, slowest
- `qwen2.5:14b` - Good balance

### Mid-Range System (16-32GB RAM):
- `qwen2.5:14b` - Recommended
- `qwen2.5:7b` - Faster alternative

### Lower-End System (8-16GB RAM):
- `qwen2.5:7b` - Recommended
- `llama2` - Alternative

---

## After Installing Model

1. **Restart your Node.js server** (if needed)
2. **Test the connection:**
   ```bash
   curl http://localhost:3111/api/agent/models
   ```
3. **Try your query again**

---

## Quick Fix Commands

### Check if model exists:
```bash
ollama list | grep qwen2.5
```

### Install model:
```bash
ollama pull qwen2.5:32b
```

### Verify installation:
```bash
ollama show qwen2.5:32b
```

### Test model:
```bash
ollama run qwen2.5:32b "Hello, how are you?"
```

---

## Update .env After Model Change

If you switch to a different model, update your `.env`:

```env
OLLAMA_BASE_URL=http://192.168.50.29:11434
OLLAMA_MODEL=qwen2.5:14b  # Changed from qwen2.5:32b
```

Then restart your Node.js server.

