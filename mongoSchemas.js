import mongoose from 'mongoose';

// Define user schema
const userSchema = new mongoose.Schema({
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
})

// Define quote schema
const quoteSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quotes: {
    type: [{
      category: {
        type: String,
        required: true,
      },
      text: {
        type: String,
        required: true,
      },
    }],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Create models
const User = mongoose.model('User', userSchema);
const Quote = mongoose.model('Quote', quoteSchema);

export { User, Quote };
