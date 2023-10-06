const Sequelize = require('sequelize');
const redis = require('./connection/rdserver');
const sequelize = require('./connection/sqlconfig');
const express = require("express");
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const port = 3000;
const UserDetail = require('./models/userdetails');
const UserToken = require('./models/usertoken');
const verifyToken = require('./jwt/jwtverify');

//server start
app.listen(port,()=>{
    console.log(`Server is started on ${port}`)
});


// Route to clear the Redis cache
app.get('/clearcache', async (req, res) => {
  try {
    await redis.del('userDetails');
    res.json({ message: 'Redis cache cleared' });
  } catch (error) {
    console.error('Error clearing Redis cache:', error);
    res.status(500).json({ error: 'Error clearing Redis cache' });
  }
});

//getuserdetails 

app.use('/getuserdetails', async (req, res, next) => {
    try {
      const cachedUsers = await redis.get('userDetails');
      if (cachedUsers) {
        // If user details are cached, return them from Redis
        const users = JSON.parse(cachedUsers);
        res.json({ "User Details (Cached)": users });
      } else {
        // If user details are not cached, fetch them using Sequelize
        const users = await UserDetail.findAll();
        // Store user details in Redis with a TTL (time to live) of 1 hour
        redis.setex('userDetails', 3600, JSON.stringify(users));
        res.json({ "User Details": users });
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ error: 'Error fetching user details' });
    }
});


//add user
app.post('/adduser', async (req, res) => {
  try {
    const { username, useremail, password } = req.body;

    // Check if the username or useremail already exists
    const existingUser = await UserDetail.findOne({
      where: {
        [Sequelize.Op.or]: [{ username }, { useremail }],
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or useremail already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user record
    await UserDetail.create({
      username,
      useremail,
      password: hashedPassword,
    });

    res.json({ message: 'User added successfully' });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Error adding user' });
  }
});


// Update user details with password change support
app.put('/updateuser/:id', async (req, res) => {
    try {
      const { username, password } = req.body;
      const { id } = req.params;
  
      // Find the user by ID
      const user = await UserDetail.findByPk(id);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Compare the current hashed password with the new password
      const passwordMatch = await bcrypt.compare(password, user.password);
  
      if (!passwordMatch) {
        // Hash the new password if it's different
        const hashedPassword = await bcrypt.hash(password, 10);
        // Update username and password
        await user.update({ username, password: hashedPassword });
        res.json({ message: 'User details updated successfully with password change' });
      } else {
        // Update only the username, since the password remains the same
        await user.update({ username });
        res.json({ message: 'User details updated successfully' });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Error updating user' });
    }
  });

  // Delete a user by ID
app.delete('/deleteuser/:id', async (req, res) => {
    try {
      const { id } = req.params;
  
      // Find the user by ID
      const user = await UserDetail.findByPk(id);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Delete the user
      await user.destroy();
  
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Error deleting user' });
    }
});
  

app.post('/auth', async (req, res) => {
  try {
    const { username, password } = req.body;

     // Check if the user is already logged in by checking the Redis cache
     const cachedToken = await redis.get(`userToken:${username}`);
     if (cachedToken) {
       return res.status(200).json({ message: 'User is already logged in!' });
     }

    // Find the user by username
    const user = await UserDetail.findOne({
      where: {
        username,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Compare the provided password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    
    // Check if there is an existing token in the database
    const existingToken = await UserToken.findOne({
      where: {
        user_id: user.id,
      },
    });

    if (existingToken) {
      // If a token already exists in the database, return an appropriate message
      return res.status(200).json({ message: 'User is already logged in!' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user.id, username: user.username }, 'your_secret_key', { expiresIn: '5m' }); 

    // Store the token in Redis
    redis.setex(`userToken:${user.id}`, 300, token); // Store the token with a TTL of 1 minute (adjust as needed)
     
    // Store the token in the SQL database
    await UserToken.create({
      user_id: user.id,
      token: token,
    });

    res.json({ message: 'User Logged in Successfully!', token });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
});



app.get('/protected-route', verifyToken, (req, res) => {
    // The user is authenticated; you can access req.user to get user information
    res.json({ message: 'This is a protected route', user: req.user });
});