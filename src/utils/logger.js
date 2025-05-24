// Simple browser-compatible logger
const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] ${message}`, meta);
  },
  error: (message, meta = {}) => {
    console.error(`[ERROR] ${message}`, meta);
  },
  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${message}`, meta);
  },
  debug: (message, meta = {}) => {
    console.debug(`[DEBUG] ${message}`, meta);
  }
};

// Helper functions for consistent logging
const logHelpers = {
  logRequest: (method, path, statusCode, duration, userAgent) => {
    logger.info('Request completed', {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      userAgent
    });
  },
  logError: (error, context = {}) => {
    logger.error('Error occurred', {
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  }
};

export { logger, logHelpers }; 