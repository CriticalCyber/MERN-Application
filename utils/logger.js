const log = (msg, level = 'info') => {
  if (process.env.NODE_ENV === "development") {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${msg}`);
  }
};

const logger = {
  info: (msg) => log(msg, 'info'),
  warn: (msg) => log(msg, 'warn'),
  error: (msg) => log(msg, 'error'),
  debug: (msg) => log(msg, 'debug'),
};

module.exports = logger;