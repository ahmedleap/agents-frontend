// Development environment configuration

export const environment = {
  production: false,
  apiUrl: '/api',
  wsUrl: 'ws://localhost:3000',
  logLevel: 'debug',
  features: {
    enableDevTools: true,
    enableMocking: false,
    enableAnalytics: false
  }
};
