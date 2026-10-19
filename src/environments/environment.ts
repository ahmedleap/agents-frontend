// Development environment configuration

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/api',
  wsUrl: 'ws://localhost:3000',
  logLevel: 'debug',
  // No login yet: John Trader from the shared dev database (port 15432)
  devClientId: 'aa0e8400-e29b-41d4-a716-446655440001',
  features: {
    enableDevTools: true,
    enableMocking: false,
    enableAnalytics: false
  }
};
