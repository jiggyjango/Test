const  DataTypes  = require('sequelize');
const sequelize = require('../connection/sqlconfig'); // Adjust the path as needed

const UserDetail = sequelize.define('userdetails', {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    useremail: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      }
    // Add more fields as needed
  });

module.exports = UserDetail;
