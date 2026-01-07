import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./shared/providers/AuthProvider";
import ProtectedRoute from "./shared/routes/ProtectedRoute";
import RequireRestaurant from "./shared/routes/RequireRestaurant";
import PublicOnlyRoute from "./shared/routes/PublicOnlyRoute";

import LoginRegister from "./features/auth/pages/LoginRegister";
import Restaurants from "./features/restaurants/pages/Restaurants";
import CreateRestaurant from "./features/restaurants/pages/CreateRestaurant";
import Profile from "./features/profile/pages/Profile";
import InvitePage from "./features/employees/pages/Invite";
import IncomeListPage from "./features/income/pages/IncomeListPage";
import IncomePeriodPage from "./features/income/pages/IncomePeriodPage";
import NotesPage from "./features/income/pages/NotesPage";

import Avatar from "./shared/ui/Avatar";
import Button from "./shared/ui/Button";

import { fetchRestaurantName } from "./features/restaurants/api";
import PositionsPage from "./features/dictionaries/pages/Positions";
import TrainingLandingPage from "./features/training/pages/Landing";
import TrainingModuleCategoriesPage from "./features/training/pages/Categories";
import TrainingCategoryItemsPage from "./features/training/pages/CategoryItems";
import RestaurantHome from "./features/home/pages/RestaurantHome";
import SchedulePage from "./features/schedule/pages/SchedulePage";
import ChecklistsPage from "./features/checklists/pages/ChecklistsPage";
import NotificationsPage from "./features/notifications/pages/NotificationsPage";
import ContactsPage from "./features/contacts/pages/ContactsPage";
import AnonymousLettersPage from "./features/anonymousLetters/pages/AnonymousLettersPage";

import { Menu } from "lucide-react";
import Icon from "./shared/ui/Icon";

/* ===== TopBar ===== */
function TopBar() {
  const { user, token, logout } = useAuth();
  const [restName, setRestName] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);

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

  // закрывать меню при смене токена/пользователя/ресторана
  React.useEffect(() => {
    setMobileOpen(false);
  }, [token, user?.restaurantId]);

  const homeHref = token ? (user?.restaurantId ? "/app" : "/restaurants") : "/login";

  return (
    <div className="mb-6">
      <header className="flex items-center justify-between gap-3">
        <Link to={homeHref} className="flex items-center gap-2">
          <span className="text-xl font-semibold">Staffly</span>
          <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
            alpha
          </span>
        </Link>

        {token ? (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* ====== DESKTOP (sm+) ====== */}
            {user?.restaurantId && restName && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  to="/app"
                  title="Дом ресторана"
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
                >
                  {restName}
                </Link>
                <Link to="/restaurants" className="text-xs text-zinc-600 hover:underline">
                  Сменить ресторан
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

            <div className="hidden items-center gap-3 sm:flex">
              <Link to="/me/income">
                <Button variant="outline">Мои доходы</Button>
              </Link>
              <Link to="/profile">
                <Button variant="outline">Профиль</Button>
              </Link>
              <Button variant="ghost" onClick={logout}>
                Выйти
              </Button>
            </div>

            {/* ====== MOBILE (до sm) ====== */}
            <button
              type="button"
              className="sm:hidden rounded-2xl border border-zinc-300 px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 inline-flex items-center justify-center"
              aria-label="Открыть меню"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <Icon icon={Menu} size="md" className="text-zinc-900" />
            </button>
          </div>
        ) : (
          <div className="text-sm text-zinc-600">Войдите, чтобы продолжить</div>
        )}
      </header>

      {/* ===== Mobile dropdown menu ===== */}
      {token && mobileOpen && (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:hidden">
          {user?.restaurantId && restName && (
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link
                to="/app"
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
                onClick={() => setMobileOpen(false)}
              >
                {restName}
              </Link>
              <Link
                to="/restaurants"
                className="text-xs text-zinc-600 hover:underline"
                onClick={() => setMobileOpen(false)}
              >
                Сменить ресторан
              </Link>
            </div>
          )}

          {user && (
            <div className="mb-3 text-sm">
              <div className="font-medium">{user.name}</div>
              <div className="text-zinc-500">{user.phone}</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Link
              to="/me/income"
              className="rounded-xl px-3 py-2 hover:bg-zinc-50"
              onClick={() => setMobileOpen(false)}
            >
              Мои доходы
            </Link>
            <Link
              to="/profile"
              className="rounded-xl px-3 py-2 hover:bg-zinc-50"
              onClick={() => setMobileOpen(false)}
            >
              Профиль
            </Link>
            <button
              className="rounded-xl px-3 py-2 text-left hover:bg-zinc-50"
              onClick={() => {
                setMobileOpen(false);
                logout();
              }}
            >
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
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
      <div className="mx-auto w-full max-w-5xl">
        <AuthProvider>
          <TopBar />

          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginRegister />
                </PublicOnlyRoute>
              }
            />

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

            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <NotificationsPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />

            <Route
              path="/checklists"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <ChecklistsPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />

            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <ContactsPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />

            <Route
              path="/anonymous-letter"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <AnonymousLettersPage />
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

            <Route
              path="/me/income"
              element={
                <ProtectedRoute>
                  <IncomeListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/me/income/periods/:periodId"
              element={
                <ProtectedRoute>
                  <IncomePeriodPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/me/notes"
              element={
                <ProtectedRoute>
                  <NotesPage />
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
