import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';
import { User, Quote } from './mongoSchemas.js';

// Load environment variables
dotenv.config();

// Initialize OpenAI
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for all origins
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI;

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });

// Signup route handler
app.post('/signup', async (req, res) => {

  try {
    // Get the email and password from the request
    const { email, password } = req.body;
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create a new user
    const user = new User({ email, password: hashedPassword })
    // Check if the email is already in the database
    const existingUser = await User.findOne({ email });
    // Save the user to the database
    await user.save();
    // Return a success message
    res.status(201).json({ message: 'User created successfully', "userID": user._id });

    // Throw an error if the email is already in the database
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
})

// Login route handler
app.post('/login', async (req, res) => {

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // If the user does not exist, return an error
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // If the password is not valid, return an error
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    } else {
      // Generate a token for the user and return it along with the user's ID
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      // Return the token and the user's ID
      res.json({ "token": token, "userID": user._id });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
})

// Authenticate token middleware
const authenticateToken = (req, res, next) => {
  // Get the token from the request
  const token = req.headers['authorization'];
  // If the token is not provided, return an error
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    // Set the user ID in the request
    req.userId = user.userId;
    next();
  });
};

// Protected route handler
app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Access granted', userId: req.userId });
})

// Generate quote route handler
app.post('/generate-quote', authenticateToken, async (req, res) => {

  try {
    // Get the category from the request
    const { category } = req.body;

    // Generate a quote using the OpenAI API and the gpt-4o-mini model
    const response = await openaiClient.responses.create({
      model: 'gpt-4o-mini',
      instructions: 'Generate a quote based on the following category: ' + category,
      input: category,
      max_output_tokens: 100,
    })

    // Get the quote from the response
    const quote = response.output_text;
    // Return the quote
    res.json({ quote });
  } catch (error) {
    // If there is an error, return an error message
    res.status(500).json({ message: 'Error generating quote', error: error.message });
  }
})

// Save quote route handler
app.post('/save-quote', authenticateToken, async (req, res) => {
  try {
    // Get the quotes array from the request body
    const { quotes } = req.body;

    if (!Array.isArray(quotes)) {
      return res.status(400).json({ message: 'Quotes must be an array' });
    }

    const result = await Quote.updateOne(
      { userID: req.userID },
      { $set: { quotes, updatedAt: new Date() } },
      { upsert: true }
    )

    res.json({ message: 'Quotes saved successfully', quotes });
  } catch (error) {
    // If there is an error, return an error message
    res.status(500).json({ message: 'Error saving quotes', error: error.message });
  }
})

// Get quotes route handler
app.get('/get-quotes', authenticateToken, async (req, res) => {
  try {
    // Fetch the quote document for the user using req.userID
    const quoteDoc = await Quote.find({ userID: req.userID })

    // If no quote document is found, return an empty array
    if (!quoteDoc || quoteDoc.length === 0) {
      return res.json({ quotes: [] });
    }

    // Return the quotes
    res.json({ quotes: quoteDoc[0].quotes });
  } catch (error) {
    // If there is an error, return an error message
    res.status(500).json({ message: 'Error getting quotes', error: error.message });
  }
})

// Run the server on port 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
