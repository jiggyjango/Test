const Sequelize = require('sequelize');

config = {
    development: {
      username: 'root',
      password: 'password',
      database: 'JioTraining',
      host: 'localhost', // MySQL host
      dialect: 'mysql', // Database dialect
    },
    production: {
      // Add production database configuration if needed
    },
  };


  const sequelize = new Sequelize(
    config.development.database,
    config.development.username,
    config.development.password,
    {
      host: config.development.host,
      dialect: config.development.dialect,
    }
  );

  module.exports = sequelize;