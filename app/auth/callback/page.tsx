"use client";

import { useEffect } from "react";

export default function Callback() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      console.log("TOKEN:", token); // 🔍 debug

      if (!token) {
        console.error("No token found");
        return;
      }

      // Store token
      localStorage.setItem("token", token);

      // 🔥 HARD REDIRECT (more reliable than router.push)
      window.location.href = "/dashboard";

    } catch (err) {
      console.error("Callback error:", err);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      Logging you in...
    </div>
  );
}