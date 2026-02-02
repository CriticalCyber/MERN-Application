/**
 * Memory Manager Utility
 * Provides functions to monitor and manage memory usage
 */

class MemoryManager {
    constructor() {
        this.maxHeapSize = 1024; // MB
        this.warningThreshold = 800; // MB
        this.criticalThreshold = 950; // MB
        this.monitoringInterval = null;
    }

    /**
     * Start memory monitoring
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(() => {
            const usage = this.getMemoryUsage();
            this.logMemoryUsage(usage);

            if (usage.heapUsed > this.criticalThreshold) {
                this.handleCriticalMemory(usage);
            } else if (usage.heapUsed > this.warningThreshold) {
                this.handleHighMemory(usage);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop memory monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Get current memory usage
     * @returns {Object} Memory usage statistics
     */
    getMemoryUsage() {
        const used = process.memoryUsage();
        return {
            rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
            heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(used.external / 1024 / 1024 * 100) / 100,
        };
    }

    /**
     * Log memory usage
     * @param {Object} usage - Memory usage statistics
     */
    logMemoryUsage(usage) {
        console.log(`Memory Usage: ${JSON.stringify(usage)} MB`);
    }

    /**
     * Handle high memory usage
     * @param {Object} usage - Memory usage statistics
     */
    handleHighMemory(usage) {
        console.warn(`Warning: High memory usage detected! Current: ${usage.heapUsed}MB`);
        // Trigger garbage collection if available
        if (global.gc) {
            console.log('Triggering garbage collection...');
            global.gc();
        }
    }

    /**
     * Handle critical memory usage
     * @param {Object} usage - Memory usage statistics
     */
    handleCriticalMemory(usage) {
        console.error(`CRITICAL: Memory usage is dangerously high! Current: ${usage.heapUsed}MB`);
        
        // Force garbage collection if available
        if (global.gc) {
            console.log('Forcing garbage collection...');
            global.gc();
        }

        // Log warning to administrators
        console.error('Consider restarting the server to prevent crashes.');
    }

    /**
     * Force garbage collection (if enabled with --expose-gc flag)
     */
    forceGarbageCollection() {
        if (global.gc) {
            global.gc();
            return true;
        }
        return false;
    }
}

// Export singleton instance
module.exports = new MemoryManager();