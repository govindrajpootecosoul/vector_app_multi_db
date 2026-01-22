/**
 * Streaming Agent Service
 * ChatGPT-like streaming interface with SSE (Server-Sent Events)
 */

const { executeTool } = require('./toolExecutor');
const { STREAMING_SYSTEM_PROMPT } = require('../configs/streaming.prompt');
const { chat, chatStream } = require('../utils/ollama.client');
const toolDefinitions = require('../tools/definitions');
const chatHistory = require('./chatHistory.service');

class StreamingAgent {
  /**
   * Send SSE (Server-Sent Events) message
   * @param {Object} res - Express response object
   * @param {Object} data - Data to send
   */
  sendSSE(res, data) {
    const message = JSON.stringify({ 
      id: Date.now(), 
      timestamp: new Date().toISOString(),
      ...data 
    });
    res.write(`data: ${message}\n\n`);
    
    // Flush if available (Node.js 18+)
    if (typeof res.flush === 'function') {
      res.flush();
    }
  }

  /**
   * Summarize tool result for preview
   * @param {Object} result - Tool execution result
   * @returns {string} Summary string
   */
  summarizeTool(result) {
    if (!result || !result.success) {
      return 'Error occurred';
    }

    if (result.data && Array.isArray(result.data)) {
      const count = result.data.length;
      if (count === 0) {
        return 'No data found';
      }

      // Try to find total sales or similar metric
      const firstRow = result.data[0];
      if (firstRow.total_sales !== undefined) {
        const total = result.data.reduce((sum, row) => sum + (parseFloat(row.total_sales) || 0), 0);
        return `${count} records, $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total`;
      }
      
      if (firstRow.totalSales !== undefined) {
        const total = result.data.reduce((sum, row) => sum + (parseFloat(row.totalSales) || 0), 0);
        return `${count} records, $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total`;
      }

      return `${count} records found`;
    }

    if (result.data && typeof result.data === 'object') {
      // Single object result
      if (result.data.totalItems !== undefined) {
        return `${result.data.totalItems} items`;
      }
      return 'Data retrieved';
    }

    return 'Complete';
  }

  /**
   * Main streaming chat handler
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware
   */
  async chatStream(req, res, next) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    try {
      const { message, sessionId: providedSessionId } = req.body;
      const userId = req.user?.databaseName || req.user?.userId || 'anonymous';

      if (!message || typeof message !== 'string') {
        this.sendSSE(res, { 
          type: 'error', 
          message: 'Message is required' 
        });
        res.end();
        return;
      }

      // Get or create session
      let sessionId = providedSessionId;
      if (!sessionId) {
        sessionId = chatHistory.createSession(userId);
        this.sendSSE(res, { 
          type: 'session', 
          sessionId 
        });
      } else {
        const session = chatHistory.getSession(sessionId);
        if (!session || session.userId !== userId) {
          // Create new session if invalid
          sessionId = chatHistory.createSession(userId);
          this.sendSSE(res, { 
            type: 'session', 
            sessionId 
          });
        }
      }

      // Add user message to history
      chatHistory.addMessage(sessionId, 'user', message);

      // Get conversation history
      const history = chatHistory.getHistory(sessionId);
      const conversationMessages = history
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({ role: msg.role, content: msg.content }));

      // 1. IMMEDIATE START (<100ms)
      this.sendSSE(res, { 
        type: 'start', 
        content: '🔍 Analyzing your Amazon data...' 
      });

      // 2. Initial analysis with tools (parallel)
      const initialMessages = [
        { role: 'system', content: STREAMING_SYSTEM_PROMPT },
        ...conversationMessages
      ];

      let initialAnalysis;
      try {
        initialAnalysis = await chat({
          messages: initialMessages,
          tools: toolDefinitions
        });
      } catch (error) {
        console.error('Ollama initial request error:', error);
        this.sendSSE(res, { 
          type: 'error', 
          message: `Failed to connect to AI: ${error.message}` 
        });
        res.end();
        return;
      }

      const lastMessage = initialAnalysis.message;
      const toolCalls = lastMessage?.tool_calls || [];

      // 3. Execute tools if needed
      let toolResults = [];
      if (toolCalls.length > 0) {
        // Send tool execution status
        for (const toolCall of toolCalls) {
          this.sendSSE(res, { 
            type: 'tool', 
            tool: toolCall.function?.name || 'unknown',
            status: 'running',
            message: `Executing ${toolCall.function?.name || 'tool'}...`
          });
        }

        // Execute all tools in parallel for speed
        try {
          toolResults = await Promise.all(
            toolCalls.map(async (toolCall) => {
              try {
                const toolName = toolCall.function?.name;
                let parameters = {};
                
                if (toolCall.function?.arguments) {
                  if (typeof toolCall.function.arguments === 'string') {
                    parameters = JSON.parse(toolCall.function.arguments);
                  } else {
                    parameters = toolCall.function.arguments;
                  }
                }

                const result = await executeTool(toolName, parameters, req);
                
                // Send tool completion status
                this.sendSSE(res, {
                  type: 'tool',
                  tool: toolName,
                  status: 'done',
                  preview: this.summarizeTool(result)
                });

                return {
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: toolName,
                  content: JSON.stringify(result)
                };
              } catch (error) {
                console.error(`Error executing tool ${toolCall.function?.name}:`, error);
                this.sendSSE(res, {
                  type: 'tool',
                  tool: toolCall.function?.name || 'unknown',
                  status: 'error',
                  message: error.message
                });
                
                return {
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: toolCall.function?.name || 'unknown',
                  content: JSON.stringify({ error: error.message })
                };
              }
            })
          );
        } catch (error) {
          console.error('Tool execution error:', error);
          this.sendSSE(res, { 
            type: 'error', 
            message: `Tool execution failed: ${error.message}` 
          });
        }
      }

      // 4. Stream final LLM response
      const finalMessages = [
        { role: 'system', content: STREAMING_SYSTEM_PROMPT },
        ...conversationMessages,
        lastMessage, // Assistant's message with tool calls
        ...toolResults // Tool results
      ];

      this.sendSSE(res, { 
        type: 'thinking', 
        content: '💭 Generating insights...' 
      });

      let fullResponse = '';

      try {
        // Stream response from Ollama
        const stream = chatStream({
          messages: finalMessages,
          stream: true
        });

        for await (const chunk of stream) {
          // Extract content from chunk
          if (chunk && chunk.message?.content) {
            const token = chunk.message.content;
            fullResponse += token;
            this.sendSSE(res, { 
              type: 'chunk', 
              content: token 
            });
          } else if (chunk && chunk.done) {
            // Stream complete
            break;
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
        // Fallback: try non-streaming
        try {
          const fallbackResponse = await chat({
            messages: finalMessages,
            stream: false
          });
          fullResponse = fallbackResponse.message?.content || 'Response generated';
          // Send as single chunk
          this.sendSSE(res, { 
            type: 'chunk', 
            content: fullResponse 
          });
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
          this.sendSSE(res, { 
            type: 'error', 
            message: `Failed to generate response: ${fallbackError.message}` 
          });
          res.end();
          return;
        }
      }

      // 5. Save assistant message to history
      chatHistory.addMessage(sessionId, 'assistant', fullResponse, {
        toolCalls: toolCalls.map(tc => ({
          name: tc.function?.name,
          parameters: tc.function?.arguments ? 
            (typeof tc.function.arguments === 'string' ? 
              JSON.parse(tc.function.arguments) : 
              tc.function.arguments) : 
            {}
        })),
        toolResults: toolResults.map(tr => {
          try {
            return JSON.parse(tr.content);
          } catch {
            return { content: tr.content };
          }
        })
      });

      // 6. Send completion
      this.sendSSE(res, { 
        type: 'end', 
        complete: true,
        sessionId,
        messageLength: fullResponse.length
      });

      res.end();

    } catch (error) {
      console.error('Streaming agent error:', error);
      console.error('Error stack:', error.stack);
      
      this.sendSSE(res, { 
        type: 'error', 
        message: error.message || 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      res.end();
    }
  }
}

module.exports = new StreamingAgent();

