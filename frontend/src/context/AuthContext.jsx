import { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, user } = res.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    return user;
  };

  // 📝 Updated for OTP Verification Flow
  const signup = async (name, email, password) => {
    const res = await api.post("/auth/signup", { name, email, password });
    // Abhi token nahi milega, pehle mail par OTP dispatch hoga
    // Isliye sirf response return karenge taaki Signup.jsx screen toggle kar sake
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get("/auth/me");
      const updated = res.data;
      localStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);