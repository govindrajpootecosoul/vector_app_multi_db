/**
 * Agent Routes
 */

const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

// All agent routes require authentication
router.post('/query', authenticateToken, agentController.processQuery);
router.get('/tools', authenticateToken, agentController.getTools);
router.get('/health', agentController.checkHealth); // Health check doesn't require auth
router.get('/models', agentController.getAvailableModels); // Get available models (no auth)

// Streaming chat endpoints
router.post('/chat/stream', authenticateToken, agentController.chatStream);
router.get('/chat/sessions', authenticateToken, agentController.getSessions);
router.get('/chat/sessions/:sessionId', authenticateToken, agentController.getSessionHistory);
router.delete('/chat/sessions/:sessionId', authenticateToken, agentController.deleteSession);
router.delete('/chat/sessions', authenticateToken, agentController.clearSessions);

module.exports = router;

