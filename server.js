/**
 * Production-ready Express Server with MongoDB Atlas Connection
 * Handles environment configuration, database connection, and graceful shutdown
 */

require('dotenv').config({ path: '../.env' });

const express = require('express');
const http = require('http');
const connectDatabase = require('./config/database');

// Import utilities
const memoryManager = require('./utils/memoryManager');

// Centralized port configuration with fallback
const PORT = parseInt(process.env.PORT, 10) || 4001;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Set appropriate timeouts for production
server.setTimeout(10 * 60 * 1000); // 10 minutes
server.keepAliveTimeout = 65000; // Keep-alive timeout
server.headersTimeout = 66000; // Headers timeout

// Global error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error(`❌ Uncaught Exception: ${err.message}`);
    console.error(`Stack trace: ${err.stack}`);
    process.exit(1);
});

// Global promise rejection handler
process.on('unhandledRejection', (err) => {
    console.error(`❌ Unhandled Promise Rejection: ${err.message}`);
    
    // Close server gracefully
    server.close(() => {
        process.exit(1);
    });
    
    // Force exit if server doesn't close within 10 seconds
    setTimeout(() => {
        console.error('Server failed to close, forcing exit');
        process.exit(1);
    }, 10000);
});

// Initialize application components
async function initializeApp() {
    try {
        console.log('🚀 Starting application initialization...');
        
        // Start memory monitoring
        memoryManager.startMonitoring();
        
        // Connect to MongoDB Atlas
        console.log('🔌 Connecting to MongoDB Atlas...');
        const dbConnection = await connectDatabase();
        
        // Configure Express app
        configureApp(app);
        
        // Start HTTP server
        console.log(`📡 Starting server on ${HOST}:${PORT}...`);
        server.listen({ host: HOST, port: PORT }, () => {
            console.log(`✅ Server running on http://${HOST}:${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📊 Database: Connected to MongoDB Atlas`);
        });
        
        // Handle server errors
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use. Please free up the port and restart.`);
                process.exit(1);
            } else if (err.code === 'EACCES') {
                console.error(`❌ Permission denied to access port ${PORT}. Try a port > 1024 or run with elevated privileges.`);
                process.exit(1);
            } else {
                console.error('❌ Server error:', err);
                process.exit(1);
            }
        });
        
        // Handle graceful shutdown
        setupGracefulShutdown(server, dbConnection);
        
        return { app, server, dbConnection };
    } catch (error) {
        console.error('❌ Application initialization failed:', error.message);
        console.error('🔧 Please check your environment variables and MongoDB Atlas connection.');
        
        // Exit with error code
        process.exit(1);
    }
}

// Configure Express application middleware
function configureApp(app) {
    // Apply request/response timeouts
    app.use((req, res, next) => {
        req.setTimeout(10 * 60 * 1000); // 10 minutes
        res.setTimeout(10 * 60 * 1000); // 10 minutes
        next();
    });
    
    // Import and configure the main application routes
    const mainApp = require('./app');
    app.use(mainApp);
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        const healthcheck = {
            uptime: process.uptime(),
            message: 'OK',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version || '1.0.0'
        };
        
        try {
            res.status(200).json(healthcheck);
        } catch (error) {
            console.error('Health check error:', error);
            healthcheck.message = error;
            res.status(503).send();
        }
    });
    
    // 404 handler for undefined routes
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            message: `Route ${req.originalUrl} not found`
        });
    });
}

// Setup graceful shutdown procedures
function setupGracefulShutdown(server, dbConnection) {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
        process.on(signal, async () => {
            console.log(`\n${signal} signal received. Shutting down gracefully...`);
            
            try {
                // Close server
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) {
                            console.error('Error closing server:', err);
                            reject(err);
                        } else {
                            console.log('✅ HTTP server closed');
                            resolve();
                        }
                    });
                });
                
                // Close database connection
                if (dbConnection && typeof dbConnection.close === 'function') {
                    await dbConnection.close();
                    console.log('✅ MongoDB connection closed');
                }
                
                console.log('✅ Application shut down successfully');
                process.exit(0);
            } catch (error) {
                console.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        });
    });
}

// Start the application
initializeApp();

// Export for testing purposes
module.exports = { app, server };