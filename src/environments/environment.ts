// Development environment configuration

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/api',
  authUrl: 'http://localhost:8082/api/v1',
  wsUrl: 'ws://localhost:8082',
  logLevel: 'debug',
  features: {
    enableDevTools: true,
    enableMocking: false,
    enableAnalytics: false
  }
};
