import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

type Props = { children: React.ReactNode };

export default function RequireRestaurant({ children }: Props) {
  const { user } = useAuth();
  if (!user?.restaurantId) return <Navigate to="/restaurants" replace />;
  return <>{children}</>;
}
