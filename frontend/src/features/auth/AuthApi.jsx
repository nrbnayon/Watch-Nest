// import axios from "axios";

// const api = axios.create({
//   baseURL: process.env.REACT_APP_BASE_URL,
//   withCredentials: true,
// });

// export const signup = async (cred) => {
//   try {
//     const response = await api.post("auth/signup", cred);
//     return {
//       success: true,
//       data: response.data,
//       message: "🎉 Welcome to the party! 🎈",
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error:
//         error.response?.data?.message ||
//         "🤖 Beep boop... something went wrong!",
//     };
//   }
// };

// export const login = async (cred) => {
//   try {
//     const response = await api.post("auth/login", cred);
//     return {
//       success: true,
//       data: response.data,
//       message: "🌟 Welcome back, superstar!",
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error:
//         error.response?.data?.message ||
//         "🔐 Authentication took a coffee break!",
//     };
//   }
// };

// export const verifyOtp = async (cred) => {
//   try {
//     const response = await api.post("auth/verify-otp", cred);
//     return {
//       success: true,
//       data: response.data,
//       message: "✨ OTP verified successfully! You're amazing!",
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error:
//         error.response?.data?.message ||
//         "🎪 Our OTP circus act didn't quite stick the landing!",
//     };
//   }
// };

// export const resendOtp = async (cred) => {
//   try {
//     const response = await api.post("auth/resend-otp", cred);
//     return {
//       success: true,
//       data: response.data,
//       message: "🎯 New OTP incoming! Check your inbox!",
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error:
//         error.response?.data?.message ||
//         "🎪 Our OTP juggler dropped the balls!",
//     };
//   }
// };

// export const forgotPassword = async (cred) => {
//   try {
//     const response = await api.post("auth/forgot-password", cred);
//     return {
//       success: true,
//       data: response.data,
//       message: "🔑 Password reset magic is on the way!",
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error:
//         error.response?.data?.message ||
//         "🎭 The password recovery show hit a snag!",
//     };
//   }
// };

// export const resetPassword = async (cred) => {
//   try {
//     const response = await api.post("auth/reset-password", cred);
//     return {
//       success: true,
//       data: response.data,
//       message: "🎉 Password updated! You're back in business!",
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error:
//         error.response?.data?.message || "🎪 Password reset acrobatics failed!",
//     };
//   }
// };

// // export const checkAuth = async () => {
// //   try {
// //     const response = await api.get("auth/check-auth");
// //     return {
// //       success: true,
// //       data: response.data,
// //       message: "🎭 Your VIP pass is still valid!",
// //     };
// //   } catch (error) {
// //     return {
// //       success: false,
// //       error:
// //         error.response?.data?.message || "🎪 Security check doing cartwheels!",
// //     };
// //   }
// // };

// export const checkAuth = async (cred) => {
//   try {
//     const res = await api.get("auth/check-auth");
//     return res.data;
//   } catch (error) {
//     throw error.response.data;
//   }
// };

// export const logout = async () => {
//   try {
//     await api.get("auth/logout");
//     return {
//       success: true,
//       message: "👋 See you later, alligator! 🐊",
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error:
//         error.response?.data?.message || "🎪 Logout got stuck in the circus!",
//     };
//   }
// };

import { axiosi } from "../../config/axios";

export const signup = async (cred) => {
  try {
    const res = await axiosi.post("auth/signup", cred);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const login = async (cred) => {
  try {
    const res = await axiosi.post("auth/login", cred);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const verifyOtp = async (cred) => {
  try {
    const res = await axiosi.post("auth/verify-otp", cred);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const resendOtp = async (cred) => {
  try {
    const res = await axiosi.post("auth/resend-otp", cred);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const forgotPassword = async (cred) => {
  try {
    const res = await axiosi.post("auth/forgot-password", cred);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const resetPassword = async (cred) => {
  try {
    const res = await axiosi.post("auth/reset-password", cred);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const checkAuth = async (cred) => {
  try {
    const res = await axiosi.get("auth/check-auth");
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const logout = async () => {
  try {
    const res = await axiosi.get("auth/logout");
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
