// Production environment configuration

export const environment = {
  production: true,
  middlewareBaseUrl: 'https://api.agentsofleap.com/api/v1',
  backendBaseUrl: 'https://api.agentsofleap.com',
  wsUrl: 'wss://api.agentsofleap.com',
  logLevel: 'error',
  features: {
    enableDevTools: false,
    enableMocking: false,
    enableAnalytics: true
  }
};
