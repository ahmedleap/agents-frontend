// Dev-server proxy (angular.json > serve > proxyConfig). Every backend endpoint is under /api,
// so app routes like /dashboard are always left to Angular.
const target = 'http://10.14.131.55:8081';

module.exports = [
  {
    // REST API
    context: ['/api'],
    target,
    secure: false,
    changeOrigin: true
  }
];
