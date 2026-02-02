import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

type Props = { children: React.ReactNode };

export default function PublicOnlyRoute({ children }: Props) {
  const { token } = useAuth();

  // ВАЖНО: public страницы не должны блокироваться init/loading
  // Если refresh восстановит сессию — token появится и нас редиректнет.
  if (token) return <Navigate to="/restaurants" replace />;

  return <>{children}</>;
}
