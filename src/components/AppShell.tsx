"use client";
import { usePathname } from "next/navigation";
import { BottomNavigation } from "./Navigation";
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const exercise =
    path.startsWith("/lesson/") ||
    path.startsWith("/practice/vocabulary/session") ||
    path.startsWith("/practice/vocabulary/complete") ||
    path.startsWith("/practice/reading/session") ||
    path.startsWith("/practice/reading/complete") ||
    path.startsWith("/practice/listening/session") ||
    path.startsWith("/practice/listening/complete");
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
