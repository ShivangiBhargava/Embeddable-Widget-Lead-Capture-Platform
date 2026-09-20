// Vercel entry point. The rewrite keeps the original request path available to
// the dependency-free HTTP application, which also powers local development.
const { handler } = require('../src/server');
module.exports = (req, res) => {
  req.url = (req.url || '/').replace(/^\/api(?=\/|$)/, '') || '/';
  return handler(req, res);
};
