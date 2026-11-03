const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase, getDatabaseInfo } = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const leaderRoutes = require('./src/routes/leaderRoutes');
const serviceRoutes = require('./src/routes/serviceRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const memberRoutes = require('./src/routes/memberRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const statRoutes = require('./src/routes/statRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== GLOBAL MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ==================== API ROUTES ====================
// Health check route
app.get('/api/health', (req, res) => {
    const dbInfo = getDatabaseInfo();
    res.json({
        success: true,
        status: 'online',
        service: 'Rotary Club of Honavar API',
        database: {
            type: dbInfo.type,
            host: dbInfo.host
        },
        timestamp: new Date().toISOString()
    });
});

// Authentication routes (login, register, me)
app.use('/api/auth', authRoutes);

// Event management & photo gallery routes
app.use('/api/events', eventRoutes);

// Community service projects routes
app.use('/api/projects', projectRoutes);

// Leadership team roster routes
app.use('/api/leaders', leaderRoutes);

// Civic service requests ("Report a Need" portal)
app.use('/api/service-requests', serviceRoutes);

// General contact inquiries
app.use('/api/contacts', contactRoutes);

// Membership applications & onboarding
app.use('/api/memberships', memberRoutes);

// Member tasks checklist & assignment
app.use('/api/tasks', taskRoutes);

// Administrative KPI metrics & dashboard statistics
app.use('/api/stats', statRoutes);

// ==================== ERROR HANDLING ====================
// 404 handler for undefined API routes
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// Global error handler middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error.'
    });
});

// ==================== SERVER INITIALIZATION ====================
async function startServer() {
    try {
        // Ensure database schema is initialized
        await initDatabase();

        const dbInfo = getDatabaseInfo();
        app.listen(PORT, () => {
            console.log(`\n==================================================`);
            console.log(` Rotary Club of Honavar Server Running!`);
            console.log(` Local URL:    http://localhost:${PORT}`);
            console.log(` Health Check: http://localhost:${PORT}/api/health`);
            console.log(` Database:     ${dbInfo.type} [${dbInfo.host}]`);
            console.log(`==================================================\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server if executed directly
if (require.main === module) {
    startServer();
}

module.exports = app;

