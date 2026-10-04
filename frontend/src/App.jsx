import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import Login from "./pages/Login.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import FacultyDashboard from "./pages/FacultyDashboard.jsx";
import StudentDetail from "./pages/StudentDetail.jsx";
import Landing from "./site/Landing.jsx";
import Terms from "./site/Terms.jsx";
import Privacy from "./site/Privacy.jsx";

function PrivateRoute({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/student"
        element={
          <PrivateRoute role="student">
            <StudentDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/faculty"
        element={
          <PrivateRoute role="faculty">
            <FacultyDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/faculty/students/:studentId"
        element={
          <PrivateRoute role="faculty">
            <StudentDetail />
          </PrivateRoute>
        }
      />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === "faculty" ? "/faculty" : "/student"} replace />
          ) : (
            <Landing />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
