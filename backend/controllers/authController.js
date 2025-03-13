const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('Login attempt:', { username, hasPassword: !!password });

    if (!username || !password) {
      console.log('Login failed: Missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ where: { username } });
    
    if (!user) {
      console.log(`Login failed: User not found - ${username}`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    console.log('Found user:', { username: user.username });

    // Verify password directly with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password verification result:', isValidPassword);

    if (!isValidPassword) {
      console.log(`Login failed: Invalid password for user - ${username}`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username
      },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '24h' }
    );

    console.log(`Login successful for user: ${username}`);
    res.json({ token, username: user.username });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login' });
  }
};

// Initialize admin account
exports.initializeAdmin = async () => {
  try {
    console.log('Starting admin account initialization...');
    
    // Force sync the User table to ensure it exists
    await User.sync({ force: true });
    console.log('User table recreated');
    
    // Delete any existing admin user to ensure clean state
    await User.destroy({ where: { username: 'admin' } });
    console.log('Removed existing admin user if any');
    
    // Create new admin user with direct password hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin', salt);
    
    const adminUser = await User.create({
      username: 'admin',
      password: hashedPassword
    }, {
      hooks: false // Bypass hooks to prevent double hashing
    });
    
    console.log('Admin account created with hashed password');
    
    // Verify the password works
    const verifyPassword = await bcrypt.compare('admin', adminUser.password);
    console.log('Password verification check:', verifyPassword);
    
    if (!verifyPassword) {
      throw new Error('Admin user created but password verification failed');
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing admin account:', error);
    throw error;
  }
};

// Utility function to verify JWT token
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};