const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Added fallback secret to match the one used in authController
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;