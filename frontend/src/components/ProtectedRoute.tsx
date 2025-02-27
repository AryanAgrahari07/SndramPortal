import type React from 'react'
import { Navigate } from 'react-router-dom'
// import { isAuthenticated } from '@/store/authStore'
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: string[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token')
  const userRole = localStorage.getItem('userRole')?.toLowerCase()
  // const location = useLocation();

  useTokenRefresh();

  // if (!isAuthenticated()) {
  //   return <Navigate to="/login" state={{ from: location }} replace />;
  // }

  if (!token) {
    return <Navigate to="/" replace />
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    // Redirect to appropriate page based on role
    switch (userRole) { 
      case 'admin':
        return <Navigate to="/admin" replace />
      case 'maker':
        return <Navigate to="/dashboard" replace />
      case 'checker':
        return <Navigate to="/checker" replace />
      default:
        return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute