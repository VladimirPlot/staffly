import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import PageLoader from "../ui/PageLoader";

type Props = { children: React.ReactNode };

export default function RequireRestaurant({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user?.restaurantId) return <Navigate to="/restaurants" replace />;

  return <>{children}</>;
}
