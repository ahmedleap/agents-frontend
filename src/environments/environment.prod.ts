// Production environment configuration

export const environment = {
  production: true,
  apiUrl: 'https://api.agentsofleap.com/api',
  wsUrl: 'wss://api.agentsofleap.com',
  logLevel: 'error',
  features: {
    enableDevTools: false,
    enableMocking: false,
    enableAnalytics: true
  }
};
