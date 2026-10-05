import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import Login from "./pages/Login.jsx";
import AppShell from "./app/AppShell.jsx";
import Landing from "./site/Landing.jsx";
import Terms from "./site/Terms.jsx";
import Privacy from "./site/Privacy.jsx";
import StudentOverview from "./portal/StudentOverview.jsx";
import StudentActivity from "./portal/StudentActivity.jsx";
import StudentTasks from "./portal/StudentTasks.jsx";
import StudentFeedback from "./portal/StudentFeedback.jsx";
import TeamsPage from "./portal/TeamsPage.jsx";
import TeamDetail from "./portal/TeamDetail.jsx";
import FacultyStudent from "./portal/FacultyStudent.jsx";
import Analytics from "./portal/Analytics.jsx";
import Alerts from "./portal/Alerts.jsx";
import AssignmentsPage from "./portal/AssignmentsPage.jsx";
import AssignmentDetail from "./portal/AssignmentDetail.jsx";
import TeamAssignment from "./portal/TeamAssignment.jsx";
import StudentAnalysis from "./portal/StudentAnalysis.jsx";

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
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route
        element={
          <PrivateRoute role="student">
            <AppShell />
          </PrivateRoute>
        }
      >
        <Route path="/student" element={<StudentOverview />} />
        <Route path="/student/activity" element={<StudentActivity />} />
        <Route path="/student/tasks" element={<StudentTasks />} />
        <Route path="/student/feedback" element={<StudentFeedback />} />
      </Route>

      <Route
        element={
          <PrivateRoute role="faculty">
            <AppShell />
          </PrivateRoute>
        }
      >
        <Route path="/faculty" element={<AssignmentsPage />} />
        <Route path="/faculty/assignments/:id" element={<AssignmentDetail />} />
        <Route path="/faculty/assignments/:id/teams/:teamId" element={<TeamAssignment />} />
        <Route path="/faculty/assignments/:id/students/:studentId" element={<StudentAnalysis />} />
        <Route path="/faculty/teams" element={<TeamsPage />} />
        <Route path="/faculty/teams/:teamId" element={<TeamDetail />} />
        <Route path="/faculty/students/:studentId" element={<FacultyStudent />} />
        <Route path="/faculty/analytics" element={<Analytics />} />
        <Route path="/faculty/alerts" element={<Alerts />} />
      </Route>

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
