import React from "react";
import { Routes, Route, Navigate, Link, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./shared/providers/AuthProvider";
import ProtectedRoute from "./shared/routes/ProtectedRoute";
import RequireRestaurant from "./shared/routes/RequireRestaurant";
import PublicOnlyRoute from "./shared/routes/PublicOnlyRoute";
import PageLoader from "./shared/ui/PageLoader";

import Avatar from "./shared/ui/Avatar";
import Button from "./shared/ui/Button";
import PwaUpdatePrompt from "./shared/pwa/PwaUpdatePrompt";

import { fetchRestaurantName } from "./features/restaurants/api";
import { fetchInboxUnreadCount } from "./features/inbox/api";

import { Bell, Menu } from "lucide-react";
import Icon from "./shared/ui/Icon";
import IconButton from "./shared/ui/IconButton";

/* ===== Lazy pages ===== */
const LoginRegister = React.lazy(() => import("./features/auth/pages/LoginRegister"));
const Restaurants = React.lazy(() => import("./features/restaurants/pages/Restaurants"));
const CreateRestaurant = React.lazy(() => import("./features/restaurants/pages/CreateRestaurant"));
const Profile = React.lazy(() => import("./features/profile/pages/Profile"));
const InvitePage = React.lazy(() => import("./features/employees/pages/Invite"));

const IncomeListPage = React.lazy(() => import("./features/income/pages/IncomeListPage"));
const IncomePeriodPage = React.lazy(() => import("./features/income/pages/IncomePeriodPage"));
const NotesPage = React.lazy(() => import("./features/income/pages/NotesPage"));

const PositionsPage = React.lazy(() => import("./features/dictionaries/pages/Positions"));

const TrainingLandingPage = React.lazy(() => import("./features/training/pages/Landing"));
const TrainingModuleCategoriesPage = React.lazy(() => import("./features/training/pages/Categories"));
const TrainingCategoryItemsPage = React.lazy(() => import("./features/training/pages/CategoryItems"));

const RestaurantHome = React.lazy(() => import("./features/home/pages/RestaurantHome"));

const SchedulePage = React.lazy(() => import("./features/schedule/pages/SchedulePage"));
const MasterSchedulesPage = React.lazy(() => import("./features/masterSchedule/pages/MasterSchedulesPage"));
const MasterScheduleEditorPage = React.lazy(
  () => import("./features/masterSchedule/pages/MasterScheduleEditorPage"),
);

const ChecklistsPage = React.lazy(() => import("./features/checklists/pages/ChecklistsPage"));
const RemindersPage = React.lazy(() => import("./features/reminders/pages/RemindersPage"));
const AnnouncementsPage = React.lazy(() => import("./features/announcements/pages/AnnouncementsPage"));
const InboxPage = React.lazy(() => import("./features/inbox/pages/InboxPage"));
const ContactsPage = React.lazy(() => import("./features/contacts/pages/ContactsPage"));
const AnonymousLettersPage = React.lazy(() => import("./features/anonymousLetters/pages/AnonymousLettersPage"));
const PushRedirectPage = React.lazy(() => import("./features/push/pages/PushRedirectPage"));
const TasksPage = React.lazy(() => import("./features/tasks/pages/TasksPage"));

/* ===== TopBar ===== */
function TopBar() {
  const { user, token, logout } = useAuth();
  const restaurantId = user?.restaurantId;
  const hasRestaurant = typeof restaurantId === "number";
  const [restName, setRestName] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (hasRestaurant) {
        try {
          const name = await fetchRestaurantName(restaurantId);
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
  }, [hasRestaurant, restaurantId]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [token, restaurantId]);

  React.useEffect(() => {
    let alive = true;

    const loadUnreadCount = async () => {
      if (!hasRestaurant) {
        if (alive) setUnreadCount(0);
        return;
      }
      try {
        const data = await fetchInboxUnreadCount(restaurantId);
        if (!alive) return;
        setUnreadCount(data.count);
      } catch {
        if (!alive) return;
        setUnreadCount(0);
      }
    };

    void loadUnreadCount();

    const handleInboxChanged = () => void loadUnreadCount();

    window.addEventListener("inbox:changed", handleInboxChanged);
    return () => {
      alive = false;
      window.removeEventListener("inbox:changed", handleInboxChanged);
    };
  }, [hasRestaurant, restaurantId]);

  const homeHref = token ? (hasRestaurant ? "/app" : "/restaurants") : "/login";

  return (
    <div className="mb-6">
      <header className="flex items-center justify-between gap-3">
        <Link to={homeHref} className="flex items-center gap-2">
          <span className="text-xl font-semibold text-strong">Staffly</span>
          <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
            alpha 2.4.1
          </span>
        </Link>

        {token ? (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {hasRestaurant && restName && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  to="/app"
                  title="Дом ресторана"
                  className="topbar-link rounded-full border px-3 py-1 text-xs text-default"
                >
                  {restName}
                </Link>
                <Link to="/restaurants" className="text-xs text-muted hover:underline">
                  Сменить ресторан
                </Link>
              </div>
            )}

            {user && (
              <>
                <Avatar name={user.name} imageUrl={user.avatarUrl} />
                <div className="hidden text-sm leading-tight sm:block">
                  <div className="font-medium text-default">{user.name}</div>
                  <div className="text-muted">{user.phone}</div>
                </div>
              </>
            )}

            <div className="hidden items-center gap-3 sm:flex">
              {hasRestaurant && (
                <Link to="/inbox" aria-label="Входящие">
                  <IconButton badge={unreadCount}>
                    <Icon icon={Bell} size="md" className="text-icon" />
                  </IconButton>
                </Link>
              )}
              <Link to="/me/income">
                <Button variant="outline">Мои доходы</Button>
              </Link>
              <Link to="/profile">
                <Button variant="outline">Профиль</Button>
              </Link>
              <Button variant="outline" onClick={logout}>
                Выйти
              </Button>
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              {hasRestaurant && (
                <Link to="/inbox" aria-label="Входящие">
                  <IconButton badge={unreadCount}>
                    <Icon icon={Bell} size="md" className="text-icon" />
                  </IconButton>
                </Link>
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl border border-subtle bg-surface px-3 py-2 text-sm font-medium text-default shadow-[var(--staffly-shadow)] hover:bg-app focus:outline-none focus:ring-2 ring-default"
                aria-label="Открыть меню"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
              >
                <Icon icon={Menu} size="md" className="text-icon" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">Войдите, чтобы продолжить</div>
        )}
      </header>

      {token && mobileOpen && (
        <div className="mt-3 rounded-2xl border border-subtle bg-surface p-3 shadow-[var(--staffly-shadow)] sm:hidden">
          {hasRestaurant && restName && (
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link
                to="/app"
                className="topbar-pill rounded-full border px-3 py-1 text-xs text-default"
                onClick={() => setMobileOpen(false)}
              >
                {restName}
              </Link>
              <Link
                to="/restaurants"
                className="text-xs text-muted hover:underline"
                onClick={() => setMobileOpen(false)}
              >
                Сменить ресторан
              </Link>
            </div>
          )}

          {user && (
            <div className="mb-3 text-sm">
              <div className="font-medium text-default">{user.name}</div>
              <div className="text-muted">{user.phone}</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Link
              to="/me/income"
              className="rounded-xl px-3 py-2 text-default hover:bg-app"
              onClick={() => setMobileOpen(false)}
            >
              Мои доходы
            </Link>
            <Link
              to="/profile"
              className="rounded-xl px-3 py-2 text-default hover:bg-app"
              onClick={() => setMobileOpen(false)}
            >
              Профиль
            </Link>
            <button
              className="rounded-xl px-3 py-2 text-left text-default hover:bg-app"
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

/* редирект корня */
function LandingRedirect() {
  const { token, user, loading } = useAuth();

  if (loading) return <PageLoader label="Загрузка…" delayMs={200} />;
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={user?.restaurantId ? "/app" : "/restaurants"} replace />;
}

/* ===== Layouts ===== */

function AppShell() {
  return (
    <main className="min-h-screen bg-app px-1.5 py-3 sm:p-4">
      <React.Suspense fallback={<PageLoader delayMs={200} />}>
        <Outlet />
      </React.Suspense>
      <PwaUpdatePrompt />
    </main>
  );
}

function NarrowLayout() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <TopBar />
      <Outlet />
    </div>
  );
}

function WideLayout() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <TopBar />
      <Outlet />
    </div>
  );
}

/* ===== App ===== */
export default function App() {
  return (
    <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            {/* WIDE: графики */}
            <Route element={<WideLayout />}>
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
                path="/master-schedules"
                element={
                  <ProtectedRoute>
                    <RequireRestaurant>
                      <MasterSchedulesPage />
                    </RequireRestaurant>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master-schedules/:id"
                element={
                  <ProtectedRoute>
                    <RequireRestaurant>
                      <MasterScheduleEditorPage />
                    </RequireRestaurant>
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* NARROW: всё остальное */}
            <Route element={<NarrowLayout />}>
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <LoginRegister />
                  </PublicOnlyRoute>
                }
              />

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
                path="/inbox"
                element={
                  <ProtectedRoute>
                    <RequireRestaurant>
                      <InboxPage />
                    </RequireRestaurant>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/announcements"
                element={
                  <ProtectedRoute>
                    <RequireRestaurant>
                      <AnnouncementsPage />
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
                path="/reminders"
                element={
                  <ProtectedRoute>
                    <RequireRestaurant>
                      <RemindersPage />
                    </RequireRestaurant>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <RequireRestaurant>
                      <TasksPage />
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
                path="/push"
                element={
                  <ProtectedRoute>
                    <PushRedirectPage />
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

              <Route path="/" element={<LandingRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
    </AuthProvider>
  );
}
