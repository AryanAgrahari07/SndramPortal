import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { API_URL } from "@/config/constants";

const REFRESH_BUFFER_TIME = 20; // seconds before expiry to refresh
const CHECK_INTERVAL = 10; // check every 5 seconds

// export const checkSession = async (accessToken: string | null) => {
//   const response = await fetch("/check-session", {
//     method: "GET",
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//     },
//     credentials: "include", // Include cookies for session-based auth
//     cache: "no-store",
//   });
//   return response.ok;
// };

export const useTokenRefresh = () => {
  const navigate = useNavigate();
  const { accessToken, setTokens, clearAuth } = useAuthStore();

  useEffect(() => {
    // Function to decode JWT and get expiration time
    const getTokenExpirationTime = (token: string): number => {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp;
      } catch {
        return 0;
      }
    };

    // Function to check if token needs refresh
    const needsRefresh = (token: string): boolean => {
      try {
        const expirationTime = getTokenExpirationTime(token);
        const currentTime = Math.floor(Date.now() / 1000); // Convert to seconds

        // Return true if token will expire within REFRESH_BUFFER_TIME seconds
        return expirationTime - currentTime <= REFRESH_BUFFER_TIME;
      } catch {
        return true;
      }
    };

    // Function to check if token is completely expired
    const isTokenExpired = (token: string): boolean => {
      try {
        const expirationTime = getTokenExpirationTime(token);
        const currentTime = Math.floor(Date.now() / 1000);
        return currentTime >= expirationTime;
      } catch {
        return true;
      }
    };

    // Function to refresh the token
    const refreshAccessToken = async (): Promise<boolean> => {
      try {
    
        const response = await fetch(`${API_URL}/refresh-token`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer`,
          },
        });

        if (!response.ok) {
          // console.log("Refresh token expired");
          clearAuth();
          navigate("/login");
          throw new Error("Failed to refresh token");
        }
        else{
          console.log("Token refreshed successfully");
        }

        const data = await response.json();
        if (data.success) {
          setTokens(data.token);
          localStorage.setItem("token", data.token);

          return true;
        }
        return false;
      } catch (error) {
        console.error("Token refresh failed:", error);
        return false;
      }
    };

    // Main token check and refresh logic
    const checkAndRefreshToken = async () => {
      if (!accessToken ) {
        return;
      }

      // If access token is completely expired
      if (isTokenExpired(accessToken)) {
        console.log("Access token expired, attempting refresh");
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          clearAuth();
          navigate("/login");
        }
        return;
      }

      // If access token needs proactive refresh
      if (needsRefresh(accessToken)) {
        console.log("Access token near expiry, refreshing proactively");
        await refreshAccessToken();
      }
    };

    // Initial check
    checkAndRefreshToken();

    // Set up interval to check token periodically
    const intervalId = setInterval(checkAndRefreshToken, CHECK_INTERVAL * 1000);

    return () => clearInterval(intervalId);
  }, [accessToken, setTokens, clearAuth, navigate]);
};
