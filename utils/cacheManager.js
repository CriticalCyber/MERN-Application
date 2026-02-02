// Cache Manager Utility for centralized cache invalidation
let redis;
let promisify;

try {
    redis = require('redis');
    promisify = require('util').promisify;
} catch (error) {
    console.warn('Redis module not found. Cache functionality will be disabled.');
    redis = null;
    promisify = null;
}

// Initialize Redis client if REDIS_URL is provided and redis module is available
let redisClient;
let isConnected = false;

if (redis && process.env.REDIS_URL) {
    redisClient = redis.createClient({
        url: process.env.REDIS_URL
    });
    
    redisClient.on('connect', () => {
        console.log('Connected to Redis');
        isConnected = true;
    });
    
    redisClient.on('error', (err) => {
        console.error('Redis error:', err);
        isConnected = false;
    });
    
    // Connect to Redis
    redisClient.connect().catch(console.error);
}

// Promisify Redis methods if redisClient exists
const delAsync = redisClient && promisify ? promisify(redisClient.del).bind(redisClient) : null;
const keysAsync = redisClient && promisify ? promisify(redisClient.keys).bind(redisClient) : null;

/**
 * Invalidate cache for a specific entity type
 * @param {String} entityType - Type of entity (products, categories, orders, etc.)
 * @param {String|Array} entityId - Specific entity ID(s) to invalidate (optional)
 */
const invalidateCache = async (entityType, entityId = null) => {
    try {
        // If Redis is not configured, just log the invalidation
        if (!redisClient || !isConnected) {
            console.log(`Cache invalidation requested for ${entityType}${entityId ? `:${entityId}` : ''}`);
            return;
        }
        
        // Pattern for cache keys to delete
        let pattern;
        
        if (entityId) {
            // Invalidate specific entity
            if (Array.isArray(entityId)) {
                // Multiple entity IDs
                const promises = entityId.map(id => 
                    delAsync(`${entityType}:${id}`)
                );
                await Promise.all(promises);
                console.log(`Invalidated cache for ${entityType} with IDs: ${entityId.join(', ')}`);
            } else {
                // Single entity ID
                await delAsync(`${entityType}:${entityId}`);
                console.log(`Invalidated cache for ${entityType}:${entityId}`);
            }
        } else {
            // Invalidate all entities of this type
            pattern = `${entityType}:*`;
            const keys = await keysAsync(pattern);
            if (keys.length > 0) {
                await delAsync(...keys);
                console.log(`Invalidated all cache for ${entityType} (${keys.length} keys)`);
            }
        }
    } catch (error) {
        console.error(`Error invalidating cache for ${entityType}:`, error);
    }
};

/**
 * Invalidate multiple entity types at once
 * @param {Array} entityTypes - Array of entity types to invalidate
 */
const invalidateMultipleCache = async (entityTypes) => {
    try {
        const promises = entityTypes.map(type => invalidateCache(type));
        await Promise.all(promises);
        console.log(`Invalidated cache for entity types: ${entityTypes.join(', ')}`);
    } catch (error) {
        console.error('Error invalidating multiple cache types:', error);
    }
};

/**
 * Set cache with expiration
 * @param {String} key - Cache key
 * @param {any} value - Value to cache
 * @param {Number} ttl - Time to live in seconds (default: 1 hour)
 */
const setCache = async (key, value, ttl = 3600) => {
    try {
        if (!redisClient || !isConnected) {
            return;
        }
        
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        // Check if setEx method exists before calling it
        if (redisClient.setEx && typeof redisClient.setEx === 'function') {
            await redisClient.setEx(key, ttl, stringValue);
        }
    } catch (error) {
        console.error(`Error setting cache for ${key}:`, error);
    }
};

/**
 * Get cached value
 * @param {String} key - Cache key
 * @returns {any|null} Cached value or null if not found/expired
 */
const getCache = async (key) => {
    try {
        if (!redisClient || !isConnected) {
            return null;
        }
        
        const value = await redisClient.get(key);
        if (value) {
            try {
                return JSON.parse(value);
            } catch {
                return value; // Return as string if not JSON
            }
        }
        return null;
    } catch (error) {
        console.error(`Error getting cache for ${key}:`, error);
        return null;
    }
};

module.exports = {
    invalidateCache,
    invalidateMultipleCache,
    setCache,
    getCache
};