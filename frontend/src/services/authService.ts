import axios from "axios";
import type { LoginResponse, OTPResponse } from "../types/auth";
// import api from './axiosConfig';
import TokenService from './tokenService';
import { config } from '../config/env';
export const authService = {
    async sendOTP(email: string): Promise<OTPResponse> {
        const response = await axios.post(`${config.apiBaseUrl}/send-otp`, { email });
        return response.data;
    },

    async verifyOTP(email: string, OTP: string): Promise<LoginResponse> {
        const response = await axios.post(`${config.apiBaseUrl}/verify-otp`, { email, OTP });
        const data = response.data;

        if (data.success && data.tokens) {
            // Store the session ID along with tokens
            TokenService.setTokens(
                data.tokens.accessToken,
                data.tokens.refreshToken,
                data.tokens.sessionId // Make sure backend sends this
            );
            
            if (data.data) {
                TokenService.setUserData({
                    email: data.data.email,
                    role: data.data.role,
                    firstName: data.data.first_name,
                    lastName: data.data.last_name
                });

                // localStorage.setItem('userRole', data.data.role);
                // localStorage.setItem('email', data.data.email);
                // localStorage.setItem('firstName', data.data.first_name);
                // localStorage.setItem('lastName', data.data.last_name);
            }
        }

        return data;
    },

    // logout(reason?: string) {

    //     api.post('/logout', { sessionId: TokenService.getSessionId() })
    //    .catch(() => {/* Ignore errors */});

    //     TokenService.removeTokens();
    //     if (reason) {
    //         window.location.href = `/login?message=${encodeURIComponent(reason)}`;
    //     } else {
    //         window.location.href = '/login';
    //     }
    // }
};