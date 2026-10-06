// TODO: MIDDLEWARE INTEGRATION
// API Configuration should point to NestJS middleware, NOT directly to Spring Boot
// 
// Development:
// - Frontend (Angular): http://localhost:4200
// - Middleware (NestJS): http://localhost:3000/api
// - Backend (Spring Boot): http://localhost:8080 (not exposed to frontend)
// 
// Production:
// - Frontend: https://trading-service.com
// - Middleware: https://api.trading-service.com/api
// - Backend: Internal only, behind NestJS
// 
// NestJS Responsibilities:
// 1. Route management - forward requests to appropriate Spring Boot endpoint
// 2. Authentication - validate JWT tokens, prevent unauthorized access
// 3. Rate limiting - prevent abuse
// 4. Request logging - audit trail
// 5. Response transformation - if needed (e.g., rename fields)
// 6. Error handling - consistent error format
// 7. Request validation - basic validation before reaching Spring Boot
// 8. Real-time features - WebSocket for market data updates (optional)
export const API_CONFIG = {
  baseUrl: 'http://localhost:3000/api', // Points to NestJS middleware, not Spring Boot
  timeout: 30000
};

// Trading Rules & Compliance (from backend agreement.txt)
export const TRADING_RULES = {
  // Position Limits
  MAX_SHARES_PER_INSTRUMENT: 10000,
  MAX_ORDER_QUANTITY: 1000000,
  MIN_ORDER_PRICE: 0.01,

  // Account Requirements
  MIN_ACCOUNT_BALANCE: 0, // No negative cash balances

  // Compliance Flags
  ACCOUNT_AGREEMENT_REQUIRED: true,
  KYC_REQUIRED: true,
  ALLOWED_ACCOUNT_STATUSES: ['ACTIVE']
};

// Risk Profiles & Suitability
export const RISK_PROFILES = {
  CONSERVATIVE: {
    label: 'Conservative',
    description: 'Capital preservation, low risk tolerance',
    allowedAssets: ['STOCK', 'ETF'],
    maxVolatility: 'low'
  },
  MODERATE: {
    label: 'Moderate',
    description: 'Balanced growth and income',
    allowedAssets: ['STOCK', 'ETF', 'MUTUAL_FUND'],
    maxVolatility: 'medium'
  },
  AGGRESSIVE: {
    label: 'Aggressive',
    description: 'Maximum growth, high risk tolerance',
    allowedAssets: ['STOCK', 'ETF', 'MUTUAL_FUND'],
    maxVolatility: 'high'
  }
};

// Portfolio Size Ranges
export const PORTFOLIO_SIZE_RANGES = {
  UNDER_50K: { min: 0, max: 50000, label: 'Under $50K' },
  BETWEEN_50K_100K: { min: 50000, max: 100000, label: '$50K - $100K' },
  BETWEEN_100K_200K: { min: 100000, max: 200000, label: '$100K - $200K' },
  BETWEEN_200K_500K: { min: 200000, max: 500000, label: '$200K - $500K' },
  OVER_500K: { min: 500000, max: Infinity, label: 'Over $500K' }
};

// Order Status Colors (for UI)
export const ORDER_STATUS_COLORS = {
  PENDING: '#FFA500',    // Orange
  FILLED: '#4CAF50',     // Green
  CANCELLED: '#808080',  // Gray
  REJECTED: '#F44336'    // Red
};

// Account Status Colors (for UI)
export const ACCOUNT_STATUS_COLORS = {
  ACTIVE: '#4CAF50',       // Green
  RESTRICTED: '#FFA500',   // Orange
  SUSPENDED: '#F44336',    // Red
  CLOSED: '#808080'        // Gray
};

// Asset Class Labels
export const ASSET_CLASS_LABELS = {
  STOCK: 'Stock',
  ETF: 'Exchange Traded Fund',
  MUTUAL_FUND: 'Mutual Fund'
};

// Transaction Type Labels
export const TRANSACTION_TYPE_LABELS = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal'
};

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  SSN_LAST4_LENGTH: 4,
  PHONE_PATTERN: /^\d{10}$/
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  CURRENT_USER: 'current_user',
  PREFERENCES: 'user_preferences'
};

// Compliance Messages
export const COMPLIANCE_MESSAGES = {
  AGREEMENT_REQUIRED: 'You must accept the account agreement before trading',
  KYC_REQUIRED: 'Your account must be verified before trading',
  ACCOUNT_INACTIVE: 'Your account is not active for trading',
  INSUFFICIENT_FUNDS: 'Insufficient funds for this order',
  POSITION_LIMIT_EXCEEDED: 'Order would exceed position limit of ' + TRADING_RULES.MAX_SHARES_PER_INSTRUMENT + ' shares',
  ORDER_QUANTITY_INVALID: 'Order quantity must be between 1 and ' + TRADING_RULES.MAX_ORDER_QUANTITY
};

// TODO: MIDDLEWARE INTEGRATION
// Error codes and handling that NestJS middleware should implement
// These are consistent between frontend and middleware validation
export const MIDDLEWARE_ERROR_CODES = {
  // Authentication errors (from NestJS)
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Validation errors (from NestJS)
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_EMAIL: 'INVALID_EMAIL',
  PASSWORD_WEAK: 'PASSWORD_WEAK',
  
  // Business logic errors (from NestJS or Spring Boot via NestJS)
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  ORDER_REJECTED: 'ORDER_REJECTED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  RATE_LIMITED: 'RATE_LIMITED'
};

// TODO: MIDDLEWARE INTEGRATION
// NestJS Middleware Checklist - things to implement in the middleware
export const MIDDLEWARE_CHECKLIST = {
  AUTH_SERVICE: [
    '[ ] Implement login endpoint - validate credentials, return JWT token',
    '[ ] Implement register endpoint - create user, return token',
    '[ ] Implement refresh endpoint - validate refresh token, issue new access token',
    '[ ] Implement verify endpoint - check if token is valid',
    '[ ] JWT Secret configuration',
    '[ ] Token expiration times (access: 15-30 min, refresh: 7-30 days)',
    '[ ] Password hashing (bcrypt recommended)'
  ],
  
  ROUTING: [
    '[ ] Forward all /api/* requests to appropriate Spring Boot endpoint',
    '[ ] Maintain same endpoint paths (e.g., /api/clients → Spring Boot /clients)',
    '[ ] Add user context to request headers before forwarding to Spring Boot',
    '[ ] Parse Spring Boot response and return to frontend'
  ],
  
  INTERCEPTORS: [
    '[ ] Token validation middleware - validate JWT on every request',
    '[ ] Error handling middleware - catch errors, format response',
    '[ ] Logging middleware - log requests/responses for debugging',
    '[ ] CORS middleware - allow frontend origin'
  ],
  
  VALIDATION: [
    '[ ] Email format validation',
    '[ ] Password strength validation',
    '[ ] Request body validation before forwarding to Spring Boot',
    '[ ] Rate limiting per user/IP'
  ],
  
  OPTIONAL_FEATURES: [
    '[ ] WebSocket connection for real-time market data',
    '[ ] Request caching for frequently accessed endpoints',
    '[ ] GraphQL layer (alternative to REST)',
    '[ ] Circuit breaker pattern (if Spring Boot is down)',
    '[ ] Request compression',
    '[ ] API documentation (Swagger)'
  ]
};
