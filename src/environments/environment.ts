// Development environment configuration

export const environment = {
  production: false,
  backendUrl: '/api',
  middlewareUrl: 'http://10.14.131.55:8082/api/v1',
  logLevel: 'debug',
  features: {
    enableDevTools: true,
    enableMocking: false,
    enableAnalytics: false
  }
};
