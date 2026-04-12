const isProd = process.env.NODE_ENV === 'production';

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (...args) => {
    if (!isProd) console.log(`[${timestamp()}] INFO`, ...args);
  },
  warn: (...args) => {
    console.warn(`[${timestamp()}] WARN`, ...args);
  },
  error: (...args) => {
    console.error(`[${timestamp()}] ERROR`, ...args);
  }
};

module.exports = logger;
