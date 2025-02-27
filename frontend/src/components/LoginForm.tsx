import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { authService } from "../services/authService";
import { Loader2 } from "lucide-react";

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();


  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return emailRegex.test(email);
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const sanitizedEmail = email.trim().toLowerCase();
    if (!validateEmail(sanitizedEmail)) {
        setError("Please enter a valid email address");
        return;
    }
    
    try {
      const response = await authService.sendOTP(email);
      if (response.success) {
        navigate("/verify-otp", { state: { email } });
      } else {
        setError(response.message);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md space-y-6">
      <div className="text-center space-y-2">
        <Logo className="h-12 w-auto mb-4" />
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Welcome to Sundaram
        </h1>
        <p className="text-gray-500 text-base">
          Enter your email to access your account securely
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email Address
          </label>
          <div className="relative">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm text-gray-900 text-base placeholder:text-gray-400"
              placeholder="name@company.com"
            />
            {error && (
              <p className="mt-1.5 text-sm font-medium text-red-500">{error}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-base transition-colors duration-200 relative"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Sending OTP...
            </span>
          ) : (
            "Continue with Email"
          )}
        </button>
      </form>

      <div className="relative w-full">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">
            Secure authentication
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center">
        By continuing, you agree to our{" "}
        <a href="#" className="text-blue-600 hover:text-blue-700">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="text-blue-600 hover:text-blue-700">
          Privacy Policy
        </a>
      </p>

      <p className="text-sm text-gray-400 text-center">
        Secure login powered by Sundaram Finance
      </p>
    </div>
  );
};
