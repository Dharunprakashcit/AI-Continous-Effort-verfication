import React, { createContext, useContext, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

// "Remember me" keeps the session in localStorage; otherwise it lives only in this tab.
function readStored(key) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = readStored("user");
    return raw ? JSON.parse(raw) : null;
  });

  function clearStored() {
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem("token");
      store.removeItem("user");
    }
  }

  async function login(email, password, remember = true) {
    const { data } = await api.post("/auth/login", { email, password });
    clearStored();
    const store = remember ? localStorage : sessionStorage;
    store.setItem("token", data.token);
    store.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearStored();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
