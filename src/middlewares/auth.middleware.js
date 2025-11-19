const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate JWT token and extract user information
 * Also extracts databaseName from token and attaches it to request for dynamic database switching
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Access attempt without token');
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn('Invalid token attempt');
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Attach user info to request (userId, email, client_id, databaseName)
    req.user = user;
    
    // Extract databaseName from token and attach to request
    // This will be used by getConnection() to switch to the correct database
    console.log('🔐 AUTH MIDDLEWARE - Token decoded:', {
      userId: user.userId || user.id,
      email: user.email,
      client_id: user.client_id,
      databaseName: user.databaseName
    });
    
    if (user.databaseName) {
      req.databaseName = user.databaseName;
      logger.info(`Database context set to: ${user.databaseName} for user: ${user.email}`);
      console.log(`✅ Database name extracted from token: ${user.databaseName}`);
    } else {
      logger.warn(`No databaseName found in token for user: ${user.email}`);
      console.error(`❌ WARNING: No databaseName in token for user: ${user.email}`);
      console.log('Token payload keys:', Object.keys(user));
    }

    next();
  });
};

module.exports = {
  authenticateToken,
};
