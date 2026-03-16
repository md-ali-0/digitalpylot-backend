// Application Constants
export const APP_CONSTANTS = {
  // Stock Management
  STOCK_THRESHOLDS: {
    LOW_STOCK: 10,
    OUT_OF_STOCK: 0,
    MIN_STOCK: 1,
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100, // Prevent abuse by limiting maximum items per page
  },

  // Request Limits
  REQUEST_LIMITS: {
    JSON_BODY_SIZE: '10mb',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  },

  // Security
  SECURITY: {
    MIN_SECRET_LENGTH: 32,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_RESET_TOKEN_EXPIRY: 3600, // 1 hour in seconds
    VERIFICATION_TOKEN_EXPIRY: 86400, // 24 hours in seconds
  },

  // Rate Limiting
  RATE_LIMITS: {
    // Authentication endpoints
    AUTH: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 5,
      MESSAGE: 'Too many authentication attempts, please try again later',
    },
    // Password reset
    PASSWORD_RESET: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_REQUESTS: 3,
      MESSAGE: 'Too many password reset attempts, please try again later',
    },
    // General API
    GENERAL: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100,
      MESSAGE: 'Too many requests, please try again later',
    },
  },

  // Cache TTL (Time To Live in seconds)
  CACHE_TTL: {
    PRODUCTS: 300, // 5 minutes
    CATEGORIES: 600, // 10 minutes
    SETTINGS: 3600, // 1 hour
    USER_SESSION: 86400, // 24 hours
    REPORTS: 300, // 5 minutes
    VENDORS: 600, // 10 minutes
    SHIPPING: 3600, // 1 hour
    EXCHANGE_RATES: 86400, // 24 hours
  },

  // Order Management
  ORDER: {
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
    PENDING_TIMEOUT_HOURS: 24,
  },
} as const;

// Export individual constants for convenience
export const {
  STOCK_THRESHOLDS,
  PAGINATION,
  REQUEST_LIMITS,
  SECURITY,
  RATE_LIMITS,
  CACHE_TTL,
  ORDER,
} = APP_CONSTANTS;
