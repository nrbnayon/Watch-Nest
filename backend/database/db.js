require("dotenv").config();
const mongoose = require("mongoose");

exports.connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🌟🎉 Connected to the database successfully! 🚀🌍");
  } catch (error) {
    console.error(
      "💥😓 Oops! Something went wrong connecting to the database:",
      error.message
    );
  }
};
