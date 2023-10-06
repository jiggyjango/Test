const Redis = require('ioredis');

const redis = new Redis({
    password: 'HF7bIVMbAPrW9i7Po7iZaYbmO8hxo8W0',
    host: 'redis-18273.c273.us-east-1-2.ec2.cloud.redislabs.com',
    port: 18273
  });

module.exports = redis;