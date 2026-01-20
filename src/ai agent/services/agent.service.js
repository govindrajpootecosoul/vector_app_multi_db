/**
 * Agent Service
 * Main service that handles Ollama integration and function calling
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const toolDefinitions = require('../tools/definitions');
const { executeTool } = require('./toolExecutor');

// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://192.168.50.29:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:32b-instruct';

// System prompt
const SYSTEM_PROMPT = `You are an Amazon Business Analyst. Use the provided tools to fetch real-time data from the database. Today is 2026-01-07. Always return data in Markdown tables and provide insights on sales trends.

When users ask about:
- "current month" or "this month" → use filterType: "currentmonth"
- "previous month" or "last month" → use filterType: "previousmonth"
- "current year" or "this year" → use filterType: "currentyear"
- "last year" → use filterType: "lastyear"

Always format your responses with:
1. A summary of the data
2. Markdown tables for structured data
3. Key insights and trends
4. Recommendations when appropriate`;

/**
 * Make HTTP request to Ollama API with fallback hosts
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request data
 * @param {string} baseUrl - Base URL to use (optional, for retry with different host)
 * @returns {Promise<Object>} Response data
 */
const ollamaRequest = (endpoint, data, baseUrl = null) => {
  return new Promise((resolve, reject) => {
    const urlToUse = baseUrl || OLLAMA_BASE_URL;
    const url = new URL(`${urlToUse}${endpoint}`);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    // Only force IPv4 for localhost/127.0.0.1, not for remote IPs
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (isLocalhost) {
      options.family = 4; // Force IPv4 for localhost
    }

    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Ollama streams responses, so we need to parse line by line
            const lines = responseData.trim().split('\n').filter(line => line);
            const parsed = lines.map(line => JSON.parse(line));
            resolve(parsed);
          } else {
            // Parse error response to provide better error messages
            let errorMessage = `Ollama API error (${res.statusCode})`;
            try {
              const errorData = JSON.parse(responseData);
              if (errorData.error) {
                if (errorData.error.includes('not found')) {
                  errorMessage = `Model '${OLLAMA_MODEL}' not found. Please install it with: ollama pull ${OLLAMA_MODEL}`;
                } else {
                  errorMessage = `Ollama error: ${errorData.error}`;
                }
              } else {
                errorMessage = `Ollama API error (${res.statusCode}): ${responseData}`;
              }
            } catch (e) {
              errorMessage = `Ollama API error (${res.statusCode}): ${responseData}`;
            }
            reject(new Error(errorMessage));
          }
        } catch (error) {
          console.error('Failed to parse Ollama response:', error);
          console.error('Response data:', responseData);
          reject(new Error(`Failed to parse Ollama response: ${error.message}. Response: ${responseData.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Ollama request error:', error);
      console.error('Attempted URL:', urlToUse);
      console.error('Error code:', error.code);
      
      // If localhost failed, try 127.0.0.1
      if (error.code === 'ECONNREFUSED' && url.hostname === 'localhost' && !baseUrl) {
        console.log('Retrying with 127.0.0.1...');
        const altUrl = urlToUse.replace('localhost', '127.0.0.1');
        ollamaRequest(endpoint, data, altUrl)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (error.code === 'ECONNREFUSED') {
        reject(new Error(`Cannot connect to Ollama at ${urlToUse}. Ollama is running on [::]:11434. Try setting OLLAMA_BASE_URL=http://127.0.0.1:11434 in your .env file`));
      } else if (error.code === 'ENOTFOUND') {
        reject(new Error('Ollama host not found. Check OLLAMA_BASE_URL in your .env file'));
      } else if (error.code === 'EADDRNOTAVAIL') {
        reject(new Error(`Address not available. Try setting OLLAMA_BASE_URL=http://127.0.0.1:11434 in your .env file`));
      } else {
        reject(error);
      }
    });

    req.setTimeout(120000, () => {
      req.destroy(new Error('Ollama request timed out'));
    });

    req.write(postData);
    req.end();
  });
};

/**
 * Process agent query with Ollama
 * @param {string} userQuery - Natural language query from user
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Agent response
 */
const processQuery = async (userQuery, req) => {
  try {
    // Step 1: Send initial request to Ollama with tools
    const chatRequest = {
      model: OLLAMA_MODEL,
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
      tools: toolDefinitions,
      tool_choice: 'auto' // Let the model decide which tools to use
    };

    console.log('Sending request to Ollama...');
    console.log('Ollama URL:', OLLAMA_BASE_URL);
    console.log('Ollama Model:', OLLAMA_MODEL);
    
    const ollamaResponse = await ollamaRequest('/api/chat', chatRequest);
    
    if (!ollamaResponse || ollamaResponse.length === 0) {
      throw new Error('Empty response from Ollama. Check if the model is installed: ollama pull ' + OLLAMA_MODEL);
    }
    
    // Parse streaming response - get the last complete message
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
    
    if (!lastMessage) {
      throw new Error('No message received from Ollama. Response format might be incorrect.');
    }

    // If no tool calls, return the assistant's response directly
    if (!toolCalls || toolCalls.length === 0) {
      return {
        success: true,
        response: lastMessage?.content || 'No response from model',
        data: null
      };
    }

    // Step 2: Execute tool calls
    const toolResults = [];
    for (const toolCall of toolCalls) {
      try {
        const toolName = toolCall.function.name;
        // Handle arguments - could be string or object
        let parameters = {};
        if (toolCall.function.arguments) {
          if (typeof toolCall.function.arguments === 'string') {
            parameters = JSON.parse(toolCall.function.arguments);
          } else {
            parameters = toolCall.function.arguments;
          }
        }
        
        console.log(`Executing tool: ${toolName} with parameters:`, parameters);
        
        const result = await executeTool(toolName, parameters, req);
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: toolName,
          content: JSON.stringify(result)
        });
      } catch (error) {
        console.error(`Error executing tool ${toolCall.function.name}:`, error);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: toolCall.function.name,
          content: JSON.stringify({ error: error.message })
        });
      }
    }

    // Step 3: Send tool results back to Ollama for final response
    const followUpMessages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: userQuery
      },
      lastMessage, // Include the assistant's message with tool calls
      ...toolResults // Include tool results
    ];

    const finalRequest = {
      model: OLLAMA_MODEL,
      messages: followUpMessages,
      stream: false // Get complete response
    };

    console.log('Sending follow-up request with tool results...');
    const finalResponse = await ollamaRequest('/api/chat', finalRequest);
    
    // Get the final assistant message
    let finalMessage = null;
    for (const chunk of finalResponse) {
      if (chunk.message) {
        finalMessage = chunk.message;
      }
    }

    // Extract data from tool results for response
    const extractedData = toolResults.map(tr => {
      try {
        return JSON.parse(tr.content);
      } catch {
        return { content: tr.content };
      }
    });

    return {
      success: true,
      response: finalMessage?.content || 'No response from model',
      data: extractedData.length === 1 ? extractedData[0] : extractedData,
      toolCalls: toolCalls.map(tc => {
        // Handle arguments - could be string or object
        let params = {};
        if (tc.function.arguments) {
          if (typeof tc.function.arguments === 'string') {
            try {
              params = JSON.parse(tc.function.arguments);
            } catch {
              params = {};
            }
          } else {
            params = tc.function.arguments;
          }
        }
        return {
          name: tc.function.name,
          parameters: params
        };
      })
    };

  } catch (error) {
    console.error('Error processing agent query:', error);
    console.error('Error stack:', error.stack);
    // Provide more helpful error messages
    if (error.message.includes('not found')) {
      throw new Error(`Model '${OLLAMA_MODEL}' is not installed. Please run: ollama pull ${OLLAMA_MODEL}. Or check available models with: ollama list`);
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('Cannot connect to Ollama')) {
      throw new Error('Ollama is not running. Please start Ollama with: ollama serve');
    } else if (error.message.includes('ENOTFOUND')) {
      throw new Error('Ollama host not found. Check your OLLAMA_BASE_URL environment variable.');
    } else if (error.message.includes('timeout')) {
      throw new Error('Ollama request timed out. The model might be too slow or Ollama is not responding.');
    } else {
      throw error;
    }
  }
};

/**
 * Format response as Markdown table
 * @param {Array} data - Data array
 * @param {Array} columns - Column names
 * @returns {string} Markdown table
 */
const formatAsMarkdownTable = (data, columns) => {
  if (!data || data.length === 0) {
    return 'No data available.';
  }

  // Get all keys from first object if columns not provided
  if (!columns) {
    columns = Object.keys(data[0]);
  }

  // Create header
  let table = '| ' + columns.join(' | ') + ' |\n';
  table += '| ' + columns.map(() => '---').join(' | ') + ' |\n';

  // Add rows
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col] || row[col.toLowerCase()] || '';
      return typeof value === 'number' ? value.toFixed(2) : String(value);
    });
    table += '| ' + values.join(' | ') + ' |\n';
  }

  return table;
};

module.exports = {
  processQuery,
  formatAsMarkdownTable
};

