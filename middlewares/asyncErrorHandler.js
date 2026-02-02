module.exports = errorFunction => (req, res, next) => {
    // Create a promise that rejects after a timeout
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Request timeout'));
        }, 30000); // 30 seconds timeout
    });
    
    // Race the original function against the timeout
    Promise.race([
        Promise.resolve(errorFunction(req, res, next)),
        timeoutPromise
    ]).catch(err => {
        // Log the error for debugging
        console.error('Async error caught:', err);
        // Pass the error to the error handling middleware
        next(err);
    });
}