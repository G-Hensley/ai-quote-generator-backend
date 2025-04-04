const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for all origins
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello World!!!');
});

// Run the server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



