import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

type Props = { children: React.ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const { token, loading } = useAuth();
  if (loading) return <div className="p-6">Загрузка…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
