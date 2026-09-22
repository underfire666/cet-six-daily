"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Languages, History } from "lucide-react";
import { useTranslation } from "./TranslationProvider";

export function TranslationHome() {
  const t = useTranslation();
  const router = useRouter();
  const done = t.progress.completedTaskIds.length;
  const total = t.progress.taskIds.length;
  const completed = t.dailyComplete;

  const begin = (mode: "daily" | "extra") => {
    const id = t.start(mode);
    if (id) router.push(`/practice/translation/session/${id}`);
  };
  const main = () => {
    if (t.active) {
      router.push(`/practice/translation/session/${t.active.id}`);
      return;
    }
    if (!completed) begin("daily");
    else begin("extra");
  };
  const mainLabel = t.active ? "继续翻译" : completed ? "再练一篇" : "开始翻译";

  return (
    <main className="subjective-page">
      <header className="subjective-heading">
        <Link href="/" aria-label="返回首页">
          <ArrowLeft size={19} />
        </Link>
        <h1>翻译</h1>
      </header>
      {t.notice && <p className="subjective-notice">{t.notice}</p>}
      {t.ready && !total && <p className="subjective-notice">暂无可用翻译内容，请稍后再试。</p>}
      <section className="subjective-today">
        <div className="subjective-section-title">
          <span>
            <Languages size={18} />
            今日翻译
          </span>
          <small>每天译一点，把中文真正写成英文</small>
        </div>
        <div className="subjective-count">
          <strong>{done}</strong>
          <span>/ {total} 篇</span>
          {completed && <span className="subjective-done-flag">✓ 完成</span>}
        </div>
        <p className="subjective-sub">
          {completed ? "今日任务完成，再译一篇也不错。" : "先把今天这一篇译完。"}
        </p>
        <div
          className="subjective-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <div className="subjective-actions">
          <button
            className="subjective-button"
            onClick={main}
            disabled={!t.ready || !total}
          >
            <Languages size={18} />
            {mainLabel}
          </button>
        </div>
        {t.previousDaily &&
          t.previousDaily.id !== t.active?.id && (
            <button
              className="subjective-text-button"
              onClick={() =>
                router.push(
                  `/practice/translation/session/${t.previousDaily!.id}`,
                )
              }
            >
              继续 {t.previousDaily.planDate} 未完成的翻译
            </button>
          )}
        {t.extraActive && !completed && (
          <button
            className="subjective-text-button"
            onClick={() =>
              router.push(
                `/practice/translation/session/${t.extraActive!.id}`,
              )
            }
          >
            继续未完成的额外翻译
          </button>
        )}
        <div className="subjective-extra-stats">
          <span>
            今日额外翻译 <strong>{t.dayStats.extra}</strong> 篇
          </span>
          <span>
            今日翻译 <strong>+{t.dayStats.xp} XP</strong>
          </span>
        </div>
        {t.history.length > 0 && (
          <div className="subjective-history-block">
            <div className="subjective-history-title">
              <History size={14} />
              最近 {Math.min(3, t.history.length)} 次
            </div>
            {t.history.slice(-3).reverse().map((entry, i) => {
              const realIndex = t.history.length - 1 - i;
              return (
                <div key={realIndex} className="subjective-history-item">
                  <span>{new Date(entry.createdAt).toLocaleDateString("zh-CN")}</span>
                  <span>{entry.score} / {entry.feedback.maxScore}</span>
                  {entry.sessionId && (
                    <button
                      className="subjective-link-button"
                      onClick={() =>
                        router.push(
                          `/practice/translation/session/${entry.sessionId}`,
                        )
                      }
                    >
                      查看
                    </button>
                  )}
                  <button
                    className="subjective-link-button"
                    onClick={() => t.removeHistory(realIndex)}
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
