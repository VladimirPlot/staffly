import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./shared/providers/AuthProvider";
import ProtectedRoute from "./shared/routes/ProtectedRoute";
import RequireRestaurant from "./shared/routes/RequireRestaurant";

import LoginRegister from "./features/auth/pages/LoginRegister";
import Restaurants from "./features/restaurants/pages/Restaurants";
import CreateRestaurant from "./features/restaurants/pages/CreateRestaurant";
import Profile from "./features/profile/pages/Profile";
import InvitePage from "./features/employees/pages/Invite";

import Avatar from "./shared/ui/Avatar";
import Button from "./shared/ui/Button";

import { fetchRestaurantName } from "./features/restaurants/api";
import PositionsPage from "./features/dictionaries/pages/Positions";
import TrainingLandingPage from "./features/training/pages/Landing";
import TrainingModuleCategoriesPage from "./features/training/pages/Categories";
import TrainingCategoryItemsPage from "./features/training/pages/CategoryItems";
import RestaurantHome from "./features/home/pages/RestaurantHome";
import SchedulePage from "./features/schedule/pages/SchedulePage";

/* ===== TopBar ===== */
function TopBar() {
  const { user, token, logout } = useAuth();
  const [restName, setRestName] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (user?.restaurantId) {
        try {
          const name = await fetchRestaurantName(user.restaurantId);
          if (alive) setRestName(name);
        } catch {
          if (alive) setRestName(null);
        }
      } else {
        setRestName(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.restaurantId]);

  const homeHref = token ? (user?.restaurantId ? "/app" : "/restaurants") : "/login";

  return (
    <header className="mb-6 flex items-center justify-between">
      <Link to={homeHref} className="flex items-center gap-2">
        <span className="text-xl font-semibold">Staffly</span>
        <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
          alpha
        </span>
      </Link>

      {token ? (
        <div className="flex items-center gap-3">
          {user?.restaurantId && restName && (
            <div className="hidden items-center gap-2 sm:flex">
              {/* бейдж теперь ведёт на «дом ресторана» */}
              <Link
                to="/app"
                title="Дом ресторана"
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
              >
                {restName}
              </Link>
              {/* тонкая ссылка для смены ресторана */}
              <Link to="/restaurants" className="text-xs text-zinc-600 hover:underline">
                сменить
              </Link>
            </div>
          )}

          {user && (
            <>
              <Avatar name={user.name} imageUrl={user.avatarUrl} />
              <div className="hidden text-sm leading-tight sm:block">
                <div className="font-medium">{user.name}</div>
                <div className="text-zinc-500">{user.phone}</div>
              </div>
            </>
          )}

          {/* ВЕРХНЕЕ меню минималистичное: оставили только профиль и выход */}
          <Link to="/profile">
            <Button variant="outline">Профиль</Button>
          </Link>
          <Button variant="ghost" onClick={logout}>
            Выйти
          </Button>
        </div>
      ) : (
        <div className="text-sm text-zinc-600">Войдите, чтобы продолжить</div>
      )}
    </header>
  );
}

/* редирект корня в нужное место в зависимости от состояния */
function LandingRedirect() {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={user?.restaurantId ? "/app" : "/restaurants"} replace />;
}

/* ===== App ===== */
export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 p-4">
      <div className="mx-auto max-w-5xl">
        <AuthProvider>
          <TopBar />

          <Routes>
            <Route path="/login" element={<LoginRegister />} />

            {/* Дом выбранного ресторана */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <RestaurantHome />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />

            {/* Разделы внутри ресторана */}
            <Route
              path="/dictionaries/positions"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <PositionsPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingLandingPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/:module"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingModuleCategoriesPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/:module/categories/:categoryId"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingCategoryItemsPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />

            <Route
              path="/schedule"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <SchedulePage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />

            {/* Список ресторанов и профиль */}
            <Route
              path="/restaurants"
              element={
                <ProtectedRoute>
                  <Restaurants />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurants/new"
              element={
                <ProtectedRoute>
                  <CreateRestaurant />
                </ProtectedRoute>
              }
            />

            <Route
              path="/employees/invite"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <InvitePage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Корень и «хвосты» */}
            <Route path="/" element={<LandingRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </div>
    </main>
  );
}
