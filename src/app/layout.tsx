import type { Metadata, Viewport } from "next";
import { todayInShanghai } from "@/lib/dates";
import { StudyProvider } from "@/components/StudyProvider";
import { AppShell } from "@/components/AppShell";
import { LearningProvider } from "@/components/LearningProvider";
import "./globals.css";
export const metadata: Metadata = {
  title: "六级日常 · 每天向前一点",
  description: "日历里的六级学习路线，每天一点，慢慢靠近目标。",
};
export const dynamic = "force-dynamic";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <StudyProvider initialToday={todayInShanghai()}>
          <LearningProvider>
            <AppShell>{children}</AppShell>
          </LearningProvider>
        </StudyProvider>
      </body>
    </html>
  );
}
