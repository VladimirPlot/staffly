import React from "react";
import { Routes, Route, Navigate, Link, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./shared/providers/AuthProvider";
import ProtectedRoute from "./shared/routes/ProtectedRoute";
import RequireRestaurant from "./shared/routes/RequireRestaurant";
import PublicOnlyRoute from "./shared/routes/PublicOnlyRoute";
import PageLoader from "./shared/ui/PageLoader";

import Avatar from "./shared/ui/Avatar";
import DropdownMenu from "./shared/ui/DropdownMenu";
import PwaUpdatePrompt from "./shared/pwa/PwaUpdatePrompt";
import { updateMyProfile } from "./features/profile/api";
import { applyThemeToDom, getStoredTheme, setStoredTheme, type Theme } from "./shared/utils/theme";

import { fetchRestaurantName } from "./features/restaurants/api";
import { fetchInboxUnreadCount } from "./features/inbox/api";

import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  MoonStar,
  SunMedium,
  User,
  Wallet,
} from "lucide-react";
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

const TrainingLandingPage = React.lazy(() => import("./features/training/pages/LandingPage"));
const TrainingKnowledgePage = React.lazy(() => import("./features/training/pages/KnowledgePage"));
const TrainingKnowledgeFolderPage = React.lazy(
  () => import("./features/training/pages/KnowledgeFolderPage"),
);
const TrainingQuestionBankRootPage = React.lazy(
  () => import("./features/training/pages/QuestionBankRootPage"),
);
const TrainingQuestionBankFolderPage = React.lazy(
  () => import("./features/training/pages/QuestionBankFolderPage"),
);
const TrainingExamsPage = React.lazy(() => import("./features/training/pages/ExamsPage"));
const TrainingCertificationAnalyticsPage = React.lazy(() => import("./features/training/pages/CertificationAnalyticsPage"));
const TrainingExamRunPage = React.lazy(() => import("./features/training/pages/ExamRunPage"));
const TrainingCertificationMyResultPage = React.lazy(() => import("./features/training/pages/CertificationMyResultPage"));

const RestaurantHome = React.lazy(() => import("./features/home/pages/RestaurantHome"));

const SchedulePage = React.lazy(() => import("./features/schedule/pages/SchedulePage"));
const MasterSchedulesPage = React.lazy(
  () => import("./features/masterSchedule/pages/MasterSchedulesPage"),
);
const MasterScheduleEditorPage = React.lazy(
  () => import("./features/masterSchedule/pages/MasterScheduleEditorPage"),
);

const ChecklistsPage = React.lazy(() => import("./features/checklists/pages/ChecklistsPage"));
const RemindersPage = React.lazy(() => import("./features/reminders/pages/RemindersPage"));
const AnnouncementsPage = React.lazy(
  () => import("./features/announcements/pages/AnnouncementsPage"),
);
const InboxPage = React.lazy(() => import("./features/inbox/pages/InboxPage"));
const ContactsPage = React.lazy(() => import("./features/contacts/pages/ContactsPage"));
const AnonymousLettersPage = React.lazy(
  () => import("./features/anonymousLetters/pages/AnonymousLettersPage"),
);
const PushRedirectPage = React.lazy(() => import("./features/push/pages/PushRedirectPage"));
const TasksPage = React.lazy(() => import("./features/tasks/pages/TasksPage"));

/* ===== TopBar ===== */
function TopBar() {
  const { user, token, logout, refreshMe } = useAuth();
  const restaurantId = user?.restaurantId;
  const hasRestaurant = typeof restaurantId === "number";
  const [restName, setRestName] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);
  const [theme, setTheme] = React.useState<Theme>(() => getStoredTheme() ?? "light");
  const [themeBusy, setThemeBusy] = React.useState(false);
  const [themeMsg, setThemeMsg] = React.useState<string | null>(null);
  const mobileMenuId = React.useId();

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
    if (user?.theme === "light" || user?.theme === "dark") {
      setTheme(user.theme);
    }
  }, [user?.theme]);

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

  const closeMobileMenu = () => setMobileOpen(false);

  const handleThemeChange = React.useCallback(
    async (nextTheme: Theme) => {
      if (themeBusy || nextTheme === theme) return;

      setTheme(nextTheme);
      setThemeMsg(null);
      setStoredTheme(nextTheme);
      applyThemeToDom(nextTheme);
      setThemeBusy(true);

      try {
        await updateMyProfile({ theme: nextTheme });
        await refreshMe();
      } catch {
        setThemeMsg("Тема сохранена локально и синхронизируется позже");
      } finally {
        setThemeBusy(false);
      }
    },
    [refreshMe, theme, themeBusy],
  );

  return (
    <div className="mb-6">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 sm:flex-nowrap sm:items-center">
        <Link to={homeHref} className="ml-1 flex shrink-0 items-center gap-2.5 sm:ml-2">
          <span className="staffly-brand-mark">
            <span className="staffly-brand-text">Staffly</span>
          </span>
          <span className="staffly-release-badge">alpha 3.1.4</span>
        </Link>

        {token ? (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {hasRestaurant && restName && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  to="/app"
                  title="Дом ресторана"
                  className="topbar-link text-default rounded-full border px-3 py-1 text-xs"
                >
                  {restName}
                </Link>
                <Link to="/restaurants" className="text-muted text-xs hover:underline">
                  Сменить ресторан
                </Link>
              </div>
            )}

            <div className="hidden items-center gap-3 sm:flex">
              {hasRestaurant && (
                <Link to="/inbox" aria-label="Входящие">
                  <IconButton badge={unreadCount}>
                    <Icon icon={Bell} size="md" className="text-icon" />
                  </IconButton>
                </Link>
              )}

              {user && (
                <DropdownMenu
                  menuClassName="w-[20rem]"
                  alignClassName="right-0"
                  trigger={({ onClick, ...aria }) => (
                    <button
                      type="button"
                      {...aria}
                      onClick={onClick}
                      className="group border-subtle bg-surface hover:bg-app aria-expanded:bg-surface focus-visible:ring-default flex items-center gap-3 rounded-[1.25rem] border px-3 py-2 text-left shadow-[var(--staffly-shadow)] transition focus-visible:ring-2 focus-visible:outline-none aria-expanded:border-[color:var(--staffly-border)]"
                    >
                      <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-10 w-10" />
                      <div className="min-w-0">
                        <div className="text-default truncate text-sm font-semibold">
                          {user.name}
                        </div>
                        <div className="text-muted truncate text-xs">{user.phone}</div>
                      </div>
                      <Icon
                        icon={ChevronDown}
                        size="sm"
                        className="text-muted transition-transform group-aria-expanded:rotate-180"
                      />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <div className="border-subtle bg-surface w-[20rem] overflow-hidden rounded-[1.5rem] border shadow-[var(--staffly-shadow)]">
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="text-default text-sm font-medium">Тема</div>

                        <div className="border-subtle inline-flex items-center rounded-full border bg-[color:var(--staffly-control)] p-1">
                          <button
                            type="button"
                            disabled={themeBusy}
                            onClick={() => void handleThemeChange("light")}
                            aria-label="Светлая тема"
                            aria-pressed={theme === "light"}
                            className={`focus:ring-default inline-flex h-9 w-9 items-center justify-center rounded-full transition focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                              theme === "light"
                                ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] shadow-[0_6px_14px_rgba(0,0,0,0.18)]"
                                : "text-default hover:bg-[color:var(--staffly-control-hover)]"
                            }`}
                          >
                            <Icon icon={SunMedium} size="sm" />
                          </button>

                          <button
                            type="button"
                            disabled={themeBusy}
                            onClick={() => void handleThemeChange("dark")}
                            aria-label="Тёмная тема"
                            aria-pressed={theme === "dark"}
                            className={`focus:ring-default inline-flex h-9 w-9 items-center justify-center rounded-full transition focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                              theme === "dark"
                                ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] shadow-[0_6px_14px_rgba(0,0,0,0.18)]"
                                : "text-default hover:bg-[color:var(--staffly-control-hover)]"
                            }`}
                          >
                            <Icon icon={MoonStar} size="sm" />
                          </button>
                        </div>
                      </div>

                      {themeMsg && <div className="text-muted px-4 pb-2 text-xs">{themeMsg}</div>}

                      <div className="border-subtle border-t" />

                      <div className="px-2 py-2">
                        <Link
                          to="/me/income"
                          className="group text-default flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-[color:var(--staffly-control-hover)] focus-visible:bg-[color:var(--staffly-control-hover)] focus-visible:outline-none"
                          onClick={close}
                        >
                          <span className="border-subtle text-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-[color:var(--staffly-control)]">
                            <Icon icon={Wallet} size="sm" />
                          </span>
                          <span className="min-w-0 flex-1 text-left text-sm font-medium">
                            Мои доходы
                          </span>
                          <Icon icon={ChevronRight} size="sm" className="text-muted" />
                        </Link>

                        <Link
                          to="/profile"
                          className="group text-default flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-[color:var(--staffly-control-hover)] focus-visible:bg-[color:var(--staffly-control-hover)] focus-visible:outline-none"
                          onClick={close}
                        >
                          <span className="border-subtle text-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-[color:var(--staffly-control)]">
                            <Icon icon={User} size="sm" />
                          </span>
                          <span className="min-w-0 flex-1 text-left text-sm font-medium">
                            Профиль
                          </span>
                          <Icon icon={ChevronRight} size="sm" className="text-muted" />
                        </Link>

                        <div className="border-subtle mt-1 border-t pt-1">
                          <button
                            type="button"
                            className="group text-default flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[color:var(--staffly-control-hover)] focus-visible:bg-[color:var(--staffly-control-hover)] focus-visible:outline-none"
                            onClick={() => {
                              close();
                              logout();
                            }}
                          >
                            <span className="border-subtle text-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-[color:var(--staffly-control)]">
                              <Icon icon={LogOut} size="sm" />
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-medium">Выйти</span>
                            <Icon icon={ChevronRight} size="sm" className="text-muted" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </DropdownMenu>
              )}
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
                className="border-subtle bg-surface text-default hover:bg-app ring-default inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-sm font-medium shadow-[var(--staffly-shadow)] focus:ring-2 focus:outline-none"
                aria-label="Открыть меню"
                aria-controls={mobileMenuId}
                aria-haspopup="menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
              >
                <Icon icon={Menu} size="md" className="text-icon" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-muted w-full pl-1 text-left text-sm sm:w-auto sm:pl-0 sm:text-right">
            Войдите, чтобы продолжить
          </div>
        )}
      </header>

      {token && mobileOpen && (
        <nav
          id={mobileMenuId}
          aria-label="Мобильное меню"
          className="border-subtle bg-surface mt-3 overflow-hidden rounded-[1.75rem] border shadow-[var(--staffly-shadow)] sm:hidden"
        >
          <div className="border-subtle bg-surface border-b p-4">
            {user && (
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-11 w-11" />
                  <div className="min-w-0">
                    <div className="text-default truncate text-sm font-semibold">{user.name}</div>
                    <div className="text-muted truncate text-xs">{user.phone}</div>
                  </div>
                </div>

                <div className="border-subtle inline-flex items-center rounded-full border bg-[color:var(--staffly-control)] p-1">
                  <button
                    type="button"
                    disabled={themeBusy}
                    onClick={() => void handleThemeChange("light")}
                    aria-label="Светлая тема"
                    aria-pressed={theme === "light"}
                    className={`focus:ring-default inline-flex h-9 w-9 items-center justify-center rounded-full transition focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                      theme === "light"
                        ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] shadow-[0_6px_14px_rgba(0,0,0,0.18)]"
                        : "text-default hover:bg-[color:var(--staffly-control-hover)]"
                    }`}
                  >
                    <Icon icon={SunMedium} size="sm" />
                  </button>

                  <button
                    type="button"
                    disabled={themeBusy}
                    onClick={() => void handleThemeChange("dark")}
                    aria-label="Тёмная тема"
                    aria-pressed={theme === "dark"}
                    className={`focus:ring-default inline-flex h-9 w-9 items-center justify-center rounded-full transition focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                      theme === "dark"
                        ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] shadow-[0_6px_14px_rgba(0,0,0,0.18)]"
                        : "text-default hover:bg-[color:var(--staffly-control-hover)]"
                    }`}
                  >
                    <Icon icon={MoonStar} size="sm" />
                  </button>
                </div>
              </div>
            )}

            {hasRestaurant && restName && (
              <div className="border-subtle bg-app mt-3 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2">
                <Link
                  to="/app"
                  className="topbar-link text-default inline-flex items-center rounded-full border px-3 py-1 text-xs"
                  onClick={closeMobileMenu}
                >
                  {restName}
                </Link>
                <Link
                  to="/restaurants"
                  className="text-muted text-xs hover:underline"
                  onClick={closeMobileMenu}
                >
                  Сменить ресторан
                </Link>
              </div>
            )}
          </div>

          <div className="p-2">
            <Link
              to="/me/income"
              className="group text-default flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-[color:var(--staffly-control-hover)] focus-visible:bg-[color:var(--staffly-control-hover)] focus-visible:outline-none"
              onClick={closeMobileMenu}
            >
              <span className="border-subtle text-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-[color:var(--staffly-control)]">
                <Icon icon={Wallet} size="sm" />
              </span>
              <span className="min-w-0 flex-1 text-left text-sm font-medium">Мои доходы</span>
              <Icon icon={ChevronRight} size="sm" className="text-muted" />
            </Link>

            <Link
              to="/profile"
              className="group text-default flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-[color:var(--staffly-control-hover)] focus-visible:bg-[color:var(--staffly-control-hover)] focus-visible:outline-none"
              onClick={closeMobileMenu}
            >
              <span className="border-subtle text-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-[color:var(--staffly-control)]">
                <Icon icon={User} size="sm" />
              </span>
              <span className="min-w-0 flex-1 text-left text-sm font-medium">Профиль</span>
              <Icon icon={ChevronRight} size="sm" className="text-muted" />
            </Link>

            {themeMsg && <div className="text-muted mt-2 px-1 text-xs">{themeMsg}</div>}

            <div className="border-subtle mt-2 border-t pt-2">
              <button
                type="button"
                className="group text-default flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[color:var(--staffly-control-hover)] focus-visible:bg-[color:var(--staffly-control-hover)] focus-visible:outline-none"
                onClick={() => {
                  closeMobileMenu();
                  logout();
                }}
              >
                <span className="border-subtle text-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-[color:var(--staffly-control)]">
                  <Icon icon={LogOut} size="sm" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">Выйти</span>
                <Icon icon={ChevronRight} size="sm" className="text-muted" />
              </button>
            </div>
          </div>
        </nav>
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
    <main className="bg-app min-h-screen px-1.5 py-3 sm:p-4">
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
              path="/training/knowledge"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingKnowledgePage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/knowledge/:folderId"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingKnowledgeFolderPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/question-bank"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingQuestionBankRootPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/question-bank/:folderId"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingQuestionBankFolderPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/exams"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingExamsPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/exams/:examId/analytics"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingCertificationAnalyticsPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/exams/:examId/run"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingExamRunPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/exams/:examId/result"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingCertificationMyResultPage />
                  </RequireRestaurant>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/knowledge/:folderId/exams/:examId/run"
              element={
                <ProtectedRoute>
                  <RequireRestaurant>
                    <TrainingExamRunPage />
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
