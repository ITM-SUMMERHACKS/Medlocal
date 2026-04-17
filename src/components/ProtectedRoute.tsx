import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { AppShell } from "./AppShell";

export const ProtectedRoute = ({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: AppRole[];
}) => {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (allow && role && !allow.includes(role)) {
    // route to default landing for the user's role
    const home =
      role === "doctor" ? "/doctor" : role === "pharmacy" ? "/pharmacy" : role === "admin" ? "/admin" : "/app";
    return <Navigate to={home} replace />;
  }
  return <AppShell>{children}</AppShell>;
};
