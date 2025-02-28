import { Routes, Route, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import { VerifyOTPPage } from "./pages/VerifyOTPPage";
import DashboardPage from "./pages/DashBoardPage";
import AdminPage from "./pages/AdminPage";
import TablesPage from "./pages/TablesPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import CheckerPage from "@/pages/CheckerPage";
import { Overview, History, TableRequests } from "@/components/checker";
import { RowRequestManager } from "./components/admin";
import { Toaster } from "./components/ui/toaster";
import { useEffect } from "react";
import { toast } from "./hooks/use-toast";

const App: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Store the original fetch
    const originalFetch = window.fetch;

    // Override fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 401) {
        toast({
          title: "Error",
          description: "Session expired, please login again",
        });
        navigate("/login"); // Redirect to login page
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch; // Restore original fetch on unmount
    };
  }, [navigate]);

  return (
    <>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-otp" element={<VerifyOTPPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["maker"]}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/row-requests"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <RowRequestManager />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tables"
            element={
              <ProtectedRoute allowedRoles={["maker", "checker", "admin"]}>
                <TablesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checker/*"
            element={
              <ProtectedRoute allowedRoles={["checker"]}>
                <CheckerPage />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="history" element={<History />} />
            <Route path="table/:tableName" element={<TableRequests />} />
          </Route>
        </Routes>
      </ErrorBoundary>
      <Toaster />
    </>
  );
};

export default App;
