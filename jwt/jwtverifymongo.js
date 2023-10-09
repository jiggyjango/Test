const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { mongoconnect, getDatabase } = require('../connection/mongoconfig');

async function verifyTokenMongo(req, res, next) {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = getUserIdFromToken(token);
    if (!userId) {
      return res.status(403).json({ error: 'Token is not valid1' });
    }

    // Connect to MongoDB
    await mongoconnect();

    // Get a reference to the users collection
    const db = getDatabase();
    const collection = db.collection('userdetails');

    // Find the user by their _id
    const user = await collection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(403).json({ error: 'Token is not valid2' });
    }

    // Token exists in Redis and matches the provided token; decode and proceed
    const decoded = jwt.verify(token, 'your_secret_key'); // Replace 'your_secret_key' with your actual secret key
    req.user = { ...decoded};
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Token has expired; remove it from MongoDB (adjust your schema accordingly)
      removeExpiredTokenMongo(token)
        .then(() => {
          return res.status(401).json({ error: 'Token has expired. Please login again' });
        })
        .catch((dbError) => {
          console.error('Error removing expired token:', dbError);
          return res.status(500).json({ error: 'Internal server error' });
        });
    } else {
      // Other errors during token verification
      console.error('Token Verification Error:', error);
      return res.status(403).json({ error: 'Token is not valid3' });
    }
  }
}

// Helper function to get userId from a token
function getUserIdFromToken(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

async function removeExpiredTokenMongo(token) {
  try {
    // Connect to MongoDB
    await mongoconnect();

    // Get a reference to the tokens collection (adjust to your schema)
    const db = getDatabase();
    const collection = db.collection('token');

    const decod = jwt.decode(token);
    const deleteid = decod.userId;
    // Remove the token from the MongoDB collection
    await collection.deleteOne({ _id: new ObjectId(deleteid) });
  } catch (error) {
    console.error('Error removing expired token:', error);
    throw error;
  }
}

module.exports = verifyTokenMongo;