import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken) => {
        // Update Zustand state
        set({ accessToken });

        // Maintain localStorage compatibility
        localStorage.setItem("token", accessToken);
      },
      setUser: (user) => {
        set({ user });
        // Maintain localStorage compatibility
        localStorage.setItem("user", JSON.stringify(user));
      },
      clearAuth: () => {
        set({ accessToken: null, refreshToken: null, user: null });
        // Clear localStorage
        localStorage.removeItem("token");      
        localStorage.removeItem("user");
      },
    }),
    {
      name: "auth-storage",
    }
  )
);

// Helper function to initialize store from localStorage
// export const isAuthenticated = () => {
//   const token = localStorage.getItem("token");
//   const refreshToken = localStorage.getItem("refreshToken");
//   return !!token && !!refreshToken;
// };
