export const environment = {
  production: false,
  // TODO: MIDDLEWARE INTEGRATION
  // Frontend communicates with NestJS middleware (API Gateway) instead of directly calling Spring Boot
  // 
  // Architecture:
  //   Angular Frontend (port 4200) 
  //       ↓
  //   NestJS Middleware (port 3000) - API Gateway/Authentication Layer
  //       ↓
  //   Spring Boot Backend (port 8080) - Business Logic
  //
  // NestJS Middleware Responsibilities:
  // - Route requests to appropriate Spring Boot endpoints
  // - Handle JWT token validation and refresh
  // - Centralized authentication (login, register, token management)
  // - Request/response transformation (if needed)
  // - Rate limiting, request logging, etc.
  apiUrl: 'http://localhost:3000/api'
};
