# AI Agent API Testing Script for PowerShell

$BASE_URL = "http://localhost:3111"
$JWT_TOKEN = "YOUR_JWT_TOKEN_HERE"  # Replace with your actual JWT token

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI Agent API Testing" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Test 1: Server Health
Write-Host "`n1. Testing server health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/health" -Method GET
    Write-Host "✅ Server is running!" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json
} catch {
    Write-Host "❌ Server is not running or not accessible" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Ollama Health Check
Write-Host "`n2. Testing Ollama connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/agent/health" -Method GET
    Write-Host "✅ Ollama health check successful!" -ForegroundColor Green
    $health = $response.Content | ConvertFrom-Json
    if ($health.data.ollamaRunning) {
        Write-Host "✅ Ollama is accessible at: $($health.data.workingUrl)" -ForegroundColor Green
    } else {
        Write-Host "❌ Ollama is not accessible" -ForegroundColor Red
    }
    $health | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ Ollama health check failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Get Available Tools (requires auth)
if ($JWT_TOKEN -ne "YOUR_JWT_TOKEN_HERE") {
    Write-Host "`n3. Getting available tools..." -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $JWT_TOKEN"
        }
        $response = Invoke-WebRequest -Uri "$BASE_URL/api/agent/tools" -Method GET -Headers $headers
        $tools = $response.Content | ConvertFrom-Json
        Write-Host "✅ Found $($tools.data.Count) available tools" -ForegroundColor Green
        $tools.data | ForEach-Object { Write-Host "  - $($_.name)" -ForegroundColor Gray }
    } catch {
        Write-Host "❌ Failed to get tools" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Test 4: Simple Query
    Write-Host "`n4. Testing simple query..." -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $JWT_TOKEN"
            "Content-Type" = "application/json"
        }
        $body = @{
            query = "Show me sales data for the current month"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$BASE_URL/api/agent/query" -Method POST -Headers $headers -Body $body
        $result = $response.Content | ConvertFrom-Json
        if ($result.success) {
            Write-Host "✅ Query processed successfully!" -ForegroundColor Green
            Write-Host "Tool used: $($result.toolCalls[0].name)" -ForegroundColor Cyan
            Write-Host "Response preview:" -ForegroundColor Cyan
            Write-Host $result.response.Substring(0, [Math]::Min(200, $result.response.Length)) -ForegroundColor Gray
        } else {
            Write-Host "❌ Query failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Query request failed" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Red
        }
    }
} else {
    Write-Host "`n⚠️  Skipping authenticated tests. Please set JWT_TOKEN in the script." -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Testing Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

