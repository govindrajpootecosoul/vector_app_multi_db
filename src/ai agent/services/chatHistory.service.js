/**
 * Chat History Service
 * Manages chat sessions and conversation history
 * Uses in-memory storage (can be upgraded to database)
 */

class ChatHistoryService {
  constructor() {
    // In-memory storage: { sessionId: { messages: [], title: '', createdAt: Date, updatedAt: Date } }
    this.sessions = new Map();
    // User sessions: { userId: [sessionId1, sessionId2, ...] }
    this.userSessions = new Map();
  }

  /**
   * Create a new chat session
   * @param {string} userId - User identifier (databaseName)
   * @param {string} sessionId - Optional session ID (auto-generated if not provided)
   * @returns {string} Session ID
   */
  createSession(userId, sessionId = null) {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.sessions.set(id, {
      id,
      userId,
      messages: [],
      title: 'New Chat',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, []);
    }
    this.userSessions.get(userId).push(id);

    return id;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session object or null
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions for a user
   * @param {string} userId - User identifier
   * @returns {Array} Array of session objects
   */
  getUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId) || [];
    return sessionIds
      .map(id => this.sessions.get(id))
      .filter(session => session !== undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Add message to session
   * @param {string} sessionId - Session ID
   * @param {string} role - Message role ('user' or 'assistant')
   * @param {string} content - Message content
   * @param {Object} metadata - Optional metadata (toolCalls, data, etc.)
   * @returns {boolean} Success status
   */
  addMessage(sessionId, role, content, metadata = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const message = {
      role,
      content,
      timestamp: new Date(),
      ...metadata
    };

    session.messages.push(message);
    session.updatedAt = new Date();

    // Auto-generate title from first user message
    if (session.messages.length === 1 && role === 'user') {
      session.title = this.generateTitle(content);
    }

    return true;
  }

  /**
   * Get conversation history for a session
   * @param {string} sessionId - Session ID
   * @returns {Array} Array of messages
   */
  getHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  /**
   * Update session title
   * @param {string} sessionId - Session ID
   * @param {string} title - New title
   * @returns {boolean} Success status
   */
  updateTitle(sessionId, title) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    session.title = title;
    session.updatedAt = new Date();
    return true;
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID
   * @returns {boolean} Success status
   */
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove from user sessions
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      const index = userSessions.indexOf(sessionId);
      if (index > -1) {
        userSessions.splice(index, 1);
      }
    }

    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Clear all sessions for a user
   * @param {string} userId - User identifier
   * @returns {number} Number of sessions deleted
   */
  clearUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId) || [];
    let deleted = 0;
    
    for (const sessionId of sessionIds) {
      if (this.sessions.delete(sessionId)) {
        deleted++;
      }
    }
    
    this.userSessions.delete(userId);
    return deleted;
  }

  /**
   * Generate a title from the first user message
   * @param {string} content - First message content
   * @returns {string} Generated title
   */
  generateTitle(content) {
    // Simple title generation - take first 50 chars
    const maxLength = 50;
    let title = content.trim();
    
    // Remove common prefixes
    title = title.replace(/^(show me|what are|get|tell me|give me|i want|i need)/i, '').trim();
    
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    // Truncate if too long
    if (title.length > maxLength) {
      title = title.substring(0, maxLength).trim() + '...';
    }
    
    return title || 'New Chat';
  }

  /**
   * Clean up old sessions (older than specified days)
   * @param {number} daysOld - Number of days
   * @returns {number} Number of sessions deleted
   */
  cleanupOldSessions(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deleted = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.updatedAt < cutoffDate) {
        this.deleteSession(sessionId);
        deleted++;
      }
    }
    
    return deleted;
  }
}

// Export singleton instance
module.exports = new ChatHistoryService();

