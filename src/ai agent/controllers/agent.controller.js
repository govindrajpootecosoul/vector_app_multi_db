/**
 * Agent Controller
 * Handles HTTP requests for the AI agent
 */

const agentService = require('../services/agent.service');

/**
 * Process natural language query
 * POST /api/agent/query
 */
exports.processQuery = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
        message: 'Please provide a natural language query in the request body.'
      });
    }

    console.log('Processing agent query:', query);

    const result = await agentService.processQuery(query, req);

    res.json({
      success: true,
      message: 'Query processed successfully',
      ...result
    });

  } catch (error) {
    console.error('Agent controller error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred',
      message: 'Failed to process query',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get available tools
 * GET /api/agent/tools
 */
exports.getTools = async (req, res) => {
  try {
    const toolDefinitions = require('../tools/definitions');
    
    const tools = toolDefinitions.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }));

    res.json({
      success: true,
      message: 'Tools retrieved successfully',
      data: tools
    });

  } catch (error) {
    console.error('Error getting tools:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get available Ollama models
 * GET /api/agent/models
 */
exports.getAvailableModels = async (req, res) => {
  try {
    const http = require('http');
    const { URL } = require('url');
    const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://192.168.50.29:11434';
    
    return new Promise((resolve) => {
      const url = new URL(`${OLLAMA_BASE_URL}/api/tags`);
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      };
      
      const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (isLocalhost) {
        options.family = 4;
      }

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const models = JSON.parse(data);
            resolve({
              success: true,
              models: models.models || [],
              configuredModel: process.env.OLLAMA_MODEL || 'qwen2.5:32b-instruct'
            });
          } catch (e) {
            resolve({
              success: false,
              error: 'Failed to parse models list'
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Connection timeout'
        });
      });

      req.end();
    }).then((result) => {
      res.json({
        success: result.success,
        message: result.success ? 'Models retrieved successfully' : 'Failed to get models',
        data: result
      });
    });

  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Health check for Ollama connection
 * GET /api/agent/health
 */
exports.checkHealth = async (req, res) => {
  try {
    const http = require('http');
    const { URL } = require('url');
    const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://192.168.50.29:11434';
    
    // Test multiple hostnames
    const testHosts = [
      { name: 'configured', url: OLLAMA_BASE_URL },
      { name: 'localhost', url: 'http://localhost:11434' },
      { name: '127.0.0.1', url: 'http://127.0.0.1:11434' }
    ];
    
    const testConnection = (hostUrl) => {
      return new Promise((resolve) => {
        const url = new URL(`${hostUrl}/api/tags`);
        const options = {
          hostname: url.hostname,
          port: url.port || 80,
          path: url.pathname,
          method: 'GET',
          timeout: 5000
        };
        
        // Only force IPv4 for localhost/127.0.0.1, not for remote IPs
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        if (isLocalhost) {
          options.family = 4; // Force IPv4 for localhost
        }

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve({
                success: true,
                host: url.hostname,
                url: hostUrl,
                response: JSON.parse(data)
              });
            } catch (e) {
              resolve({
                success: false,
                host: url.hostname,
                url: hostUrl,
                error: 'Failed to parse response'
              });
            }
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            host: url.hostname,
            url: hostUrl,
            error: error.message,
            code: error.code
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            host: url.hostname,
            url: hostUrl,
            error: 'Connection timeout'
          });
        });

        req.end();
      });
    };

    // Test all hosts
    const results = await Promise.all(testHosts.map(host => testConnection(host.url)));
    const workingHost = results.find(r => r.success);
    
    if (workingHost) {
      res.json({
        success: true,
        message: 'Ollama is accessible',
        data: {
          ollamaRunning: true,
          workingHost: workingHost.host,
          workingUrl: workingHost.url,
          model: process.env.OLLAMA_MODEL || 'qwen2.5:32b-instruct',
          allTests: results,
          recommendation: workingHost.host !== new URL(OLLAMA_BASE_URL).hostname 
            ? `Update OLLAMA_BASE_URL in .env to: ${workingHost.url}`
            : 'Current configuration is working'
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Ollama is not accessible',
        data: {
          ollamaRunning: false,
          configuredUrl: OLLAMA_BASE_URL,
          model: process.env.OLLAMA_MODEL || 'qwen2.5:32b-instruct',
          allTests: results,
          suggestions: [
            'Make sure Ollama is running: ollama serve',
            'Try setting OLLAMA_BASE_URL=http://192.168.50.29:11434 in your .env file',
            'Check if port 11434 is accessible',
            'Verify Ollama is listening on the correct interface'
          ]
        }
      });
    }

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

