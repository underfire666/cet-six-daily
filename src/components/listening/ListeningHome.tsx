"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Headphones } from "lucide-react";
import { useListening } from "./ListeningProvider";

export function ListeningHome() {
  const listening = useListening();
  const router = useRouter();
  const done = listening.progress.completedMaterialIds.length;
  const total = listening.progress.materialIds.length;
  const completed = listening.dailyComplete;
  const begin = (mode: "daily" | "extra") => {
    const id = listening.start(mode);
    if (id) router.push(`/practice/listening/session/${id}`);
  };
  const main = () => {
    if (listening.active) {
      router.push(`/practice/listening/session/${listening.active.id}`);
      return;
    }
    if (!completed) begin("daily");
    else begin("extra");
  };
  const mainLabel = listening.active
    ? "继续听力"
    : completed
      ? "继续听力"
      : "开始听力";
  return (
    <main className="listening-page">
      <header className="listening-heading">
        <Link href="/" aria-label="返回首页">
          <ArrowLeft size={19} />
        </Link>
        <h1>听力</h1>
      </header>
      {listening.notice && (
        <p className="listening-notice">{listening.notice}</p>
      )}
      <section className="listening-today">
        <div className="listening-section-title">
          <span>
            <Headphones size={18} />
            今日听力
          </span>
          <small>每天听一点，让耳朵习惯六级</small>
        </div>
        <div className="listening-count">
          <strong>{done}</strong>
          <span>/ {total} 组</span>
          {completed && <span className="listening-done-flag">✓ 完成</span>}
        </div>
        <p className="listening-sub">
          {completed
            ? "今日任务完成，再听一组也不多。"
            : "每天听一点，让耳朵习惯六级。"}
        </p>
        <div
          className="listening-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <div className="listening-actions">
          <button
            className="listening-button"
            onClick={main}
            disabled={!listening.ready}
          >
            <Headphones size={18} />
            {mainLabel}
          </button>
        </div>
        {listening.previousDaily &&
          listening.previousDaily.id !== listening.active?.id && (
            <button
              className="listening-text-button"
              onClick={() =>
                router.push(
                  `/practice/listening/session/${listening.previousDaily!.id}`,
                )
              }
            >
              继续 {listening.previousDaily.planDate} 未完成的听力
            </button>
          )}
        {listening.extraActive && !completed && (
          <button
            className="listening-text-button"
            onClick={() =>
              router.push(
                `/practice/listening/session/${listening.extraActive!.id}`,
              )
            }
          >
            继续未完成的额外听力
          </button>
        )}
        <div className="listening-extra-stats">
          <span>
            额外听力 <strong>{listening.dayStats.extra}</strong> 组
          </span>
          <span>
            今日听力 <strong>+{listening.dayStats.xp} XP</strong>
          </span>
        </div>
        <Link
          className="listening-text-button"
          href="/practice/vocabulary/wordbook"
        >
          <Check size={14} />
          查看我的生词
        </Link>
      </section>
    </main>
  );
}
