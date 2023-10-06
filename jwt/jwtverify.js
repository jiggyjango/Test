const jwt = require('jsonwebtoken');
const redis = require('../connection/rdserver');
const UserToken = require('../models/usertoken');

async function verifyToken(req, res, next) {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = getUserIdFromToken(token);
    const user_id = userId;
    if (!userId) {
      return res.status(403).json({ error: 'Token is not valid1' });
    }

    // Try to retrieve the token from Redis based on userId
    const cachedToken = await redis.get(`userToken:${userId}`);

    if (cachedToken === token) {
      // Token exists in Redis and matches the provided token; decode and proceed
      const decoded = jwt.verify(token, 'your_secret_key'); // Replace 'your_secret_key' with your actual secret key
      req.user = { ...decoded, fromCache: true };
      return next();
    }

    // Token not found in Redis or does not match; check the database
    const [dbTokenData] = await UserToken.findOne({
      where: {
        user_id,
        token,
      },
    });

    if (!dbTokenData) {
      // Token not found in the database; return an error
      return res.status(403).json({ error: 'Token is not valid2' });
    }

    // Store the token in Redis with a TTL of 1 minute (adjust as needed)
    await redis.setex(`userToken:${userId}`, 300, token);

    // Continue with the verification since the token was found in the database
    const decoded = jwt.verify(token, 'your_secret_key'); // Replace 'your_secret_key' with your actual secret key
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Token has expired; remove it from the database and Redis
      removeExpiredToken(token)
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

async function removeExpiredToken(token) {
  try {
    // Remove the token from the database
    const deletedToken = await UserToken.destroy({
      where: {
        token,
      },
    });

    // If the token was successfully removed from the database, also remove it from Redis
    if (deletedToken) {
      await redis.del(token);
    }
  } catch (error) {
    console.error('Error removing expired token:', error);
    throw error;
  }
}

module.exports = verifyToken;
