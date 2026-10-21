// Development environment configuration

export const environment = {
  production: false,
<<<<<<< Updated upstream
  apiUrl: 'http://localhost:3000/api',
=======
  apiUrl: '/api',
  dashboardUrl: '/backend-dashboard/dashboard',
  middlewareUrl: '/middleware/api/v1',
>>>>>>> Stashed changes
  wsUrl: 'ws://localhost:3000',
  logLevel: 'debug',
  features: {
    enableDevTools: true,
    enableMocking: false,
    enableAnalytics: false
  }
};
