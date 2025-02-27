import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { API_URL } from "@/config/constants";

const REFRESH_BUFFER_TIME = 20; // seconds before expiry to refresh
const CHECK_INTERVAL = 10; // check every 5 seconds

export const useTokenRefresh = () => {
  const navigate = useNavigate();
  const { accessToken, refreshToken, setTokens, clearAuth } = useAuthStore();

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
        // Check if refresh token is expired
        if (refreshToken && isTokenExpired(refreshToken)) {
          console.log("Refresh token expired");
          clearAuth();
          navigate("/login");
          return false;
        }
        // console.log(refreshToken);
        // console.log(accessToken);

        const response = await fetch(`${API_URL}/refresh-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to refresh token");
        }

        const data = await response.json();
        if (data.success) {
          //   console.log(" refresh token data is", data);
          console.log("Token refreshed successfully");
          //   setTokens(data.accessToken, refreshToken || "");
          setTokens(data.token, data.refreshToken);
          localStorage.setItem("token", data.token);
          localStorage.setItem("refreshToken", data.refreshToken);

          //   localStorage.setItem("token", data.accessToken);
          //   console.log(data.token);
          //   console.log(data.refreshToken);
          //   console.log(localStorage.getItem("userRole"));

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
      if (!accessToken || !refreshToken) {
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
  }, [accessToken, refreshToken, setTokens, clearAuth, navigate]);
};
