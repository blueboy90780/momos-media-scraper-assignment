const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Media = sequelize.define('Media', {
  sourceUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true  // Allow null for pending records
  },
  type: {
    type: DataTypes.ENUM('image', 'video'),
    allowNull: true  // Allow null for pending records
  },
  status: {
    type: DataTypes.ENUM('pending', 'processed', 'failed'),
    defaultValue: 'pending'
  }
});

module.exports = Media;