const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  
  res.status(500).json({ error: 'Internal Server Error' });
};

module.exports = errorHandler;