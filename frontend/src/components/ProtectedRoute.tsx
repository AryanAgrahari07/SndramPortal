import type React from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import TokenService from '../services/tokenService';
import { useEffect, useRef } from 'react';
// import instance from '@/services/axiosConfig';
import axios from 'axios';
import { config } from '@/config/env';

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: string[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {

  // const [otp, setOtp] = useState("");
  // const [error, setError] = useState("");
  // const [isLoading, setIsLoading] = useState(false);
  // const navigate = useNavigate();
  // const email = location.state?.email;
  // const { timeLeft, startTimer, isActive } = useOTPTimer(config.otpExpirySeconds);



  const navigate = useNavigate();
  const location = useLocation();
  const isRedirectingRef = useRef(false);
  const userRole = TokenService.getUserRole()?.toLowerCase();


  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const validateSession = async () => {
      try {
        // const token = TokenService.getLocalAccessToken();
        const refreshToken = TokenService.getLocalRefreshToken();
        const accessToken = TokenService.getLocalAccessToken();
        const sessionId = TokenService.getSessionId();


        if (!accessToken && !refreshToken) {
          console.log("no access token or refresh token 111");
          handleInvalidSession('No valid session found. Please login.');
          return;
        }


        // if ((!accessToken || TokenService.isTokenExpired(accessToken)) && refreshToken) {
        //   try {
        //     // Attempt to refresh the token
        //     const response = await axios.post(`${config.apiBaseUrl}/refresh-token`, {
        //       refreshToken,
        //       sessionId
        //     });

        //     // const sessionId = TokenService.getSessionId();
        //     if (!sessionId) {
        //       console.log("no session id 222");
        //       handleInvalidSession('No valid session found. Please login.');
        //       return;
        //     }
    
        //     if (response.data.success) {
        //       const { accessToken: newAccessToken, refreshToken: newRefreshToken, sessionId } = response.data.data;
        //       TokenService.setTokens(newAccessToken, newRefreshToken, sessionId);
        //     } else {
        //       throw new Error('Token refresh failed');
        //     }
        //   } catch (refreshError) {
        //     console.error('Token refresh failed:', refreshError);
        //     handleInvalidSession('Session expired. Please login again.');
        //     return;
        //   }
        // }


        // Local validation first
        if (!TokenService.getLocalAccessToken()) {
          console.log("invalid expired 333");
          handleInvalidSession('invalid expired. Please login again.');
          return;
        }

        // Backend validation
        try {
          const response = await axios.get(`${config.apiBaseUrl}/check-session`, {
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${TokenService.getLocalAccessToken()}`,
                  'X-Session-ID': TokenService.getSessionId()
              }
          });
          console.log('Session is valid:', response.data);
      } catch (error) {
        console.error('Error checking session:', error);

        // Attempt to refresh the token if the session is invalid
        try {
            const refreshToken = TokenService.getLocalRefreshToken();
            const sessionId = TokenService.getSessionId();

            if (!refreshToken || !sessionId) {
                throw new Error('No refresh token or session ID available');
            }

            const refreshResponse = await axios.post(`${config.apiBaseUrl}/refresh-token`, {
                refreshToken,
                sessionId
            });

            if (refreshResponse.data.success) {
                const { accessToken, refreshToken: newRefreshToken, sessionId: newSessionId } = refreshResponse.data.data;
                TokenService.setTokens(accessToken, newRefreshToken, newSessionId);
                console.log('Token refreshed successfully');
            } else {
                throw new Error('Token refresh failed');
            }
        } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);

            // If refresh fails, redirect to login
            TokenService.removeTokens(); // Clear any stored tokens
            navigate('/login', { state: { message: 'Session expired. Please login again.' } });
        }
    }

      } catch (error) {
      //   if (error?.response?.status === 401) {
      //     const refreshToken = TokenService.getLocalRefreshToken();
          
      //     // If we have a refresh token, let the axios interceptor handle the refresh
      //     if (refreshToken) {
      //       console.log('Letting axios interceptor handle token refresh');
      //       return;
      //     }
          
      //     handleInvalidSession('Session expired. Please login again.');
      //   } else {
          console.error('Session validation error:', error);
      //   }
      }
    };

    const handleInvalidSession = (message: string) => {
      if (!isRedirectingRef.current) {
        isRedirectingRef.current = true;
        TokenService.removeTokens();

        console.log("session expired, redirecting to login");
        navigate('/login', { 
          state: { from: location, message } 
        });
      }
    };

    // Initial check
    validateSession();

    // Set up interval for periodic checks
    intervalId = setInterval(validateSession, 10000);

    return () => {
      clearInterval(intervalId);
      isRedirectingRef.current = false;
    };
  }, [navigate, location]);

  if (!TokenService.isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    switch (userRole) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'maker':
        return <Navigate to="/dashboard" replace />;
      case 'checker':
        return <Navigate to="/checker" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }


  // useEffect(() => {
  //   const token = TokenService.getLocalAccessToken();
  //   console.log("Checking token in VerifyOTP:", !!token);
    
  //   if (token) {
  //     const userRole = TokenService.getUserRole()?.toLowerCase();
  //     console.log("User role found:", userRole);
      
  //     // Redirect based on role
  //     switch (userRole) {
  //       case 'admin':
  //         navigate('/admin');
  //         break;
  //       case 'maker':
  //         navigate('/dashboard');
  //         break;
  //       case 'checker':
  //         navigate('/checker');
  //         break;
  //       default:
  //         TokenService.removeTokens();
  //     }
  //   }
  // }, [navigate]);

  
  
  // const token = localStorage.getItem('token')
//   const location = useLocation();
//   // const accessToken = localStorage.getItem('accessToken')
//   const token = TokenService.getLocalAccessToken();
//   const userRole = localStorage.getItem('userRole')?.toLowerCase()

//   if (!token || TokenService.isTokenExpired(token)) {
//     TokenService.removeTokens();
//     return <Navigate to="/login" state={{ from: location, message: 'Session expired. Please login again.' }} replace />;
// }

//   if (!userRole || !allowedRoles.includes(userRole)) {
//     // Redirect to appropriate page based on role
//     switch (userRole) {
//       case 'admin':
//         return <Navigate to="/admin" replace />
//       case 'maker':
//         return <Navigate to="/dashboard" replace />
//       case 'checker':
//         return <Navigate to="/checker" replace />
//       default:
//         return <Navigate to="/" replace />
//     }
//   }

  return <>{children}</>
}

export default ProtectedRoute
