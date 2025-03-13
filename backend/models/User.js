const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  password: {
    type: DataTypes.STRING(60), // bcrypt always generates 60 character hashes
    allowNull: false,
    validate: {
      notEmpty: true
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeSave: async (user) => {
      // Only hash the password if it's new or modified
      if (user.changed('password')) {
        try {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
          console.log('Password hashed successfully');
        } catch (error) {
          console.error('Error hashing password:', error);
          throw error;
        }
      }
    }
  }
});

// Add instance method to verify password
User.prototype.verifyPassword = async function(password) {
  try {
    const isValid = await bcrypt.compare(password, this.password);
    console.log('Password verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
};

module.exports = User;