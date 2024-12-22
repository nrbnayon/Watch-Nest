import {
  FormHelperText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  clearOtpVerificationError,
  clearResendOtpError,
  clearResendOtpSuccessMessage,
  resendOtpAsync,
  resetOtpVerificationStatus,
  resetResendOtpStatus,
  selectLoggedInUser,
  selectOtpVerificationError,
  selectOtpVerificationStatus,
  selectResendOtpError,
  selectResendOtpStatus,
  selectResendOtpSuccessMessage,
  verifyOtpAsync,
} from "../AuthSlice";
import { LoadingButton } from "@mui/lab";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

export const OtpVerfication = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();
  const dispatch = useDispatch();
  const loggedInUser = useSelector(selectLoggedInUser);
  const navigate = useNavigate();
  const resendOtpStatus = useSelector(selectResendOtpStatus);
  const resendOtpError = useSelector(selectResendOtpError);
  const resendOtpSuccessMessage = useSelector(selectResendOtpSuccessMessage);
  const otpVerificationStatus = useSelector(selectOtpVerificationStatus);
  const otpVerificationError = useSelector(selectOtpVerificationError);

  // handles the redirection
  useEffect(() => {
    if (!loggedInUser) {
      navigate("/login");
    } else if (loggedInUser && loggedInUser?.isVerified) {
      navigate("/");
    }
  }, [loggedInUser, navigate]);

  const handleSendOtp = async () => {
    try {
      const data = { user: loggedInUser?._id };
      await dispatch(resendOtpAsync(data)).unwrap();
      // Reset form after successful OTP resend
      reset();
      // Reload window after a brief delay
      //   setTimeout(() => {
      //     window.location.reload();
      //   }, 1000);
    } catch (error) {
      console.error("Failed to resend OTP:", error);
    }
  };

  const handleVerifyOtp = async (data) => {
    try {
      const cred = { ...data, userId: loggedInUser?._id };
      await dispatch(verifyOtpAsync(cred)).unwrap();
      // Reset form after successful verification
      reset();
    } catch (error) {
      console.error("Failed to verify OTP:", error);
    }
  };

  // handles resend otp error
  useEffect(() => {
    if (resendOtpError) {
      toast.error(resendOtpError.message);
      window.location.reload(true);
    }
    return () => {
      dispatch(clearResendOtpError());
    };
  }, [resendOtpError, dispatch]);

  // handles resend otp success message
  useEffect(() => {
    if (resendOtpSuccessMessage) {
      toast.success(resendOtpSuccessMessage.message);
    }
    return () => {
      dispatch(clearResendOtpSuccessMessage());
    };
  }, [resendOtpSuccessMessage, dispatch]);

  // handles error while verifying otp
  useEffect(() => {
    if (otpVerificationError) {
      toast.error(otpVerificationError.message);
    }
    return () => {
      dispatch(clearOtpVerificationError());
    };
  }, [otpVerificationError, dispatch]);

  useEffect(() => {
    if (otpVerificationStatus === "fullfilled") {
      toast.success("Email verified! We are happy to have you here");
      window.location.reload(true);
      dispatch(resetResendOtpStatus());
      // Navigate to home after successful verification

      navigate("/");
    }
    return () => {
      dispatch(resetOtpVerificationStatus());
    };
  }, [otpVerificationStatus, dispatch, navigate]);

  return (
    <Stack
      width={"100vw"}
      height={"100vh"}
      noValidate
      flexDirection={"column"}
      rowGap={3}
      justifyContent='center'
      alignItems='center'
    >
      <Stack
        component={Paper}
        elevation={1}
        position={"relative"}
        justifyContent={"center"}
        alignItems={"center"}
        p={"2rem"}
        rowGap={"2rem"}
      >
        <Typography mt={4} variant='h5' fontWeight={500}>
          Verify Your Email Address
        </Typography>

        {resendOtpStatus === "fullfilled" ? (
          <Stack
            width={"100%"}
            rowGap={"1rem"}
            component={"form"}
            noValidate
            onSubmit={handleSubmit(handleVerifyOtp)}
          >
            <Stack rowGap={"1rem"}>
              <Stack>
                <Typography color={"GrayText"}>
                  Enter the 6 digit OTP sent on
                </Typography>
                <Typography fontWeight={"600"} color={"GrayText"}>
                  {loggedInUser?.email}
                </Typography>
              </Stack>
              <Stack>
                <TextField
                  {...register("otp", {
                    required: "OTP is required",
                    minLength: {
                      value: 6,
                      message: "Please enter a 6 digit OTP",
                    },
                    pattern: {
                      value: /^[0-9]{6}$/,
                      message: "Please enter only numbers",
                    },
                  })}
                  fullWidth
                  type='number'
                  placeholder='Enter 6-digit OTP'
                />
                {errors?.otp && (
                  <FormHelperText sx={{ color: "red" }}>
                    {errors.otp.message}
                  </FormHelperText>
                )}
              </Stack>
            </Stack>
            <LoadingButton
              loading={otpVerificationStatus === "pending"}
              type='submit'
              fullWidth
              variant='contained'
            >
              Verify
            </LoadingButton>
          </Stack>
        ) : (
          <>
            <Stack>
              <Typography color={"GrayText"}>
                We will send you an OTP via Email
              </Typography>
              <Typography fontWeight={"600"} color={"GrayText"}>
                {loggedInUser?.email}
              </Typography>
            </Stack>
            <LoadingButton
              onClick={handleSendOtp}
              loading={resendOtpStatus === "pending"}
              fullWidth
              variant='contained'
            >
              SEND OTP
            </LoadingButton>
          </>
        )}
      </Stack>
    </Stack>
  );
};
