// Development environment configuration

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/api',
  authUrl: 'http://localhost:3001/api/v1',
  wsUrl: 'ws://localhost:3001',
  logLevel: 'debug',
  features: {
    enableDevTools: true,
    enableMocking: false,
    enableAnalytics: false
  }
};
