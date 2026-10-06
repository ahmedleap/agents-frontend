export const environment = {
  production: true,
  // TODO: MIDDLEWARE INTEGRATION
  // In production, NestJS middleware should run on the same domain as frontend
  // or have proper CORS configuration
  // 
  // Example production setup:
  // - Frontend: https://trading-service.com (Angular app)
  // - Middleware: https://api.trading-service.com/api (NestJS Gateway on port 3000)
  // - Backend: https://backend.internal:8080 (Spring Boot, internal only)
  //
  // NestJS should NOT expose Spring Boot directly to frontend
  apiUrl: 'https://api.trading-service.com/api'
};
