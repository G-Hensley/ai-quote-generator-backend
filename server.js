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
    // Allow requests from the frontend (change to the frontend URL when deployed)
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

    // Check if the email is already in the database
    const existingUser = await User.findOne({ email });
    // If the email is already in the database, return an error
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create a new user
    const user = new User({ email, password: hashedPassword });
    // Save the user to the database
    await user.save();

    // Generate a token for auto-login
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    // Return the token and user ID
    res.status(201).json({ token, userId: user._id });
  } catch (error) {
    // Handle duplicate email errors specifically (MongoDB error code 11000)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    res
      .status(500)
      .json({ message: 'Error creating user', error: error.message });
  }
});

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
    }

    // Generate a token for the user and return it along with the user's ID
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    res.json({ token: token, userId: user._id });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Authenticate token middleware
const authenticateToken = (req, res, next) => {
  // Get the token from the Authorization header (format: "Bearer <token>")
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Extract the token by removing the "Bearer" prefix
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token missing or malformed' });
  }

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.userId = user.userId;
    next();
  });
};

// Generate quote route handler
app.post('/ai/quote', authenticateToken, async (req, res) => {
  try {
    // Get the category from the request body (frontend sends { "category": "Motivation" })
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ message: 'Category is required' });
    }

    // Generate a quote using the OpenAI API
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Generate an inspirational quote about ${category}`,
        },
      ],
    });

    // Extract the quote from the response
    const quote = response.choices[0].message.content;
    res.json({ quote });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error generating quote', error: error.message });
  }
});

// Save quotes route handler
app.post('/quotes', authenticateToken, async (req, res) => {
  try {
    // Get the quotes array from the request body (frontend sends { "quotes": [{ "category": "Motivation", "text": "Believe in yourself!" }, ...] })
    const { quotes, userID } = req.body;
    if (!Array.isArray(quotes)) {
      return res.status(400).json({ message: 'Quotes must be an array' });
    }

    // Update the user's quotes in a single document
    const result = await Quote.updateOne(
      { userID },
      {
        $push: {
          quotes: {
            $each: quotes,
          },
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );

    res.json({ message: 'Quotes saved successfully', quotes });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error saving quotes', error: error.message });
  }
});

// Get quotes route handler
app.get('/quotes', authenticateToken, async (req, res) => {
  try {
    // Fetch the quote document for the user using req.userId from the middleware
    const quoteDoc = await Quote.find({ userID: req.userId });

    // If no document exists, return an empty array
    if (!quoteDoc || quoteDoc.length === 0) {
      return res.json({ quotes: [] });
    }

    // Return the quotes array from the document
    res.json({ quotes: quoteDoc[0].quotes });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error getting quotes', error: error.message });
  }
});

// Delete quote route handler
app.delete('/quotes', authenticateToken, async (req, res) => {
  try {
    // Get the userID and quoteToDelete from the request body
    const { userID, quoteToDelete } = req.body;

    // Update the user's quotes in a single document
    const result = await Quote.updateOne(
      { userID },
      {
        $pull: {
          quotes: {
            category: quoteToDelete.category,
            text: quoteToDelete.text,
          },
        },
        $set: { updatedAt: new Date() },
      }
    );

    // If the quote is not found, return an error
    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Return a success message
    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error deleting quote', error: error.message });
  }
});

// Run the server on port 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
