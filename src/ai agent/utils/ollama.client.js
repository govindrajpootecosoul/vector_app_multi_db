/**
 * Ollama HTTP Client for Streaming
 * Handles both streaming and non-streaming requests to Ollama API
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://192.168.50.29:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:32b-instruct';

/**
 * Make streaming request to Ollama API
 * @param {Object} options - Request options
 * @param {Array} options.messages - Chat messages
 * @param {Array} options.tools - Tool definitions (optional)
 * @param {boolean} options.stream - Whether to stream response
 * @returns {AsyncGenerator} Stream of response chunks
 */
async function* chatStream(options) {
  const { messages, tools, stream = true } = options;
  
  const requestData = {
    model: OLLAMA_MODEL,
    messages,
    stream
  };
  
  if (tools) {
    requestData.tools = tools;
    requestData.tool_choice = 'auto';
  }

  const url = new URL(`${OLLAMA_BASE_URL}/api/chat`);
  const postData = JSON.stringify(requestData);
  
  const requestOptions = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  // Force IPv4 for localhost
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocalhost) {
    requestOptions.family = 4;
  }

  const protocol = url.protocol === 'https:' ? https : http;

  // Create a readable stream wrapper
  const streamQueue = [];
  let streamEnded = false;
  let streamError = null;

  const req = protocol.request(requestOptions, (res) => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      let errorData = '';
      res.on('data', (chunk) => { errorData += chunk; });
      res.on('end', () => {
        try {
          const error = JSON.parse(errorData);
          streamError = new Error(error.error || `HTTP ${res.statusCode}`);
          streamEnded = true;
        } catch {
          streamError = new Error(`HTTP ${res.statusCode}: ${errorData}`);
          streamEnded = true;
        }
      });
      return;
    }

    let buffer = '';
    
    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            streamQueue.push({ data: parsed, done: false });
          } catch (e) {
            console.warn('Failed to parse chunk:', line);
          }
        }
      }
    });

    res.on('end', () => {
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          streamQueue.push({ data: parsed, done: false });
        } catch (e) {
          console.warn('Failed to parse final chunk:', buffer);
        }
      }
      streamEnded = true;
      streamQueue.push({ data: null, done: true });
    });
  });

  req.on('error', (error) => {
    if (error.code === 'ECONNREFUSED' && url.hostname === 'localhost') {
      // Retry with 127.0.0.1 - handled by caller
      streamError = new Error(`Connection refused. Try setting OLLAMA_BASE_URL=http://127.0.0.1:11434`);
      streamEnded = true;
      streamQueue.push({ data: null, done: true, error: streamError });
      return;
    }
    streamError = error;
    streamEnded = true;
    streamQueue.push({ data: null, done: true, error });
  });

  req.setTimeout(120000, () => {
    req.destroy();
    streamError = new Error('Ollama request timed out');
    streamEnded = true;
    streamQueue.push({ data: null, done: true, error: streamError });
  });

  req.write(postData);
  req.end();

  // Yield chunks as they arrive
  while (!streamEnded || streamQueue.length > 0) {
    if (streamQueue.length > 0) {
      const item = streamQueue.shift();
      if (item.error) {
        throw item.error;
      }
      if (item.done) {
        return;
      }
      yield item.data;
    } else {
      // Wait a bit for more data
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  if (streamError) {
    throw streamError;
  }
}

/**
 * Make non-streaming request to Ollama API
 * @param {Object} options - Request options
 * @param {Array} options.messages - Chat messages
 * @param {Array} options.tools - Tool definitions (optional)
 * @returns {Promise<Object>} Complete response
 */
async function chat(options) {
  const { messages, tools } = options;
  
  const requestData = {
    model: OLLAMA_MODEL,
    messages,
    stream: false
  };
  
  if (tools) {
    requestData.tools = tools;
    requestData.tool_choice = 'auto';
  }

  const url = new URL(`${OLLAMA_BASE_URL}/api/chat`);
  const postData = JSON.stringify(requestData);
  
  const requestOptions = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocalhost) {
    requestOptions.family = 4;
  }

  const protocol = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = protocol.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const lines = responseData.trim().split('\n').filter(line => line);
            const parsed = lines.map(line => JSON.parse(line));
            
            // Extract the last complete message
            let lastMessage = null;
            for (const chunk of parsed) {
              if (chunk.message) {
                lastMessage = chunk.message;
              }
            }
            
            resolve({ message: lastMessage, chunks: parsed });
          } else {
            let errorMessage = `Ollama API error (${res.statusCode})`;
            try {
              const errorData = JSON.parse(responseData);
              if (errorData.error) {
                errorMessage = errorData.error;
              }
            } catch (e) {
              errorMessage = `Ollama API error (${res.statusCode}): ${responseData}`;
            }
            reject(new Error(errorMessage));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Ollama response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED' && url.hostname === 'localhost') {
        const altUrl = OLLAMA_BASE_URL.replace('localhost', '127.0.0.1');
        chat({ ...options, baseUrl: altUrl })
          .then(resolve)
          .catch(reject);
        return;
      }
      reject(error);
    });

    req.setTimeout(120000, () => {
      req.destroy(new Error('Ollama request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  chat,
  chatStream,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL
};

