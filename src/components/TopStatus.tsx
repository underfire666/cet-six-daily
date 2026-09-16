import { Flame, Zap } from "lucide-react";
import { mockUser } from "@/data/mock";
import { Brand } from "./Navigation";
export function TopStatus() {
  return (
    <header className="topbar">
      <Brand />
      <div className="user-status">
        <span className="streak" aria-label={`连续学习 ${mockUser.streak} 天`}>
          <Flame size={22} fill="currentColor" />
          {mockUser.streak}
          <span className="streak-label">天连续学习</span>
        </span>
        <div className="xp-status">
          <div className="xp-label">
            <strong>
              Lv.{mockUser.level} <span>· {mockUser.title}</span>
            </strong>
            <span>
              <Zap size={12} fill="currentColor" /> {mockUser.xp}
              <i> / {mockUser.nextLevelXp}</i>
            </span>
          </div>
          <div
            className="xp-track"
            role="progressbar"
            aria-label="等级经验"
            aria-valuenow={mockUser.xp}
            aria-valuemin={0}
            aria-valuemax={mockUser.nextLevelXp}
          >
            <span
              style={{
                width: `${(mockUser.xp / mockUser.nextLevelXp) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
