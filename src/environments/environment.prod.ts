// Production environment configuration

export const environment = {
  production: true,
  backendUrl: 'https://api.agentsofleap.com/api',
  middlewareUrl: 'https://api.agentsofleap.com/api/v1',
  logLevel: 'error',
  features: {
    enableDevTools: false,
    enableMocking: false,
    enableAnalytics: true
  }
};
