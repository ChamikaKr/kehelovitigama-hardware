
import { useEffect, useState, type FormEvent } from "react";
import "./App.css";
import Inventory from "./Inventory";
import SettingsManagement from "./SettingsManagement";
import SalesManagement from "./SalesManagement";
import SalesHistory from "./SalesHistory";
import StockCount from "./StockCount";
import Purchases from "./Purchases";
import { supabase } from "./supabase";

import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShoppingCart,
  ShoppingBag,
  Users,
  Truck,
  Receipt,
  ChartNoAxesCombined,
  Wallet,
  Building2,
  FileText,
  ArrowLeftRight,
  Settings,
  Search,
  Bell,
  Plus,
  TrendingUp,
  AlertTriangle,
  LogOut,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";

import type { Session } from "@supabase/supabase-js";

const navigation = [
  {
    title: "WORKSPACE",
    items: [
      { name: "Dashboard", icon: LayoutDashboard },
      { name: "Stock & Inventory", icon: Package },
      { name: "Stock Count", icon: ClipboardList },
      { name: "Purchases", icon: ShoppingCart },
      { name: "Sales / POS", icon: ShoppingBag },
      { name: "Sales History", icon: Receipt },
      { name: "Customers & Credit", icon: Users },
      { name: "Suppliers", icon: Truck },
      { name: "Expenses", icon: Receipt },
      { name: "Reports", icon: ChartNoAxesCombined },
    ],
  },
  {
    title: "FINANCIAL MANAGEMENT",
    items: [
      { name: "Financial Overview", icon: Wallet },
      { name: "Bank Accounts & OD", icon: Building2 },
      { name: "Cheque Management", icon: FileText },
      { name: "Transactions", icon: ArrowLeftRight },
    ],
  },
];

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f5f6f7",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "36px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "#252a30",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <LockKeyhole size={21} />
        </div>

        <h1
          style={{
            fontSize: "23px",
            color: "#20252b",
            margin: "0 0 8px",
          }}
        >
          Welcome back
        </h1>

        <p
          style={{
            fontSize: "13px",
            color: "#737b84",
            margin: "0 0 28px",
          }}
        >
          Sign in to Kehelovitigama Hardware Management System.
        </p>

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "8px",
              color: "#343a40",
            }}
          >
            Email address
          </label>

          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            style={loginInputStyle}
          />

          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              margin: "18px 0 8px",
              color: "#343a40",
            }}
          >
            Password
          </label>

          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            style={loginInputStyle}
          />

          {error && (
            <div
              role="alert"
              style={{
                marginTop: "16px",
                padding: "11px",
                borderRadius: "7px",
                background: "#fff1f0",
                color: "#b42318",
                fontSize: "12px",
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "24px",
              padding: "12px",
              background: "#252a30",
              color: "#ffffff",
              border: "none",
              borderRadius: "7px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontSize: "11px",
            color: "#8a929b",
          }}
        >
          Kehelovitigama Hardware · Internal Access
        </p>
      </div>
    </div>
  );
}

const loginInputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px",
  border: "1px solid #dfe3e7",
  borderRadius: "7px",
  outline: "none",
  fontSize: "13px",
  color: "#252a30",
  background: "#ffffff",
};

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("Session check failed:", error.message);
      }

      setSession(data.session);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
      alert("Unable to sign out: " + error.message);
    }

    setLoggingOut(false);
  }

  if (checkingSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f6f7",
          color: "#626b75",
          fontSize: "13px",
        }}
      >
        Checking your session...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  const userEmail = session.user.email || "Authenticated User";
  const avatarLetter = userEmail.charAt(0).toUpperCase();

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">K</div>
            <div className="brand-copy">
              <strong>Hardware Shop</strong>
              <span>Management System</span>
            </div>
          </div>

          <button
            className="sidebar-toggle"
            type="button"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={sidebarCollapsed}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </div>

        <div className="navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="nav-heading">{group.title}</p>

              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.name}
                    title={sidebarCollapsed ? item.name : undefined}
                    className={`nav-item ${
                      activePage === item.name ? "active" : ""
                    }`}
                    onClick={() => setActivePage(item.name)}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <button
          title={sidebarCollapsed ? "Settings & Users" : undefined}
          className={`nav-item settings-link ${
            activePage === "Settings & Users" ? "active" : ""
          }`}
          onClick={() => setActivePage("Settings & Users")}
        >
          <Settings size={17} />
          <span>Settings & Users</span>
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activePage}
          </div>

          <div className="top-actions">
            <button className="icon-button" title="Search">
              <Search size={18} />
            </button>

            <button className="icon-button" title="Notifications">
              <Bell size={18} />
            </button>

            <div className="profile">
              <div className="avatar">{avatarLetter}</div>
              <div>
                <strong>{userEmail}</strong>
                <span>Authenticated User</span>
              </div>
            </div>

            <button
              className="icon-button"
              title="Sign out"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {activePage === "Dashboard" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>Dashboard</h1>
                  <p>
                    Here's what's happening with your business today.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => setActivePage("Sales / POS")}
                >
                  <Plus size={17} />
                  New Sale
                </button>
              </div>

              <section className="mobile-quick-actions" aria-label="Quick stock actions">
                <button className="mobile-action-card" onClick={() => setActivePage("Stock & Inventory")}>
                  <Package size={25} />
                  <span>Check Stock</span>
                  <small>Search products and quantities</small>
                </button>
                <button className="mobile-action-card" onClick={() => setActivePage("Purchases")}>
                  <ShoppingCart size={25} />
                  <span>Record Purchase</span>
                  <small>Enter supplier bills and received stock</small>
                </button>
                <button className="mobile-action-card" onClick={() => setActivePage("Stock Count")}>
                  <ClipboardList size={25} />
                  <span>Stock Count</span>
                  <small>Review and update counted stock</small>
                </button>
                <button className="mobile-action-card" onClick={() => setActivePage("Sales / POS")}>
                  <ShoppingBag size={25} />
                  <span>Record Sale</span>
                  <small>Record a sale and related stock movement</small>
                </button>
                <button className="mobile-action-card" onClick={() => setActivePage("Sales History")}>
                  <Receipt size={25} />
                  <span>Recent Activity</span>
                  <small>Review recorded sales</small>
                </button>
              </section>

              <div className="date-label">BUSINESS OVERVIEW</div>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Today's Sales</span>
                    <ShoppingBag size={19} />
                  </div>
                  <h2>LKR 86,500</h2>
                  <p className="stat-note">
                    <TrendingUp size={14} />
                    12 transactions recorded
                  </p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Cash Received</span>
                    <Wallet size={19} />
                  </div>
                  <h2>LKR 72,500</h2>
                  <p className="stat-note">
                    <TrendingUp size={14} />
                    Cash and bank collections
                  </p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Customer Outstanding</span>
                    <Users size={19} />
                  </div>
                  <h2>LKR 245,000</h2>
                  <p className="stat-note neutral">
                    Across 18 customers
                  </p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Low Stock Items</span>
                    <AlertTriangle size={19} />
                  </div>
                  <h2>08</h2>
                  <p className="stat-note warning">
                    Requires attention
                  </p>
                </div>
              </section>

              <section className="dashboard-grid">
                <div className="content-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Sales Overview</h3>
                      <p>
                        Sales activity during the last seven days
                      </p>
                    </div>

                    <select defaultValue="7">
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                    </select>
                  </div>

                  <div className="chart-placeholder">
                    <div className="chart-bars">
                      {[45, 68, 54, 82, 62, 95, 38].map(
                        (height, index) => (
                          <div className="bar-column" key={index}>
                            <div
                              className={`bar ${
                                index === 5 ? "highlight" : ""
                              }`}
                              style={{ height: `${height}%` }}
                            />
                            <span>
                              {[
                                "Mon",
                                "Tue",
                                "Wed",
                                "Thu",
                                "Fri",
                                "Sat",
                                "Sun",
                              ][index]}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="content-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Stock Alerts</h3>
                      <p>Items requiring attention</p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => setActivePage("Stock & Inventory")}
                    >
                      View all
                    </button>
                  </div>

                  <div className="stock-alert">
                    <div>
                      <strong>Cement 50kg</strong>
                      <span>Building Materials</span>
                    </div>
                    <span className="stock-count danger">4 bags</span>
                  </div>

                  <div className="stock-alert">
                    <div>
                      <strong>PVC Pipe ½ inch</strong>
                      <span>PVC & Plumbing</span>
                    </div>
                    <span className="stock-count warning">8 lengths</span>
                  </div>

                  <div className="stock-alert">
                    <div>
                      <strong>Binding Wire</strong>
                      <span>Wire & Net</span>
                    </div>
                    <span className="stock-count warning">3 rolls</span>
                  </div>

                  <div className="stock-alert">
                    <div>
                      <strong>Roofing Nails</strong>
                      <span>Hardware</span>
                    </div>
                    <span className="stock-count danger">2 packs</span>
                  </div>
                </div>
              </section>

              <section className="content-panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent Sales</h3>
                    <p>Latest recorded transactions</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActivePage("Sales / POS")}
                  >
                    View all sales
                  </button>
                </div>

                <div className="empty-table">
                  <ShoppingBag size={22} />
                  <p>Sales records will appear here.</p>
                  <span>
                    Connect the database to start recording transactions.
                  </span>
                </div>
              </section>

              <p className="footer-note">
                Kehelovitigama Hardware · Business Management System
              </p>
            </>
          ) : activePage === "Stock & Inventory" ? (
            <Inventory />
          ) : activePage === "Stock Count" ? (
            <StockCount />
          ) : activePage === "Purchases" ? (
            <Purchases />
          ) : activePage === "Sales / POS" ? (
            <SalesManagement />
          ) : activePage === "Sales History" ? (
            <SalesHistory />
          ) : activePage === "Settings & Users" ? (
            <SettingsManagement userEmail={userEmail} />
          ) : (
            <div
              style={{
                padding: "50px 20px",
                textAlign: "center",
                background: "#ffffff",
                border: "1px solid #e7e9ec",
                borderRadius: "11px",
              }}
            >
              <Package
                size={30}
                color="#89929b"
                style={{ marginBottom: "12px" }}
              />

              <h2 style={{ fontSize: "18px" }}>{activePage}</h2>

              <p style={{ fontSize: "12px", color: "#7a838d" }}>
                This module is planned and will be developed in a
                future stage.
              </p>

              <button
                className="primary-button"
                style={{ margin: "20px auto 0" }}
                onClick={() => setActivePage("Dashboard")}
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>

      {mobileMenuOpen && (
        <div className="mobile-more-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <section className="mobile-more-panel" aria-label="All app sections" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-more-heading">
              <strong>All sections</strong>
              <button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button>
            </div>
            {navigation.map((group) => (
              <div className="mobile-more-group" key={group.title}>
                <p>{group.title}</p>
                <div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return <button type="button" key={item.name} className={activePage === item.name ? "active" : ""} onClick={() => { setActivePage(item.name); setMobileMenuOpen(false); }}><Icon size={18} /><span>{item.name}</span></button>;
                  })}
                </div>
              </div>
            ))}
            <button type="button" className={`mobile-more-settings ${activePage === "Settings & Users" ? "active" : ""}`} onClick={() => { setActivePage("Settings & Users"); setMobileMenuOpen(false); }}><Settings size={18} /><span>Settings & Users</span></button>
          </section>
        </div>
      )}
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <button className={activePage === "Dashboard" ? "active" : ""} onClick={() => { setActivePage("Dashboard"); setMobileMenuOpen(false); }}>
          <LayoutDashboard size={20} /><span>Home</span>
        </button>
        <button className={activePage === "Stock & Inventory" ? "active" : ""} onClick={() => { setActivePage("Stock & Inventory"); setMobileMenuOpen(false); }}>
          <Package size={20} /><span>Stock</span>
        </button>
        <button className={activePage === "Purchases" ? "active" : ""} onClick={() => { setActivePage("Purchases"); setMobileMenuOpen(false); }}>
          <ShoppingCart size={20} /><span>Purchases</span>
        </button>
        <button className={activePage === "Sales / POS" ? "active" : ""} onClick={() => { setActivePage("Sales / POS"); setMobileMenuOpen(false); }}>
          <ShoppingBag size={20} /><span>Sales</span>
        </button>
        <button className={mobileMenuOpen || (activePage !== "Dashboard" && activePage !== "Stock & Inventory" && activePage !== "Purchases" && activePage !== "Sales / POS") ? "active" : ""} onClick={() => setMobileMenuOpen((open) => !open)}>
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}<span>More</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
