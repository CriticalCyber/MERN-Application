/**
 * Production-ready Express Server
 * ShubhValueCart Backend
 */

require('dotenv').config(); // ✅ ALWAYS FIRST

const path = require('path');
const http = require('http');
const express = require('express');
const compression = require('compression');

const app = require('./backend/app');
const connectDatabase = require('./backend/config/database');

// Utilities
const memoryManager = require('./backend/utils/memoryManager');
const seedNotificationTemplates = require('./backend/seed/notificationTemplates');

// Environment
const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';

/* ──────────────────────
   GLOBAL ERROR HANDLERS
────────────────────── */
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err.message);
    server.close(() => process.exit(1));
});

/* ──────────────────────
   EXPRESS MIDDLEWARE
────────────────────── */
app.use(compression());

// Request / response timeout safety
app.use((req, res, next) => {
    req.setTimeout(10 * 60 * 1000);
    res.setTimeout(10 * 60 * 1000);
    next();
});

/* ──────────────────────
   STATIC FRONTEND (PROD)
────────────────────── */
if (NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, 'frontend', 'build');
    app.use(express.static(buildPath));

    app.get('*', (req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('Server is Running! 🚀');
    });

    app.get('/health', (req, res) => {
        res.status(200).json({
            success: true,
            environment: NODE_ENV,
            timestamp: new Date().toISOString(),
        });
    });
}

/* ──────────────────────
   SERVER INITIALIZATION
────────────────────── */
const server = http.createServer(app);

// Production timeouts
server.setTimeout(10 * 60 * 1000);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

/* ──────────────────────
   BOOTSTRAP FUNCTION
────────────────────── */
async function startServer() {
    try {
        console.log('🚀 Starting application initialization...');
        console.log('🔌 Connecting to MongoDB Atlas...');

        await connectDatabase();
        console.log('✅ MongoDB connected');

        await seedNotificationTemplates();

        // Start memory monitoring
        memoryManager.startMonitoring();

        server.listen(PORT, HOST, () => {
            console.log(`✅ Server running on http://${HOST}:${PORT}`);
            console.log(`🌍 Environment: ${NODE_ENV}`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} already in use`);
            } else {
                console.error('❌ Server error:', err);
            }
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Startup failure:', error.message);
        process.exit(1);
    }
}

startServer();
