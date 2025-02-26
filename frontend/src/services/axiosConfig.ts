// import axios from 'axios';
// import TokenService from './tokenService';
// import { config } from '../config/env';
// // import { authService } from './authService';

// // Create a flag to prevent multiple redirects
// let isHandlingAuthError = false;
// // let isRefreshing = false;
// // let failedQueue: any[] = [];

// const instance = axios.create({
//     baseURL: config.apiBaseUrl,
//     headers: {
//         'Content-Type': 'application/json',
//     },
// });

// // const processQueue = (error: any, token: string | null = null) => {
// //     failedQueue.forEach(prom => {
// //       if (error) {
// //         prom.reject(error);
// //       } else {
// //         prom.resolve(token);
// //       }
// //     });
// //     failedQueue = [];
// //   };

// // Define endpoints that shouldn't trigger token refresh
// // const NO_RETRY_ENDPOINTS = ['/refresh-token', '/login', '/verify-otp'];

// instance.interceptors.request.use(
//     (config) => {
//         const token = TokenService.getLocalAccessToken();
//         const sessionId = TokenService.getSessionId();

//         console.log('🚀 Request:', { 
//             url: config.url,
//             method: config.method,
//             hasToken: !!token 
//         });

//         // Check token expiration before making request
//         if (token && TokenService.isTokenExpired(token)) {
//             console.log('🔑 Token expired, attempting refresh');
//             return handleTokenRefresh();
//         }

//         if (token) {
//             config.headers['Authorization'] = `Bearer ${token}`;
//         }
//         if (sessionId) {
//             config.headers['X-Session-ID'] = sessionId;
//         }

//         return config;
//     },
//     (error) => Promise.reject(error)
// );

// const handleTokenRefresh = async () => {
//     try {
//         const refreshToken = TokenService.getLocalRefreshToken();
//         const sessionId = TokenService.getSessionId();

//         if (!refreshToken || !sessionId) throw new Error('No refresh token or session ID available');

//         const response = await axios.post(
//             `${config.apiBaseUrl}/refresh-token`,
//             {
//                 refreshToken,
//                 sessionId
//             }
//         );

//         if (response.data.success) {
//             const { accessToken, refreshToken: newRefreshToken, sessionId: newSessionId } = response.data.data;
//             TokenService.setTokens(accessToken, newRefreshToken, newSessionId);
//             localStorage.setItem('sessionId', newSessionId);
//             localStorage.setItem('refreshToken', newRefreshToken);
//             localStorage.setItem('accessToken', accessToken);
//             localStorage.setItem('token', accessToken);
//             return accessToken;
//         } else {
//             throw new Error(response.data.message || 'Token refresh failed');
//         }
//     } catch (error) {
//         console.error('Token refresh failed:', error);
//         TokenService.removeTokens();
//         throw error;
//     }
// };

// const handleAuthError = (message: string) => {
//     if (!isHandlingAuthError) {
//         isHandlingAuthError = true;
//         console.log('🚫 Auth error:', message);
//         TokenService.removeTokens();
//         window.location.href = `/login?message=${encodeURIComponent(message)}`;
//     }
// };

// instance.interceptors.response.use(
//     (response) => response,
//     async (error) => {
//         const originalRequest = error.config;

//         console.log('❌ Response Error:', {
//             url: originalRequest?.url,
//             status: error.response?.status,
//             message: error.response?.data?.message
//         });

//         if (error.response?.status === 401) {
//             const errorMessage = error.response?.data?.message;
            
//             // Check for session invalidation
//             if (errorMessage?.includes('logged in from another device') || 
//                 errorMessage?.includes('Session invalidated')) {
//                 // handleAuthError('Your session was ended because you logged in from another device');
//                 return Promise.reject(error);
//             }

//             // Don't retry special endpoints
//             // if (NO_RETRY_ENDPOINTS.some(endpoint => originalRequest.url?.includes(endpoint))) {
//             //     return Promise.reject(error);
//             // }

//             // Try token refresh for other 401 errors
//             if (!originalRequest._retry) {
//                 originalRequest._retry = true;
//                 const refreshSuccess = await handleTokenRefresh();
                
//                 if (refreshSuccess) {
//                     const newToken = TokenService.getLocalAccessToken();
//                     originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
//                     originalRequest.headers['X-Session-ID'] = TokenService.getSessionId();
//                     return instance(originalRequest);
//                 }
//             }
//         }

//         return Promise.reject(error);
//     }
// );

// // Reset handling flag on page load/navigation
// window.addEventListener('pageshow', () => {
//     isHandlingAuthError = false;
// });

// export default instance;