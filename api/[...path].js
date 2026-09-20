// Vercel entry point. The rewrite keeps the original request path available to
// the dependency-free HTTP application, which also powers local development.
const { server } = require('../src/server');
module.exports = (req, res) => {
  req.url = (req.url || '/').replace(/^\/api(?=\/|$)/, '') || '/';
  server.emit('request', req, res);
};
