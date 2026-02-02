const mongoose = require('mongoose');

// Set strictQuery option to suppress deprecation warning
mongoose.set('strictQuery', true);

const connectDatabase = async (retryCount = 0, maxRetries = 3) => {
    // Ensure MONGO_URI is defined
    const MONGO_URI = process.env.MONGO_URI;
    
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI is not defined in environment variables');
        process.exit(1);
    }
    
    console.log(`🔄 Attempting to connect to MongoDB (Attempt ${retryCount + 1}/${maxRetries + 1})...`);
    
    try {
        // Try SRV connection first (default)
        console.log('📡 Attempting SRV connection...');
        await mongoose.connect(MONGO_URI, {
            // Connection pool settings for optimal performance in production
            maxPoolSize: 5,          // Reduced pool size to prevent connection issues
            minPoolSize: 1,          // Minimum connections in the pool
            maxConnecting: 1,        // Maximum number of connections attempting to be established concurrently
            
            // Timeout settings for robust connection handling
            serverSelectionTimeoutMS: 5000,   // Reduced timeout for faster failure detection
            socketTimeoutMS: 45000,           // Socket timeout
            connectTimeoutMS: 10000,          // Connection timeout
            heartbeatFrequencyMS: 10000,      // The frequency with which topology updates are scheduled
            
            // Retry settings for resilience
            retryWrites: false,               // Disable retryable writes to prevent timeout issues
            retryReads: true,                 // Enable retryable reads
            
            // Connection behavior
            autoIndex: false,                 // Disable automatic index creation in production
            
            // Buffering settings - disable buffering to fail fast
            bufferCommands: false,            // Disable mongoose buffering
            
            // For MongoDB Atlas compatibility
            tls: true,                        // Always use TLS for Atlas connections
            tlsInsecure: false,               // Ensure secure TLS connection
            
            // Additional production settings
            w: 'majority',                    // Write concern - wait for majority of replicas
            journal: true,                    // Request acknowledgment that write operations are written to journal
            
            // DNS and network settings
            directConnection: false,          // Use SRV record resolution
            
            // DNS resolution specific settings
            srvMaxHosts: 0,                   // Allow all hosts from SRV record
            srvServiceName: 'mongodb'         // Specify service name for SRV lookup
        });
        
        console.log("✅ Mongoose Connected Successfully to MongoDB Atlas (SRV)");
        
        // Log connection events for monitoring
        const db = mongoose.connection;
        
        db.on('connected', () => {
            console.log('✅ MongoDB Atlas connection established successfully');
        });
        
        db.on('disconnected', () => {
            console.log('⚠️ MongoDB Atlas connection disconnected');
        });
        
        db.on('reconnected', () => {
            console.log('🔗 MongoDB Atlas reconnected successfully');
        });
        
        db.on('error', (err) => {
            console.error('❌ MongoDB Atlas connection error:', err);
            
            // In production, exit on critical database errors
            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            }
        });
        
        // Handle process termination for graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n shutting down gracefully');
            await mongoose.connection.close();
            console.log('🔴 MongoDB connection closed through app termination');
            process.exit(0);
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
            process.exit(1);
        });
        
        return mongoose.connection;
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        
        // If this is an SRV DNS timeout and we haven't tried direct connection yet
        if (err.message.includes('querySrv ETIMEOUT') && retryCount === 0) {
            console.log('🔄 SRV DNS resolution failed, attempting direct connection...');
            return await tryDirectConnection(MONGO_URI, maxRetries);
        }
        
        if (retryCount < maxRetries) {
            console.log(`⏳ Retrying in 5 seconds... (Attempt ${retryCount + 2}/${maxRetries + 1})`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectDatabase(retryCount + 1, maxRetries);
        }
        
        console.error('🔧 Troubleshooting tips:');
        console.error('   1. Verify your MongoDB Atlas connection string is correct');
        console.error('   2. Check IP whitelist settings in MongoDB Atlas dashboard');
        console.error('   3. Confirm database user has proper permissions');
        console.error('   4. Ensure MONGO_URI in .env follows the format: mongodb+srv://username:password@cluster.domain.mongodb.net/database');
        console.error('   5. Check network connectivity and firewall settings');
        console.error('   6. Try using a direct connection string instead of SRV');
        console.error('   7. Verify DNS resolution is working properly');
        
        // Exit process to prevent nodemon infinite restart loop
        process.exit(1);
    }
}

// Fallback method for direct connection when SRV fails
async function tryDirectConnection(MONGO_URI, maxRetries) {
    try {
        // Convert SRV URI to direct connection URI
        // Remove 'mongodb+srv://' and replace with 'mongodb://'
        // Extract hosts from SRV record manually
        const directUri = MONGO_URI.replace('mongodb+srv://', 'mongodb://')
                                   .replace('?retryWrites=true&w=majority', '');
        
        // Add direct hosts (you'll need to get these from MongoDB Atlas dashboard)
        // For now, we'll try a common pattern
        const clusterHost = 'shubhvaluecart-cluster-shard-00-00.wrn9tmm.mongodb.net:27017';
        const dbName = MONGO_URI.split('/').pop().split('?')[0];
        
        const directConnectionString = `mongodb://${clusterHost}/${dbName}?ssl=true&replicaSet=atlas-123abc-shard-0&authSource=admin&retryWrites=true&w=majority`;
        
        console.log('📡 Attempting direct connection...');
        
        await mongoose.connect(directConnectionString, {
            // Direct connection settings
            maxPoolSize: 3,
            minPoolSize: 1,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,
            retryWrites: false,
            retryReads: true,
            tls: true,
            tlsInsecure: false,
            directConnection: true
        });
        
        console.log('✅ Mongoose Connected Successfully to MongoDB Atlas (Direct)');
        return mongoose.connection;
        
    } catch (directErr) {
        console.error('❌ Direct connection also failed:', directErr.message);
        console.error('🔧 Please check your MongoDB Atlas cluster settings and network connectivity');
        process.exit(1);
    }
}

module.exports = connectDatabase;