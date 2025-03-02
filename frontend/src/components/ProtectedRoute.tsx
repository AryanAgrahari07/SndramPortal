import type React from "react";
import { Navigate } from "react-router-dom";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { useEffect } from "react";
import { setupAxiosInterceptors } from "@/utils/apiInterceptors";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
// import { useEffect, useState } from "react";
// import { useAuthStore } from "@/store/authStore";
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("userRole")?.toLowerCase();
  // const { clearAuth } = useAuthStore();
  // const navigate = useNavigate();
  // const [isValidSession, setIsValidSession] = useState(true);


  useTokenRefresh();

  useInactivityTimeout();

  useEffect(() => {
    setupAxiosInterceptors();
  }, []);

  // Session validation logic
  // useEffect(() => {
  //   const validateSession = async () => {
  //     if (!token) {
  //       setIsValidSession(false);
  //       return;
  //     }

  //     const isValid = await checkSession(token);
  //     setIsValidSession(isValid);

  //     if (!isValid) {
  //       clearAuth(); // Clear auth state if session is invalid
  //       navigate("/"); // Redirect to home or login page
  //     }
  //   };
  //   // Run session validation immediately
  //   validateSession();

  //   // Set up an interval to validate the session every 3 seconds
  //   const intervalId = setInterval(validateSession, 3000);

  //   // Clean up the interval when the component unmounts
  //   return () => clearInterval(intervalId);
  // }, [token, navigate, clearAuth]);


  if (!token ) {
    return <Navigate to="/" replace />;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    // Redirect to appropriate page based on role
    switch (userRole) {
      case "admin":
        return <Navigate to="/admin" replace />;
      case "maker":
        return <Navigate to="/dashboard" replace />;
      case "checker":
        return <Navigate to="/checker" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
