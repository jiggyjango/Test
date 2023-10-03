const express = require("express");
const app = express();
const mysql = require('mysql2/promise')
const bodyParser = require('body-parser');
app.use(bodyParser.json());
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const port = 3000;

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'jiotraining',
    waitForConnections: true,
    queueLimit: 0   // 0 means unlimited queing
});


app.listen(port,()=>{
    console.log(`Server is started on ${port}`)
});

//JWT Token
function verifyToken(req, res, next) {
    const token = req.header('Authorization');
  
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  
    try {
      const decoded = jwt.verify(token, 'your_secret_key'); // Replace 'your_secret_key' with your actual secret key
      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // Token has expired; remove it from the database
        removeExpiredTokenFromDatabase(token)
          .then(() => {
            return res.status(401).json({ error: 'Token has expired. Please login again' });
          })
          .catch((dbError) => {
            console.error('Error removing expired token from the database:', dbError);
            return res.status(500).json({ error: 'Internal server error' });
          });
      } else {
        return res.status(403).json({ error: 'Token is not valid' });
      }
    }
}

async function removeExpiredTokenFromDatabase(token) {
    try {
      // Execute a SQL DELETE statement to remove the row with the expired token
      const deleteQuery = 'DELETE FROM user_tokens WHERE token = ?';
      const [deletedRows] = await pool.query(deleteQuery, [token]);
  
      if (deletedRows.affectedRows === 0) {
        // If no rows were deleted, the token was not found in the database
        return 'Token not found';
      } else {
        return 'Token deleted';
      }
    } catch (error) {
      // Handle the error as needed (e.g., log it or throw it further)
      throw error;
    }
}

app.get('/getuserdetails', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM userdetails');
        res.json({ "User Details": rows });
      } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Error executing query' });
      }
});


app.post('/adduser', async (req, res) => {
    try {
      const { username, useremail, password } = req.body;

      const hashedPassword = await bcrypt.hash(password, 10); // 10 is the number of salt rounds

      const [existingUsers] = await pool.query(
        'SELECT COUNT(*) AS userCount FROM userdetails WHERE username = ? OR useremail = ?',
        [username, useremail]
      );
  
      if (existingUsers[0].userCount > 0) {
        return res.status(400).json({ error: 'Username or useremail already exists' });
      }

      
      const sql = 'INSERT INTO userdetails (username, useremail, password) VALUES (?, ?, ?)';
      await pool.query(sql, [username, useremail, hashedPassword]);
      res.json({ message: 'User added successfully' });
    } catch (error) {
      console.error('Error adding user:', error);
      res.status(500).json({ error: 'Error adding user' });
    }
});
  
 
app.put('/updateuser/:id',verifyToken, async (req, res) => {
    try {
      const { username, useremail, password } = req.body;
      const { id } = req.params;
  
      const [userData] = await pool.query('SELECT * FROM userdetails WHERE ID = ?', [id]);
  
      if (!userData || userData.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const currentHashedPassword = userData[0].password;
  
      // Compare the current hashed password with the new password
      const passwordMatch = await bcrypt.compare(password, currentHashedPassword);
  
      if (!passwordMatch) {
        
        const hashedPassword = await bcrypt.hash(password, 10); 
        const sql = 'UPDATE userdetails SET username = ?, password = ? WHERE ID = ?';
        await pool.query(sql, [username, hashedPassword, id]);
        res.json({ message: 'User details updated successfully with password change' });
      } else {
        const sql = 'UPDATE userdetails SET username = ?  WHERE ID = ?';
        await pool.query(sql, [username, id]);
        res.json({ message: 'User details updated successfully' });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Error updating user' });
    }
});
  

app.delete('/deleteuser/:id',verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      const sql = 'DELETE FROM userdetails WHERE ID = ?';
      await pool.query(sql, [id]);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Error deleting user' });
    }
});



app.post('/auth', async (req, res) => {
    try {
      const { username, password } = req.body;
  
      // Check if the user with the provided username exists
      const [userData] = await pool.query('SELECT * FROM userdetails WHERE username = ?', [username]);
  
      if (!userData || userData.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const user = userData[0];

    // Check if a token is already present for the user in the user_tokens table
    const [existingTokens] = await pool.query('SELECT * FROM user_tokens WHERE user_id = ?', [user.ID]);

    if (existingTokens && existingTokens.length > 0) {
      // User is already logged in
      return res.status(200).json({ message: 'User is already logged in' });
    }
  
      // Compare the provided password with the stored hashed password
      const passwordMatch = await bcrypt.compare(password, user.password);
  
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
  
      // Generate a JWT token
      const token = jwt.sign({ userId: user.ID, username: user.username }, 'your_secret_key', { expiresIn: '1m' }); // Replace 'your_secret_key' with your actual secret key
  
      // Store the token in the user_tokens table
      const insertTokenQuery = 'INSERT INTO user_tokens (user_id, token) VALUES (?, ?)';
      await pool.query(insertTokenQuery, [user.ID, token]);
  
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
  