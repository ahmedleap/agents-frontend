// Development environment configuration

export const environment = {
  production: false,
  middlewareBaseUrl: 'http://10.14.131.55:8082/api/v1',
  backendBaseUrl: 'http://localhost:8081',
  wsUrl: 'ws://localhost:3000',
  logLevel: 'debug',
  features: {
    enableDevTools: true,
    enableMocking: false,
    enableAnalytics: false
  }
};
