import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { authService } from "../services/authService";
import { Loader2 } from "lucide-react";
import { useOTPTimer } from "../hooks/useOTPTimer";
import { config } from "../config/env";


interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  data?: {
    email: string;
    role: string;
    first_name: string;
    last_name: string;
  };
  redirectPath?: string;
}

export const VerifyOTPPage: React.FC = () => {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  const { timeLeft, startTimer, isActive } = useOTPTimer(
    config.otpExpirySeconds
  );

  useEffect(() => {
    if (!email) {
      navigate("/login");
      return;
    }
    // Start the timer when the component mounts
    startTimer();
  }, [email, navigate, startTimer]);

  const handleResendOTP = async () => {
    try {
      setIsLoading(true);
      const response = await authService.sendOTP(email);
      if (response.success) {
        startTimer();
        setError("");
      } else {
        setError(response.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      setError("Failed to resend OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const validateInput = (input: string): boolean => {
    // Validate OTP format (6 digits only)
    const otpRegex = /^\d{6}$/;
    return otpRegex.test(input);
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

     // Enhanced input validation
     if (!validateInput(otp)) {
      setError("Please enter a valid 6-digit OTP");
      return;
     }

     if (!email || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(email)) {
        setError("Invalid email format");
        return;
     }

    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    if (!isActive) {
      setError("OTP has expired. Please request a new one.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = (await authService.verifyOTP(
        email,
        otp
      )) as AuthResponse;
      if (response.success && response.token && response.data) {
        // Store user data in localStorage
        localStorage.setItem("token", response.token);
        localStorage.setItem("userRole", response.data.role.toLowerCase());
        localStorage.setItem("userEmail", response.data.email);
        localStorage.setItem("firstName", response.data.first_name);
        localStorage.setItem("lastName", response.data.last_name);

        // Redirect based on role
        const role = response.data.role.toLowerCase();
        switch (role) {
          case "admin":
            navigate("/admin");
            break;
          case "maker":
            navigate("/dashboard");
            break;
          case "checker":
            navigate("/checker");
            break;
          default:
            navigate("/login");
        }
      } else {
        setError(response.message || "Invalid OTP. Please try again.");
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      setError("Failed to verify OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) {
        setOtp(value);
    }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a237e] via-[#0d47a1] to-[#00bfa5] p-4">
      <div className="bg-white/90 rounded-3xl shadow-2xl p-8 w-full max-w-md backdrop-blur-sm backdrop-filter">
        <div className="flex flex-col items-center space-y-6">
          <Logo className="h-12 w-auto text-[#1a237e]" />

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-[#1a237e]">
              Verify Your Email
            </h1>
            <p className="text-gray-600">
              We've sent a verification code to{" "}
              <span className="font-medium text-[#1a237e]">{email}</span>
            </p>
            <p className="text-sm text-gray-500">
              OTP will expire in{" "}
              <span className="font-medium text-[#00bfa5]">
                {timeLeft} seconds
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="otp"
                className="block text-sm font-medium text-[#1a237e]"
              >
                Enter OTP
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={handleOTPInput}
                maxLength={6}
                pattern="\d{6}"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00bfa5] focus:border-transparent text-lg tracking-widest text-center font-mono"
                placeholder="000000"
              />
              {error && (
                <p className="mt-1.5 text-sm font-medium text-red-500">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6 || !isActive}
              className="w-full bg-gradient-to-r from-[#1a237e] to-[#00bfa5] text-white py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 font-medium transition-all duration-200"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Verifying...
                </span>
              ) : (
                "Verify OTP"
              )}
            </button>
          </form>

          <div className="text-center">
            {timeLeft === 0 ? (
              <button
                onClick={handleResendOTP}
                disabled={isLoading}
                className="text-sm text-[#00bfa5] hover:text-[#00bfa5]/80 font-medium"
              >
                Resend OTP
              </button>
            ) : (
              <p className="text-sm text-gray-500">
                Resend OTP in <span className="text-[#00bfa5]">{timeLeft}</span>{" "}
                seconds
              </p>
            )}
          </div>

          <button
            onClick={() => navigate("/login")}
            className="text-sm text-gray-500 hover:text-[#1a237e] transition-colors"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};