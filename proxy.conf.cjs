// Dev-server proxy (angular.json > serve > proxyConfig). Same backend as before; the difference is
// that /dashboard is only proxied for the app's data call, not when the browser opens the page.
const target = 'http://10.14.131.55:8081';

module.exports = [
  {
    // REST API
    context: ['/api'],
    target,
    secure: false,
    changeOrigin: true
  },
  {
    // GET /dashboard?clientId=...&period=30D is the backend's dashboard endpoint, but /dashboard is also
    // an app route. Opening or reloading the page asks for HTML; leave that to Angular.
    context: (pathname, req) => pathname === '/dashboard' && !(req.headers.accept || '').includes('text/html'),
    target,
    secure: false,
    changeOrigin: true
  }
];
