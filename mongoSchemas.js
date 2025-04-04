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
    userID: {
      type: Schema.Types.UUID,
      ref: 'User',
      required: true,
    },
})

// Define quote schema
const quoteSchema = new mongoose.Schema({
  userID: {
    type: Schema.Types.UUID,
    ref: 'User',
    required: true,
  },
  quote: {
    type: String,
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
