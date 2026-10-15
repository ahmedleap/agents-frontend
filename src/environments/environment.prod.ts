// Production environment configuration

export const environment = {
  production: true,
  apiUrl: 'https://api.agentsofleap.com/api',
  wsUrl: 'wss://api.agentsofleap.com',
  logLevel: 'error',
  // Placeholder until login is wired up
  devClientId: '',
  features: {
    enableDevTools: false,
    enableMocking: false,
    enableAnalytics: true
  }
};
