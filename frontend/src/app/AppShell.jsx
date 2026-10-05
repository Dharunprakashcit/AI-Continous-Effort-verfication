import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import api from "../api";
import { IconBell, IconBook, IconChart, IconChat, IconMenu, IconPulse, IconTasks, IconUser, IconUsers } from "./icons.jsx";
import "./app.css";

const NAV = {
  student: [
    { to: "/student", label: "Overview", icon: <IconUser />, end: true },
    { to: "/student/assignments", label: "Assignments", icon: <IconBook /> },
    { to: "/student/activity", label: "Activity", icon: <IconPulse /> },
    { to: "/student/tasks", label: "Tasks", icon: <IconTasks /> },
    { to: "/student/feedback", label: "AI feedback", icon: <IconChat /> },
  ],
  faculty: [
    { to: "/faculty", label: "Assignments", icon: <IconBook />, end: true },
    { to: "/faculty/teams", label: "Teams", icon: <IconUsers /> },
    { to: "/faculty/analytics", label: "Analytics", icon: <IconChart /> },
    { to: "/faculty/alerts", label: "Alerts", icon: <IconBell /> },
  ],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (user.role !== "faculty") return;
    api.get("/faculty/alerts").then((r) => setAlertCount(r.data.length)).catch(() => {});
  }, [user.role, pathname]);

  function signOut() {
    logout();
    navigate("/login");
  }

  const items = NAV[user.role];

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="side-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <IconMenu />
        </button>
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Team Contribution Monitor</span>
        </Link>
        <div className="topbar-right">
          {user.role === "faculty" && (
            <Link to="/faculty/alerts" className="icon-btn bell" aria-label={`Alerts, ${alertCount ?? 0} open`}>
              <IconBell />
              {alertCount > 0 && <span className="badge">{alertCount}</span>}
            </Link>
          )}
          <span className="whoami">{user.name}</span>
          <button type="button" className="btn-outline" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      <div className="frame">
        <aside id="side-nav" className={`sidebar${open ? " open" : ""}`}>
          <div className="role-box">{user.role === "faculty" ? "Faculty" : "Student"}</div>
          <nav className="side-links" aria-label="Portal">
            {items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
                {it.icon}
                {it.label}
              </NavLink>
            ))}
          </nav>
          <div className="side-foot">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </aside>

        <main className="content">
          <Outlet />
          <p className="disclaimer">
            Scores are decision support estimated from activity data. They are not a grade.
          </p>
        </main>
      </div>
    </div>
  );
}
