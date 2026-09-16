"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Sparkles, UserRound, Sprout } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="六级日常，学习首页">
      <span className="brand-mark">
        <Sprout size={25} strokeWidth={2.8} />
      </span>
      <span>
        六级日常<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function BottomNavigation() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <div className="nav-inner">
        {[
          { href: "/", label: "学习", Icon: BookOpen },
          { href: "/ai", label: "AI", Icon: Sparkles },
          { href: "/me", label: "我的", Icon: UserRound },
        ].map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? path === "/" ||
                path.startsWith("/lesson") ||
                path.startsWith("/practice")
              : path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={23} strokeWidth={active ? 2.6 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
