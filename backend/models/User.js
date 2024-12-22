const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    default: null,
    index: {
      unique: true,
      sparse: true,
    },
  },
  password: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
});

// Drop existing index if it exists when the model is compiled
userSchema.pre("save", async function (next) {
  try {
    await this.collection.dropIndexes("username_1");
  } catch (error) {
    // Index might not exist, continue
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
