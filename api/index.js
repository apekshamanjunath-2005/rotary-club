/**
 * Vercel Serverless Function Entrypoint
 * Forwards all incoming API requests to the unified Express.js application
 */
const app = require('../server.js');

module.exports = (req, res) => {
    // Extract original request path across different Vercel proxy / rewrite conventions
    const originalPath = 
        req.headers['x-matched-path'] || 
        req.headers['x-forwarded-uri'] || 
        req.headers['x-original-url'] ||
        (req.url && req.url.startsWith('/api') && req.url !== '/api' ? req.url : null);

    if (originalPath && originalPath !== '/api' && originalPath !== '/api/index') {
        const queryIndex = req.url ? req.url.indexOf('?') : -1;
        const queryString = queryIndex !== -1 ? req.url.substring(queryIndex) : '';
        req.url = originalPath.includes('?') ? originalPath : (originalPath + queryString);
    } else if (req.url && !req.url.startsWith('/api')) {
        // Fallback if runtime stripped /api prefix (e.g. req.url = '/leaders')
        req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }

    return app(req, res);
};
