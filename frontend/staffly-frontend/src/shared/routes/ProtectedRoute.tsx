import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import PageLoader from "../ui/PageLoader";

type Props = { children: React.ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const { token, loading } = useAuth();
  if (loading) return <PageLoader label="Загрузка…" delayMs={200} />;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
