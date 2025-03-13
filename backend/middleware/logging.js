const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Create a write stream for access logs
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, '../logs/access.log'),
  { flags: 'a' }
);

// Create custom logging format
const logFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

const logger = morgan(logFormat, { stream: accessLogStream });

module.exports = logger;