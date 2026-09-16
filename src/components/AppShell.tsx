"use client";
import { usePathname } from "next/navigation";
import { BottomNavigation } from "./Navigation";
export function AppShell({ children }: { children: React.ReactNode }) {
  const exercise = usePathname().startsWith("/lesson/");
  return (
    <>
      <a href="#page-content" className="skip-link">
        跳到主要内容
      </a>
      <div
        id="page-content"
        style={exercise ? { paddingBottom: 0 } : undefined}
      >
        {children}
      </div>
      {!exercise && <BottomNavigation />}
    </>
  );
}
