import type { LoginResponse, OTPResponse } from "../types/auth"
import { config } from "../config/env"

const API_BASE_URL = config.apiBaseUrl

export const authService = {
  async sendOTP(email: string): Promise<OTPResponse> {
    const response = await fetch(`${API_BASE_URL}/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })
    return response.json()
  },

  async verifyOTP(email: string, OTP: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, OTP }),
    })
    return response.json()
  },
}





















// import type { LoginResponse, OTPResponse } from "../types/auth";
// import { config } from "../config/env";
// import { useAuthStore } from "@/store/authStore";

// const API_BASE_URL = config.apiBaseUrl;

// export const authService = {
//     async sendOTP(email: string): Promise<OTPResponse> {
//         const response = await fetch(`${API_BASE_URL}/send-otp`, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({ email }),
//         });
//         return response.json();
//     },

//     async verifyOTP(email: string, OTP: string): Promise<LoginResponse> {
//         const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({ email, OTP }),
//         });
//         const data = await response.json();
        
//         if (data.success) {
//             const { setTokens, setUser } = useAuthStore.getState();
//             setTokens(data.token, data.refreshToken);
//             setUser(data.user);
//         }
        
//         return data;
//     },
// };