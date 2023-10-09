const { MongoClient } = require('mongodb');

const uri = 'mongodb://127.0.0.1:27017/JioTraining'; // Replace with your MongoDB URI
const client = new MongoClient(uri);

async function mongoconnect() {
  try {
    await client.connect();
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

function getDatabase() {
  return client.db('JioTraining');
}

function closemongo(){
  return client.close();
}

module.exports = {
  mongoconnect,
  getDatabase,
  closemongo,
};