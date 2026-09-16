import type { Metadata } from "next";
import { todayInShanghai } from "@/lib/dates";
import { StudyProvider } from "@/components/StudyProvider";
import { BottomNavigation } from "@/components/Navigation";
import "./globals.css";
export const metadata: Metadata = {
  title: "六级日常 · 每天向前一点",
  description: "日历里的六级学习路线，每天一点，慢慢靠近目标。",
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <StudyProvider initialToday={todayInShanghai()}>
          <a href="#page-content" className="skip-link">
            跳到主要内容
          </a>
          <div id="page-content">{children}</div>
          <BottomNavigation />
        </StudyProvider>
      </body>
    </html>
  );
}
