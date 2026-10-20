// Development environment configuration

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/api',
  wsUrl: 'ws://localhost:3000',
  logLevel: 'debug',
  // No login yet: John Trader from the shared dev database (port 15432)
  devClientId: '21c98e78-2a80-4a2a-8880-4e8803f202f4',
  features: {
    enableDevTools: true,
    enableMocking: false,
    enableAnalytics: false
  }
};
