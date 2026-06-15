import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500" data-testid="auth-loading">
        Carregando...
      </div>
    );
  }
  if (!user) return <Navigate to={requireAdmin ? "/admin/login" : "/login"} replace />;
  if (requireAdmin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
