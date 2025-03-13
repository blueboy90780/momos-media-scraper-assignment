require('dotenv').config();
const Sequelize = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  logging: true, // Enable logging to debug database queries
  retry: {
    max: 10,
    match: [
      /Deadlock/i,
      /Connection lost/i,
      /ETIMEDOUT/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ]
  },
  dialectOptions: {
    connectTimeout: 60000,
    // Enable better error handling for connection issues
    multipleStatements: true,
    // Increase timeout for long-running queries
    timeout: 60000,
  }
});

// Add connection management with better error reporting
const connectWithRetry = async () => {
  let retries = 5;
  while (retries) {
    try {
      await sequelize.authenticate();
      console.log('Database connection has been established successfully.');
      
      // Verify tables exist and are accessible
      const [results] = await sequelize.query('SHOW TABLES');
      console.log('Available tables:', results);
      
      // Verify Users table specifically
      try {
        await sequelize.query('SELECT * FROM Users LIMIT 1');
        console.log('Users table exists and is accessible');
      } catch (err) {
        console.log('Users table not found or not accessible, attempting to sync database...');
        await sequelize.sync({ force: true }); // This will recreate the tables
        console.log('Database sync completed');
      }
      
      return true;
    } catch (err) {
      retries -= 1;
      console.error('Database connection error:', {
        message: err.message,
        code: err.original?.code,
        errno: err.original?.errno,
        sqlState: err.original?.sqlState,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER
      });
      
      if (retries) {
        const delay = (5 - retries) * 2000;
        console.log(`Retrying connection in ${delay}ms. Retries left: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error('Unable to connect to the database after multiple retries');
};

// Add a health check function
const checkDatabaseHealth = async () => {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query('SHOW TABLES');
    return {
      healthy: true,
      tables: results
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      healthy: false,
      error: error.message
    };
  }
};

module.exports = { 
  sequelize, 
  connectWithRetry,
  checkDatabaseHealth 
};