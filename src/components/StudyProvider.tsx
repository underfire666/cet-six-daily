"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { todayInShanghai } from "@/lib/dates";
const Context = createContext("");
export function StudyProvider({
  initialToday,
  children,
}: {
  initialToday: string;
  children: React.ReactNode;
}) {
  const [today, setToday] = useState(initialToday);
  useEffect(() => {
    const update = () => setToday(todayInShanghai());
    update();
    const interval = setInterval(update, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return <Context.Provider value={today}>{children}</Context.Provider>;
}
export const useToday = () => useContext(Context);
