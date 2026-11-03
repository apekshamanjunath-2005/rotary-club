/**
 * Vercel Serverless Function Entrypoint
 * Forwards all incoming API requests to the unified Express.js application
 */
const app = require('../server.js');

module.exports = app;
