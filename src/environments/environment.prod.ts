// Production environment configuration

export const environment = {
  production: true,
  apiUrl: 'https://api.agentsofleap.com/api',
  authUrl: 'https://api.agentsofleap.com/api/v1',
  wsUrl: 'wss://api.agentsofleap.com',
  logLevel: 'error',
  features: {
    enableDevTools: false,
    enableMocking: false,
    enableAnalytics: true
  }
};
