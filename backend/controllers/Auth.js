const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { sendMail } = require("../utils/Emails");
const Otp = require("../models/OTP");
const { sanitizeUser } = require("../utils/SanitizeUser");
const { generateToken } = require("../utils/GenerateToken");
const PasswordResetToken = require("../models/PasswordResetToken");
const rateLimit = require("express-rate-limit");

// Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message:
    "🚫 Whoa there! Too many login attempts with same ip. Take a coffee break ☕ and try again in 15 minutes!",
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.signup = async (req, res) => {
  try {
    // console.log("user:", JSON.stringify(req.body, null, 2)); // Fixed console.log

    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          "🤔 Looks like you're already one of us! Try logging in instead!",
      });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Create user object with required fields
    const userData = {
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      username: req.body.username || null,
    };

    const newUser = new User(userData);
    const createdUser = await newUser.save();

    // Rest of your existing code for OTP generation and email sending
    const otp = generateOTP();
    const newOtp = new Otp({
      user: createdUser._id,
      otp: otp,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    await newOtp.save();

    await sendMail(
      createdUser.email,
      "Account Verification",
      `Your verification code is: ${otp}`
    );

    const token = generateToken(sanitizeUser(createdUser));

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.PRODUCTION === "true",
      sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
      maxAge: new Date(
        Date.now() +
          parseInt(process.env.COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
      ),
    });

    res.status(201).json({
      success: true,
      user: sanitizeUser(createdUser),
      message: "Signup successful! Please verify your email.",
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({
      success: false,
      message: "Error during signup",
    });
  }
};

exports.login = [
  authLimiter,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const token = generateToken(sanitizeUser(user));

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.PRODUCTION === "true",
        sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
        maxAge: new Date(
          Date.now() +
            parseInt(process.env.COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
        ),
      });

      res.status(200).json({
        success: true,
        user: sanitizeUser(user),
        message: "Login successful",
      });
    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({
        success: false,
        message: "Error during login",
      });
    }
  },
];

exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const otpRecord = await Otp.findOne({
      user: userId,
      otp: otp,
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.findByIdAndDelete(otpRecord._id);
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    await Otp.findByIdAndDelete(otpRecord._id);

    const user = await User.findByIdAndUpdate(
      userId,
      { isVerified: true },
      { new: true }
    );

    res.status(200).json({
      success: true,
      user: sanitizeUser(user),
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({
      success: false,
      message: "Error during verification",
    });
  }
};

exports.resendOtp = [
  authLimiter,
  async (req, res) => {
    // console.log("user:", JSON.stringify(req.body, null, 2));
    try {
      const user = await User.findById(req.body?.user);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await Otp.deleteMany({ user: user._id });

      const otp = generateOTP();
      const newOtp = new Otp({
        user: user._id,
        otp: otp,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      await newOtp.save();

      await sendMail(
        user.email,
        "New Verification Code",
        `Your new verification code is: ${otp}`
      );

      res.status(200).json({
        success: true,
        message: "New OTP sent successfully",
      });
    } catch (error) {
      console.error("Resend OTP Error:", error);
      res.status(500).json({
        success: false,
        message: "Error sending new OTP",
      });
    }
  },
];

exports.forgotPassword = async (req, res) => {
  let newToken;
  try {
    const isExistingUser = await User.findOne({ email: req.body.email });

    if (!isExistingUser) {
      return res.status(404).json({
        message: "Provided email does not exists",
      });
    }

    await PasswordResetToken.deleteMany({ user: isExistingUser._id });

    const passwordResetToken = generateToken(
      sanitizeUser(isExistingUser),
      true
    );

    const hashedToken = await bcrypt.hash(passwordResetToken, 10);

    newToken = new PasswordResetToken({
      user: isExistingUser._id,
      token: hashedToken,
      expiresAt: Date.now() + parseInt(process.env.OTP_EXPIRATION_TIME),
    });
    await newToken.save();

    await sendMail(
      isExistingUser.email,
      "Password Reset Link for Your Account",
      `<p>Dear ${isExistingUser.name},

      We received a request to reset the password for your account. If you initiated this request, please use the following link to reset your password:</p>

      <p><a href=${process.env.ORIGIN}/reset-password/${isExistingUser._id}/${passwordResetToken} target="_blank">Reset Password</a></p>

      <p>This link is valid for a limited time. If you did not request a password reset, please ignore this email.</p>

      <p>Thank you,<br/>The Team</p>`
    );

    res.status(200).json({
      message: `Password Reset link sent to ${isExistingUser.email}`,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      message: "Error occurred while sending password reset mail",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const isExistingUser = await User.findById(req.body.userId);

    if (!isExistingUser) {
      return res.status(404).json({
        message: "User does not exists",
      });
    }

    const isResetTokenExisting = await PasswordResetToken.findOne({
      user: isExistingUser._id,
    });

    if (!isResetTokenExisting) {
      return res.status(404).json({
        message: "Reset Link is Not Valid",
      });
    }

    if (isResetTokenExisting.expiresAt < new Date()) {
      await PasswordResetToken.findByIdAndDelete(isResetTokenExisting._id);
      return res.status(404).json({
        message: "Reset Link has been expired",
      });
    }

    if (
      isResetTokenExisting &&
      isResetTokenExisting.expiresAt > new Date() &&
      (await bcrypt.compare(req.body.token, isResetTokenExisting.token))
    ) {
      await PasswordResetToken.findByIdAndDelete(isResetTokenExisting._id);

      await User.findByIdAndUpdate(isExistingUser._id, {
        password: await bcrypt.hash(req.body.password, 10),
      });

      return res.status(200).json({
        message: "Password Updated Successfully",
      });
    }

    return res.status(404).json({
      message: "Reset Link has been expired",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      message:
        "Error occurred while resetting the password, please try again later",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    res.cookie("token", "", {
      maxAge: 0,
      sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
      httpOnly: true,
      secure: process.env.PRODUCTION === "true",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({
      success: false,
      message: "Error occurred during logout",
    });
  }
};
exports.checkAuth = async (req, res) => {
  try {
    if (req.user) {
      //   console.log(req.user);
      const user = await User.findById(req.user._id);

      return res.status(200).json(sanitizeUser(user));
    }
    res.sendStatus(401);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
};

// exports.checkAuth = async (req, res) => {
//   try {
//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         message: "Not authenticated",
//       });
//     }

//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       user: sanitizeUser(user),
//     });
//   } catch (error) {
//     console.error("Auth Check Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error checking authentication",
//     });
//   }
// };

// // last correct code below

// // const User = require("../models/User");
// // const bcrypt = require("bcryptjs");
// // const { sendMail } = require("../utils/Emails");
// // const { generateOTP } = require("../utils/GenerateOtp");
// // const Otp = require("../models/OTP");
// // const { sanitizeUser } = require("../utils/SanitizeUser");
// // const { generateToken } = require("../utils/GenerateToken");
// // const PasswordResetToken = require("../models/PasswordResetToken");

// // exports.signup = async (req, res) => {
// //   console.log("Sign up data", req.body);
// //   try {
// //     const existingUser = await User.findOne({ email: req.body.email });

// //     // if user already exists
// //     if (existingUser) {
// //       return res.status(400).json({ message: "User already exists" });
// //     }

// //     // hashing the password
// //     const hashedPassword = await bcrypt.hash(req.body.password, 10);
// //     req.body.password = hashedPassword;

// //     // creating new user
// //     const createdUser = new User(req.body);
// //     await createdUser.save();

// //     // getting secure user info
// //     const secureInfo = sanitizeUser(createdUser);

// //     // generating jwt token
// //     const token = generateToken(secureInfo);

// //     // sending jwt token in the response cookies
// //     res.cookie("token", token, {
// //       sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
// //       maxAge: new Date(
// //         Date.now() +
// //           parseInt(process.env.COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
// //       ),
// //       httpOnly: true,
// //       secure: process.env.PRODUCTION === "true" ? true : false,
// //     });

// //     res.status(201).json(sanitizeUser(createdUser));
// //   } catch (error) {
// //     console.log(error);
// //     res
// //       .status(500)
// //       .json({ message: "Error occured during signup, please try again later" });
// //   }
// // };

// // exports.login = async (req, res) => {
// //   try {
// //     // checking if user exists or not
// //     const existingUser = await User.findOne({ email: req.body.email });

// //     // if exists and password matches the hash
// //     if (
// //       existingUser &&
// //       (await bcrypt.compare(req.body.password, existingUser.password))
// //     ) {
// //       // getting secure user info
// //       const secureInfo = sanitizeUser(existingUser);

// //       // generating jwt token
// //       const token = generateToken(secureInfo);

// //       // sending jwt token in the response cookies
// //       res.cookie("token", token, {
// //         sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
// //         maxAge: new Date(
// //           Date.now() +
// //             parseInt(process.env.COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
// //         ),
// //         httpOnly: true,
// //         secure: process.env.PRODUCTION === "true" ? true : false,
// //       });
// //       return res.status(200).json(sanitizeUser(existingUser));
// //     }

// //     res.clearCookie("token");
// //     return res.status(404).json({ message: "Invalid Credentails" });
// //   } catch (error) {
// //     console.log(error);
// //     res
// //       .status(500)
// //       .json({
// //         message: "Some error occured while logging in, please try again later",
// //       });
// //   }
// // };

// // exports.verifyOtp = async (req, res) => {
// //   try {
// //     // checks if user id is existing in the user collection
// //     const isValidUserId = await User.findById(req.body.userId);

// //     // if user id does not exists then returns a 404 response
// //     if (!isValidUserId) {
// //       return res
// //         .status(404)
// //         .json({
// //           message: "User not Found, for which the otp has been generated",
// //         });
// //     }

// //     // checks if otp exists by that user id
// //     const isOtpExisting = await Otp.findOne({ user: isValidUserId._id });

// //     // if otp does not exists then returns a 404 response
// //     if (!isOtpExisting) {
// //       return res.status(404).json({ message: "Otp not found" });
// //     }

// //     // checks if the otp is expired, if yes then deletes the otp and returns response accordinly
// //     if (isOtpExisting.expiresAt < new Date()) {
// //       await Otp.findByIdAndDelete(isOtpExisting._id);
// //       return res.status(400).json({ message: "Otp has been expired" });
// //     }

// //     // checks if otp is there and matches the hash value then updates the user verified status to true and returns the updated user
// //     if (
// //       isOtpExisting &&
// //       (await bcrypt.compare(req.body.otp, isOtpExisting.otp))
// //     ) {
// //       await Otp.findByIdAndDelete(isOtpExisting._id);
// //       const verifiedUser = await User.findByIdAndUpdate(
// //         isValidUserId._id,
// //         { isVerified: true },
// //         { new: true }
// //       );
// //       return res.status(200).json(sanitizeUser(verifiedUser));
// //     }

// //     // in default case if none of the conidtion matches, then return this response
// //     return res.status(400).json({ message: "Otp is invalid or expired" });
// //   } catch (error) {
// //     console.log(error);
// //     res.status(500).json({ message: "Some Error occured" });
// //   }
// // };

// // exports.resendOtp = async (req, res) => {
// //   try {
// //     const existingUser = await User.findById(req.body.user);

// //     if (!existingUser) {
// //       return res.status(404).json({ message: "User not found" });
// //     }

// //     await Otp.deleteMany({ user: existingUser._id });

// //     const otp = generateOTP();
// //     const hashedOtp = await bcrypt.hash(otp, 10);

// //     const newOtp = new Otp({
// //       user: req.body.user,
// //       otp: hashedOtp,
// //       expiresAt: Date.now() + parseInt(process.env.OTP_EXPIRATION_TIME),
// //     });
// //     await newOtp.save();

// //     await sendMail(
// //       existingUser.email,
// //       `OTP Verification for Your MERN-AUTH-REDUX-TOOLKIT Account`,
// //       `Your One-Time Password (OTP) for account verification is: <b>${otp}</b>.</br>Do not share this OTP with anyone for security reasons`
// //     );

// //     res.status(201).json({ message: "OTP sent" });
// //   } catch (error) {
// //     res
// //       .status(500)
// //       .json({
// //         message:
// //           "Some error occured while resending otp, please try again later",
// //       });
// //     console.log(error);
// //   }
// // };

// // exports.forgotPassword = async (req, res) => {
// //   let newToken;
// //   try {
// //     // checks if user provided email exists or not
// //     const isExistingUser = await User.findOne({ email: req.body.email });

// //     // if email does not exists returns a 404 response
// //     if (!isExistingUser) {
// //       return res
// //         .status(404)
// //         .json({ message: "Provided email does not exists" });
// //     }

// //     await PasswordResetToken.deleteMany({ user: isExistingUser._id });

// //     // if user exists , generates a password reset token
// //     const passwordResetToken = generateToken(
// //       sanitizeUser(isExistingUser),
// //       true
// //     );

// //     // hashes the token
// //     const hashedToken = await bcrypt.hash(passwordResetToken, 10);

// //     // saves hashed token in passwordResetToken collection
// //     newToken = new PasswordResetToken({
// //       user: isExistingUser._id,
// //       token: hashedToken,
// //       expiresAt: Date.now() + parseInt(process.env.OTP_EXPIRATION_TIME),
// //     });
// //     await newToken.save();

// //     // sends the password reset link to the user's mail
// //     await sendMail(
// //       isExistingUser.email,
// //       "Password Reset Link for Your MERN-AUTH-REDUX-TOOLKIT Account",
// //       `<p>Dear ${isExistingUser.name},

// //         We received a request to reset the password for your MERN-AUTH-REDUX-TOOLKIT account. If you initiated this request, please use the following link to reset your password:</p>

// //         <p><a href=${process.env.ORIGIN}/reset-password/${isExistingUser._id}/${passwordResetToken} target="_blank">Reset Password</a></p>

// //         <p>This link is valid for a limited time. If you did not request a password reset, please ignore this email. Your account security is important to us.

// //         Thank you,
// //         The MERN-AUTH-REDUX-TOOLKIT Team</p>`
// //     );

// //     res
// //       .status(200)
// //       .json({ message: `Password Reset link sent to ${isExistingUser.email}` });
// //   } catch (error) {
// //     console.log(error);
// //     res
// //       .status(500)
// //       .json({ message: "Error occured while sending password reset mail" });
// //   }
// // };

// // exports.resetPassword = async (req, res) => {
// //   try {
// //     // checks if user exists or not
// //     const isExistingUser = await User.findById(req.body.userId);

// //     // if user does not exists then returns a 404 response
// //     if (!isExistingUser) {
// //       return res.status(404).json({ message: "User does not exists" });
// //     }

// //     // fetches the resetPassword token by the userId
// //     const isResetTokenExisting = await PasswordResetToken.findOne({
// //       user: isExistingUser._id,
// //     });

// //     // If token does not exists for that userid, then returns a 404 response
// //     if (!isResetTokenExisting) {
// //       return res.status(404).json({ message: "Reset Link is Not Valid" });
// //     }

// //     // if the token has expired then deletes the token, and send response accordingly
// //     if (isResetTokenExisting.expiresAt < new Date()) {
// //       await PasswordResetToken.findByIdAndDelete(isResetTokenExisting._id);
// //       return res.status(404).json({ message: "Reset Link has been expired" });
// //     }

// //     // if token exists and is not expired and token matches the hash, then resets the user password and deletes the token
// //     if (
// //       isResetTokenExisting &&
// //       isResetTokenExisting.expiresAt > new Date() &&
// //       (await bcrypt.compare(req.body.token, isResetTokenExisting.token))
// //     ) {
// //       // deleting the password reset token
// //       await PasswordResetToken.findByIdAndDelete(isResetTokenExisting._id);

// //       // resets the password after hashing it
// //       await User.findByIdAndUpdate(isExistingUser._id, {
// //         password: await bcrypt.hash(req.body.password, 10),
// //       });
// //       return res.status(200).json({ message: "Password Updated Successfuly" });
// //     }

// //     return res.status(404).json({ message: "Reset Link has been expired" });
// //   } catch (error) {
// //     console.log(error);
// //     res
// //       .status(500)
// //       .json({
// //         message:
// //           "Error occured while resetting the password, please try again later",
// //       });
// //   }
// // };

// // exports.logout = async (req, res) => {
// //   try {
// //     res.cookie("token", {
// //       maxAge: 0,
// //       sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
// //       httpOnly: true,
// //       secure: process.env.PRODUCTION === "true" ? true : false,
// //     });
// //     res.status(200).json({ message: "Logout successful" });
// //   } catch (error) {
// //     console.log(error);
// //   }
// // };

// // exports.checkAuth = async (req, res) => {
// //   try {
// //     if (req.user) {
// //       const user = await User.findById(req.user._id);
// //       return res.status(200).json(sanitizeUser(user));
// //     }
// //     res.sendStatus(401);
// //   } catch (error) {
// //     console.log(error);
// //     res.sendStatus(500);
// //   }
// // };

// funny update

// // controllers/Auth.js
// const User = require("../models/User");
// const bcrypt = require("bcryptjs");
// const { sendMail } = require("../utils/Emails");
// const { generateOTP } = require("../utils/GenerateOtp");
// const Otp = require("../models/OTP");
// const { sanitizeUser } = require("../utils/SanitizeUser");
// const { generateToken } = require("../utils/GenerateToken");
// const PasswordResetToken = require("../models/PasswordResetToken");
// const rateLimit = require("express-rate-limit");

// // Rate limiting for auth attempts
// const authLimiter = rateLimit({
//   windowMs: 5 * 60 * 1000, // 15 minutes
//   max: 10, // 10 attempts
//   message:
//     "🚫 Whoa there! Too many login attempts. Take a coffee break ☕ and try again in 15 minutes!",
// });

// exports.signup = async (req, res) => {
//   try {
//     // First check if user exists
//     const existingUser = await User.findOne({ email: req.body.email });

//     if (existingUser) {
//       return res.status(400).json({
//         message:
//           "🤔 Looks like you're already one of us! Try logging in instead!s",
//         success: false,
//       });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(req.body.password, 10);

//     // Create new user with required fields only
//     const newUser = new User({
//       name: req.body.name,
//       email: req.body.email,
//       password: hashedPassword,
//       // Only add username if provided, otherwise leave it undefined
//       ...(req.body.username && { username: req.body.username }),
//     });

//     const createdUser = await newUser.save();

//     // Generate token
//     const secureInfo = sanitizeUser(createdUser);
//     const token = generateToken(secureInfo);

//     // Set cookie
//     res.cookie("token", token, {
//       sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
//       maxAge: new Date(
//         Date.now() +
//           parseInt(process.env.COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
//       ),
//       httpOnly: true,
//       secure: process.env.PRODUCTION === "true",
//     });

//     res.status(201).json({
//       success: true,
//       user: sanitizeUser(createdUser),
//       message: "Signup successful!",
//     });
//   } catch (error) {
//     console.error("Signup Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error occurred during signup, please try again later",
//     });
//   }
// };

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const existingUser = await User.findOne({ email });

//     if (!existingUser) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     const isPasswordValid = await bcrypt.compare(
//       password,
//       existingUser.password
//     );

//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     const secureInfo = sanitizeUser(existingUser);
//     const token = generateToken(secureInfo);

//     res.cookie("token", token, {
//       sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
//       maxAge: new Date(
//         Date.now() +
//           parseInt(process.env.COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
//       ),
//       httpOnly: true,
//       secure: process.env.PRODUCTION === "true",
//     });

//     res.status(200).json({
//       success: true,
//       user: sanitizeUser(existingUser),
//       message: "Login successful",
//     });
//   } catch (error) {
//     console.error("Login Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error occurred during login, please try again later",
//     });
//   }
// };

// exports.verifyOtp = async (req, res) => {
//   try {
//     const { userId, otp } = req.body;
//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     const otpRecord = await Otp.findOne({ user: userId });

//     if (!otpRecord) {
//       return res.status(404).json({
//         success: false,
//         message: "OTP not found",
//       });
//     }

//     if (otpRecord.expiresAt < new Date()) {
//       await Otp.findByIdAndDelete(otpRecord._id);
//       return res.status(400).json({
//         success: false,
//         message: "OTP has expired",
//       });
//     }

//     const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);

//     if (!isOtpValid) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP",
//       });
//     }

//     await Otp.findByIdAndDelete(otpRecord._id);
//     const verifiedUser = await User.findByIdAndUpdate(
//       userId,
//       { isVerified: true },
//       { new: true }
//     );

//     res.status(200).json({
//       success: true,
//       user: sanitizeUser(verifiedUser),
//       message: "OTP verified successfully",
//     });
//   } catch (error) {
//     console.error("OTP Verification Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error occurred during OTP verification",
//     });
//   }
// };

// exports.resendOtp = async (req, res) => {
//   try {
//     const user = await User.findById(req.body.user);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     await Otp.deleteMany({ user: user._id });

//     const otp = generateOTP();
//     const hashedOtp = await bcrypt.hash(otp, 10);

//     const newOtp = new Otp({
//       user: user._id,
//       otp: hashedOtp,
//       expiresAt: Date.now() + parseInt(process.env.OTP_EXPIRATION_TIME),
//     });
//     await newOtp.save();

//     await sendMail(user.email, "OTP Verification", `Your OTP is: ${otp}`);

//     res.status(200).json({
//       success: true,
//       message: "OTP sent successfully",
//     });
//   } catch (error) {
//     console.error("Resend OTP Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error occurred while resending OTP",
//     });
//   }
// };

// exports.forgotPassword = async (req, res) => {
//   let newToken;
//   try {
//     // checks if user provided email exists or not
//     const isExistingUser = await User.findOne({ email: req.body.email });

//     // if email does not exists returns a 404 response
//     if (!isExistingUser) {
//       return res
//         .status(404)
//         .json({ message: "Provided email does not exists" });
//     }

//     await PasswordResetToken.deleteMany({ user: isExistingUser._id });

//     // if user exists , generates a password reset token
//     const passwordResetToken = generateToken(
//       sanitizeUser(isExistingUser),
//       true
//     );

//     // hashes the token
//     const hashedToken = await bcrypt.hash(passwordResetToken, 10);

//     // saves hashed token in passwordResetToken collection
//     newToken = new PasswordResetToken({
//       user: isExistingUser._id,
//       token: hashedToken,
//       expiresAt: Date.now() + parseInt(process.env.OTP_EXPIRATION_TIME),
//     });
//     await newToken.save();

//     // sends the password reset link to the user's mail
//     await sendMail(
//       isExistingUser.email,
//       "Password Reset Link for Your MERN-AUTH-REDUX-TOOLKIT Account",
//       `<p>Dear ${isExistingUser.name},

//         We received a request to reset the password for your MERN-AUTH-REDUX-TOOLKIT account. If you initiated this request, please use the following link to reset your password:</p>

//         <p><a href=${process.env.ORIGIN}/reset-password/${isExistingUser._id}/${passwordResetToken} target="_blank">Reset Password</a></p>

//         <p>This link is valid for a limited time. If you did not request a password reset, please ignore this email. Your account security is important to us.

//         Thank you,
//         The MERN-AUTH-REDUX-TOOLKIT Team</p>`
//     );

//     res
//       .status(200)
//       .json({ message: `Password Reset link sent to ${isExistingUser.email}` });
//   } catch (error) {
//     console.log(error);
//     res
//       .status(500)
//       .json({ message: "Error occured while sending password reset mail" });
//   }
// };

// exports.resetPassword = async (req, res) => {
//   try {
//     // checks if user exists or not
//     const isExistingUser = await User.findById(req.body.userId);

//     // if user does not exists then returns a 404 response
//     if (!isExistingUser) {
//       return res.status(404).json({ message: "User does not exists" });
//     }

//     // fetches the resetPassword token by the userId
//     const isResetTokenExisting = await PasswordResetToken.findOne({
//       user: isExistingUser._id,
//     });

//     // If token does not exists for that userid, then returns a 404 response
//     if (!isResetTokenExisting) {
//       return res.status(404).json({ message: "Reset Link is Not Valid" });
//     }

//     // if the token has expired then deletes the token, and send response accordingly
//     if (isResetTokenExisting.expiresAt < new Date()) {
//       await PasswordResetToken.findByIdAndDelete(isResetTokenExisting._id);
//       return res.status(404).json({ message: "Reset Link has been expired" });
//     }

//     // if token exists and is not expired and token matches the hash, then resets the user password and deletes the token
//     if (
//       isResetTokenExisting &&
//       isResetTokenExisting.expiresAt > new Date() &&
//       (await bcrypt.compare(req.body.token, isResetTokenExisting.token))
//     ) {
//       // deleting the password reset token
//       await PasswordResetToken.findByIdAndDelete(isResetTokenExisting._id);

//       // resets the password after hashing it
//       await User.findByIdAndUpdate(isExistingUser._id, {
//         password: await bcrypt.hash(req.body.password, 10),
//       });
//       return res.status(200).json({ message: "Password Updated Successfuly" });
//     }

//     return res.status(404).json({ message: "Reset Link has been expired" });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({
//       message:
//         "Error occured while resetting the password, please try again later",
//     });
//   }
// };

// exports.logout = async (req, res) => {
//   try {
//     res.cookie("token", "", {
//       maxAge: 0,
//       sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
//       httpOnly: true,
//       secure: process.env.PRODUCTION === "true",
//     });

//     res.status(200).json({
//       success: true,
//       message: "Logged out successfully",
//     });
//   } catch (error) {
//     console.error("Logout Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error occurred during logout",
//     });
//   }
// };

// exports.checkAuth = async (req, res) => {
//   try {
//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         message: "Not authenticated",
//       });
//     }

//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       user: sanitizeUser(user),
//     });
//   } catch (error) {
//     console.error("Check Auth Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error occurred while checking authentication",
//     });
//   }
// };

// // // controllers\Auth.js
// // const User = require("../models/User");
// // const bcrypt = require("bcryptjs");
// // const { sendMail } = require("../utils/Emails");
// // const { generateOTP } = require("../utils/GenerateOtp");
// // const Otp = require("../models/OTP");
// // const { sanitizeUser } = require("../utils/SanitizeUser");
// // const { generateToken } = require("../utils/GenerateToken");
// // const PasswordResetToken = require("../models/PasswordResetToken");
// // const rateLimit = require("express-rate-limit");

// // // Rate limiting for auth attempts 🛡️
// // const authLimiter = rateLimit({
// //   windowMs: 15 * 60 * 1000, // 15 minutes
// //   max: 5, // 5 attempts
// //   message:
// //     "🚫 Whoa there! Too many login attempts. Take a coffee break ☕ and try again in 15 minutes!",
// // });

// // exports.signup = async (req, res) => {
// //   try {
// //     const existingUser = await User.findOne({ email: req.body.email });

// //     if (existingUser) {
// //       return res.status(400).json({
// //         message:
// //           "🤔 Looks like you're already one of us! Try logging in instead!",
// //         emoji: "👋",
// //       });
// //     }

// //     const hashedPassword = await bcrypt.hash(req.body.password, 10);
// //     req.body.password = hashedPassword;

// //     const createdUser = new User(req.body);
// //     await createdUser.save();

// //     const secureInfo = sanitizeUser(createdUser);
// //     const token = generateToken(secureInfo);

// //     // Send welcome email 📧
// //     await sendMail(
// //       createdUser.email,
// //       "🎉 Welcome to the Cool Kids Club! 🎉",
// //       `<h1>Hey ${createdUser.name}! 👋</h1>
// //             <p>Welcome to our awesome app! We're super excited to have you here! 🚀</p>
// //             <p>Get ready for an amazing journey! 🌟</p>`
// //     );

// //     res.cookie("token", token, {
// //       sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
// //       maxAge: new Date(
// //         Date.now() +
// //           parseInt(process.env.COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
// //       ),
// //       httpOnly: true,
// //       secure: process.env.PRODUCTION === "true",
// //     });

// //     res.status(201).json({
// //       user: sanitizeUser(createdUser),
// //       message: "🎉 Welcome aboard! Time to explore!",
// //       emoji: "🚀",
// //     });
// //   } catch (error) {
// //     console.error("Signup Error:", error);
// //     res.status(500).json({
// //       message: "Oops! Our hamsters stopped running 🐹 Please try again!",
// //       emoji: "😅",
// //     });
// //   }
// // };

// // exports.login = async (req, res) => {
// //   try {
// //     const existingUser = await User.findOne({ email: req.body.email });

// //     if (
// //       existingUser &&
// //       (await bcrypt.compare(req.body.password, existingUser.password))
// //     ) {
// //       const secureInfo = sanitizeUser(existingUser);
// //       const token = generateToken(secureInfo);

// //       res.cookie("token", token, {
// //         sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
// //         maxAge: new Date(
// //           Date.now() +
// //             parseInt(process.env.COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
// //         ),
// //         httpOnly: true,
// //         secure: process.env.PRODUCTION === "true",
// //       });

// //       return res.status(200).json({
// //         user: sanitizeUser(existingUser),
// //         message: "🎯 Bulls-eye! You're in!",
// //         emoji: "🎪",
// //       });
// //     }

// //     res.clearCookie("token");
// //     return res.status(401).json({
// //       message: "Hmm... that didn't work. Did your cat walk on the keyboard? 🐱",
// //       emoji: "🤔",
// //     });
// //   } catch (error) {
// //     console.error("Login Error:", error);
// //     res.status(500).json({
// //       message: "Our servers are doing yoga 🧘‍♂️ Try again in a moment!",
// //       emoji: "🤖",
// //     });
// //   }
// // };

// // exports.verifyOtp = async (req, res) => {
// //   try {
// //     const isValidUserId = await User.findById(req.body.userId);

// //     if (!isValidUserId) {
// //       return res.status(404).json({
// //         message: "404 User Not Found! Are you a ghost? 👻",
// //         emoji: "🕵️‍♂️",
// //       });
// //     }

// //     const isOtpExisting = await Otp.findOne({ user: isValidUserId._id });

// //     if (!isOtpExisting) {
// //       return res.status(404).json({
// //         message: "This OTP has vanished into thin air! 💨",
// //         emoji: "🎭",
// //       });
// //     }

// //     if (isOtpExisting.expiresAt < new Date()) {
// //       await Otp.findByIdAndDelete(isOtpExisting._id);
// //       return res.status(400).json({
// //         message: "⏰ Time's up! This OTP is now sleeping with the fishes!",
// //         emoji: "🐠",
// //       });
// //     }

// //     if (
// //       isOtpExisting &&
// //       (await bcrypt.compare(req.body.otp, isOtpExisting.otp))
// //     ) {
// //       await Otp.findByIdAndDelete(isOtpExisting._id);
// //       const verifiedUser = await User.findByIdAndUpdate(
// //         isValidUserId._id,
// //         { isVerified: true },
// //         { new: true }
// //       );
// //       return res.status(200).json({
// //         user: sanitizeUser(verifiedUser),
// //         message: "🎉 Verified! You're officially awesome!",
// //         emoji: "✨",
// //       });
// //     }

// //     return res.status(400).json({
// //       message: "That OTP is as wrong as pineapple on pizza! 🍕",
// //       emoji: "❌",
// //     });
// //   } catch (error) {
// //     console.error("OTP Verification Error:", error);
// //     res.status(500).json({
// //       message: "Our verification gnomes are on strike! 🧙‍♂️",
// //       emoji: "🎪",
// //     });
// //   }
// // };
