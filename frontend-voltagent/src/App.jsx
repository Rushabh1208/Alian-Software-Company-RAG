import { useEffect, useMemo, useState } from "react";
import { siteNav } from "./components/marketing/siteContent";
import { SiteFooter } from "./components/layout/SiteFooter";
import { SiteHeader } from "./components/layout/SiteHeader";
import { HomePage } from "./pages/Home";
import { FeaturesPage } from "./pages/Features";
import { PricingPage } from "./pages/Pricing";
import { DocsPage } from "./pages/Docs";
import { AboutPage } from "./pages/About";
import { LoginPage } from "./pages/auth/Login";
import { SignupPage } from "./pages/auth/Signup";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { DashboardPage } from "./pages/dashboard/Dashboard";
import { ChatPage } from "./pages/dashboard/Chat";
import { PromptSettingsPage } from "./pages/dashboard/PromptSettings";
import { WebsitesPage } from "./pages/dashboard/Websites";
import { WidgetsPage } from "./pages/dashboard/Widgets";
import { ChatbotSettingsPage } from "./pages/dashboard/ChatbotSettings";
import { ConversationsPage } from "./pages/dashboard/Conversations";
import { AnalyticsPage } from "./pages/dashboard/Analytics";
import { ProfilePage } from "./pages/dashboard/Profile";
import { AdminDashboardLayout } from "./components/admin/AdminDashboardLayout";
import { AdminOverviewPage } from "./pages/admin/Overview";
import { AdminUsersPage } from "./pages/admin/Users";
import { AdminWebsitesPage } from "./pages/admin/Websites";
import { AdminAnalyticsPage } from "./pages/admin/Analytics";
import { AdminSystemHealthPage } from "./pages/admin/SystemHealth";
import { AdminSubscriptionsPage } from "./pages/admin/Subscriptions";
import { AdminSettingsPage } from "./pages/admin/Settings";
import {
  clearStoredAuth,
  getSessionApi,
  getStoredRefreshToken,
  loadStoredAuth,
  loginApi,
  logoutApi,
  refreshSessionApi,
  registerApi,
  setStoredAuth,
} from "./lib/api";
import { getRoleFromToken, hasValidToken } from "./lib/auth";

const routes = {
  "/": HomePage,
  "/features": FeaturesPage,
  "/pricing": PricingPage,
  "/docs": DocsPage,
  "/about": AboutPage,
  "/login": LoginPage,
  "/signup": SignupPage,
};

const dashboardRoutes = {
  "/dashboard": DashboardPage,
  "/dashboard/websites": WebsitesPage,
  "/dashboard/widgets": WidgetsPage,
  "/dashboard/chatbot-settings": ChatbotSettingsPage,
  "/dashboard/conversations": ConversationsPage,
  "/dashboard/analytics": AnalyticsPage,
  "/dashboard/profile": ProfilePage,
  "/dashboard/prompt-settings": PromptSettingsPage,
};

const adminRoutes = {
  "/admin": AdminOverviewPage,
  "/admin/users": AdminUsersPage,
  "/admin/websites": AdminWebsitesPage,
  "/admin/analytics": AdminAnalyticsPage,
  "/admin/system-health": AdminSystemHealthPage,
  "/admin/subscriptions": AdminSubscriptionsPage,
  "/admin/settings": AdminSettingsPage,
};

function getPath() {
  const { pathname } = window.location;
  return pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname || "/";
}

function navigate(to) {
  if (to === window.location.pathname) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function App() {
  const [path, setPath] = useState(getPath);
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useState({ user: null, accessToken: "", refreshToken: "" });
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const onPop = () => setPath(getPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const stored = loadStoredAuth();
      if (stored.accessToken && hasValidToken(stored.accessToken)) {
        try {
          const session = await getSessionApi();
          setAuth({
            user: session.user,
            accessToken: stored.accessToken,
            refreshToken: stored.refreshToken,
          });
          setAuthLoading(false);
          return;
        } catch {}
      }

      const refreshToken = stored.refreshToken || getStoredRefreshToken();
      if (refreshToken) {
        try {
          const refreshed = await refreshSessionApi(refreshToken);
          setStoredAuth(refreshed);
          setAuth({ user: refreshed.user, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken });
          setAuthLoading(false);
          return;
        } catch {
          clearStoredAuth();
        }
      }

      setAuth({ user: null, accessToken: "", refreshToken: "" });
      setAuthLoading(false);
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  useEffect(() => {
    const token = auth.accessToken;
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (!payload?.exp) return;
      const timeout = window.setTimeout(() => {
        handleLogout();
      }, Math.max(0, payload.exp * 1000 - Date.now()));
      return () => window.clearTimeout(timeout);
    } catch {
      return undefined;
    }
  }, [auth.accessToken]);

  const role = useMemo(() => getRoleFromToken(auth.accessToken), [auth.accessToken]);
  const isDashboard = path.startsWith("/dashboard");
  const isAdmin = path.startsWith("/admin");
  const protectedPath = isDashboard || isAdmin;
  const isAuthenticated = Boolean(auth.user);

  useEffect(() => {
    if (authLoading) return;
    if (path === "/login" || path === "/signup") {
      if (isAuthenticated) navigate(role === "Admin" ? "/admin" : "/dashboard");
      return;
    }
    if (protectedPath && !isAuthenticated) {
      navigate("/login");
    }
    if (isDashboard && role === "Admin") {
      navigate("/admin");
    }
    if (isAdmin && role !== "Admin") {
      navigate("/dashboard");
    }
  }, [authLoading, auth.user, path, protectedPath, isAuthenticated, isDashboard, isAdmin, role]);

  async function handleLogin(payload) {
    setAuthError("");
    try {
      const result = await loginApi(payload);
      setStoredAuth(result);
      setAuth({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
      navigate(result.user?.role === "Admin" ? "/admin" : "/dashboard");
    } catch (error) {
      setAuthError(error.message || "Login failed.");
    }
  }

  async function handleRegister(payload) {
    setAuthError("");
    try {
      const result = await registerApi(payload);
      setStoredAuth(result);
      setAuth({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
      navigate("/dashboard");
    } catch (error) {
      setAuthError(error.message || "Sign up failed.");
    }
  }

  async function handleLogout() {
    try {
      const token = auth.refreshToken || getStoredRefreshToken();
      if (token) await logoutApi(token);
    } catch {}
    clearStoredAuth();
    setAuth({ user: null, accessToken: "", refreshToken: "" });
    navigate("/login");
  }

  // ChatPage is rendered persistently below; this resolves the page for all other routes
  const Page = routes[path] || dashboardRoutes[path] || adminRoutes[path] || (path === "/dashboard/chat" ? null : HomePage);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-[-10rem] h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      </div>

      {path === "/login" ? (
        <LoginPage onLogin={handleLogin} onNavigate={navigate} loading={authLoading} error={authError} />
      ) : path === "/signup" ? (
        <SignupPage onRegister={handleRegister} onNavigate={navigate} loading={authLoading} error={authError} />
      ) : isDashboard ? (
        <DashboardLayout currentPath={path} onNavigate={navigate} onLogout={handleLogout} authUser={auth.user}>
          {/* ChatPage is always mounted so in-flight queries and analytics state survive navigation */}
          <div style={{ display: path === "/dashboard/chat" ? "contents" : "none" }}>
            <ChatPage onNavigate={navigate} />
          </div>
          {path !== "/dashboard/chat" && <Page onNavigate={navigate} />}
        </DashboardLayout>
      ) : isAdmin ? (
        <AdminDashboardLayout currentPath={path} onNavigate={navigate} onLogout={handleLogout} authUser={auth.user}>
          <Page onNavigate={navigate} />
        </AdminDashboardLayout>
      ) : (
        <>
          <SiteHeader
            currentPath={path}
            menuOpen={menuOpen}
            navItems={siteNav}
            onNavigate={navigate}
            onToggleMenu={() => setMenuOpen((v) => !v)}
            authUser={auth.user}
            onLogout={handleLogout}
          />
          <main className="relative">
            <Page onNavigate={navigate} />
          </main>
          <SiteFooter onNavigate={navigate} />
        </>
      )}
    </div>
  );
}