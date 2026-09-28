"use client";

/**
 * V13 Phase 2E: Paper exam flow.
 *
 * 整卷学习流程主组件：
 * - Section 进度条（Writing / Listening / Reading / Translation）
 * - 当前 section 内题目渲染
 * - Writing/Translation：文本输入 + draft autosave + 提交
 * - Listening：AudioPlayer（7 audio + AI 标识）+ 选择题
 * - Reading：Cloze / Matching / Careful Reading 渲染
 * - 导航：上一题/下一题/完成 section
 * - 提交整卷按钮（所有 section 完成后可用）
 *
 * 答案使用 questionId 绑定，刷新不丢失。
 */

import { useMemo, useState } from "react";
import { usePaper } from "./PaperProvider";
import { flattenPaperQuestions, getGroupAudioAsset } from "@/lib/paper/content";

const SECTION_NAMES: Record<string, string> = {
  writing: "写作",
  listening: "听力",
  reading: "阅读",
  translation: "翻译",
};

export function PaperExamFlow() {
  const { paper, session, dispatch, canSubmit, submitPaper, saveStatus } = usePaper();
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const flattened = useMemo(() => flattenPaperQuestions(paper), [paper]);

  // 当前 section 的题目
  const currentSection = session ? paper.sections[session.currentSectionIndex] : null;
  const currentSectionQuestions = useMemo(() => {
    if (!currentSection) return [];
    return flattened.filter((fq) => fq.sectionId === currentSection.sectionId);
  }, [flattened, currentSection]);

  // 当前题目（按 group + question index 定位）
  const currentQuestion = useMemo(() => {
    if (!session || currentSectionQuestions.length === 0) return null;
    // 计算当前 group 的起始 question index
    let groupStartIdx = 0;
    for (let i = 0; i < session.currentGroupIndex; i++) {
      const group = currentSection?.groups[i];
      if (group) groupStartIdx += (group.questions ?? []).length;
    }
    const globalIdxInSection = groupStartIdx + session.currentQuestionIndex;
    return currentSectionQuestions[globalIdxInSection] ?? null;
  }, [session, currentSectionQuestions, currentSection]);

  const currentGroup = currentSection?.groups[session?.currentGroupIndex ?? 0];
  const audioAsset = currentGroup ? getGroupAudioAsset(paper, currentGroup) : null;

  // 导航
  const goToQuestion = (sectionIdx: number, groupIdx: number, qIdx: number) => {
    dispatch({ type: "navigate", sectionIndex: sectionIdx, groupIndex: groupIdx, questionIndex: qIdx, now: new Date().toISOString() });
  };

  const nextQuestion = () => {
    if (!session || !currentSection || !currentGroup) return;
    const questionsInGroup = (currentGroup.questions ?? []).length;
    if (session.currentQuestionIndex + 1 < questionsInGroup) {
      goToQuestion(session.currentSectionIndex, session.currentGroupIndex, session.currentQuestionIndex + 1);
    } else if (session.currentGroupIndex + 1 < currentSection.groups.length) {
      goToQuestion(session.currentSectionIndex, session.currentGroupIndex + 1, 0);
    } else {
      // section 完成
      dispatch({ type: "complete_section", sectionId: currentSection.sectionId, now: new Date().toISOString() });
      // 进入下一 section
      if (session.currentSectionIndex + 1 < paper.sections.length) {
        goToQuestion(session.currentSectionIndex + 1, 0, 0);
      }
    }
  };

  const prevQuestion = () => {
    if (!session) return;
    if (session.currentQuestionIndex > 0) {
      goToQuestion(session.currentSectionIndex, session.currentGroupIndex, session.currentQuestionIndex - 1);
    } else if (session.currentGroupIndex > 0) {
      const prevGroup = currentSection?.groups[session.currentGroupIndex - 1];
      const prevCount = (prevGroup?.questions ?? []).length;
      goToQuestion(session.currentSectionIndex, session.currentGroupIndex - 1, Math.max(0, prevCount - 1));
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    dispatch({ type: "select_answer", questionId, optionId, now: new Date().toISOString() });
  };

  const handleSubjectiveDraft = (questionId: string, draft: string) => {
    dispatch({ type: "set_subjective_draft", questionId, draft, now: new Date().toISOString() });
  };

  const handleSubjectiveSubmit = (questionId: string, text: string) => {
    dispatch({ type: "submit_subjective", questionId, text, now: new Date().toISOString() });
  };

  const handleSubmitPaper = () => {
    const result = submitPaper();
    if (result) {
      setShowSubmitConfirm(false);
    }
  };

  if (!session || !currentSection || !currentQuestion) {
    return <div style={{ padding: 24 }}>加载中…</div>;
  }

  const answer = session.answers[currentQuestion.question.questionId];
  const isSubjective = currentQuestion.question.type === "subjective_writing" || currentQuestion.question.type === "subjective_translation";
  const isLastInSection = (() => {
    if (!currentGroup) return false;
    const questionsInGroup = (currentGroup.questions ?? []).length;
    return session.currentQuestionIndex === questionsInGroup - 1 &&
      session.currentGroupIndex === (currentSection?.groups.length ?? 1) - 1;
  })();

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 200px" }}>
      {/* Section 进度条 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {paper.sections.map((sec, idx) => {
          const sp = session.sectionProgress.find((s) => s.sectionId === sec.sectionId);
          const isActive = idx === session.currentSectionIndex;
          const isComplete = sp?.status === "completed";
          return (
            <button
              key={sec.sectionId}
              onClick={() => goToQuestion(idx, 0, 0)}
              style={{
                flex: 1,
                padding: "8px 4px",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                background: isComplete ? "#2e7d32" : isActive ? "#c8e6c9" : "#e8ece8",
                color: isComplete ? "#fff" : isActive ? "#1a3a2a" : "#666",
              }}
            >
              {SECTION_NAMES[sec.type] ?? sec.type}
              {sp && <div style={{ fontSize: 10, marginTop: 2 }}>{sp.answeredCount}/{sp.totalQuestions}</div>}
            </button>
          );
        })}
      </div>

      {/* 保存状态 */}
      {saveStatus === "failed" && (
        <div style={{ background: "#ffebee", color: "#c62828", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          本地保存失败，当前作答可能未保存
        </div>
      )}

      {/* 题目内容 */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {/* Group 材料（passage / transcript / prompt） */}
        {currentQuestion.groupMaterial?.passage && currentSection.type === "reading" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>阅读材料</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#333", whiteSpace: "pre-wrap" }}>
              {currentQuestion.groupMaterial.passage}
            </div>
          </div>
        )}

        {currentQuestion.groupMaterial?.prompt && isSubjective && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>题目</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#333", whiteSpace: "pre-wrap" }}>
              {currentQuestion.groupMaterial.prompt}
            </div>
          </div>
        )}

        {/* 听力音频 */}
        {currentSection.type === "listening" && audioAsset && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>
              听力音频 · AI 合成语音
            </div>
            <audio
              controls
              src={audioAsset.source}
              style={{ width: "100%" }}
              preload="metadata"
            />
            {audioAsset.aiDisclosure && (
              <div style={{ fontSize: 11, color: "#2e7d32", marginTop: 4 }}>
                {audioAsset.aiDisclosure}
              </div>
            )}
          </div>
        )}

        {/* 题干 */}
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1a3a2a", marginBottom: 12 }}>
          {currentQuestion.question.prompt}
        </div>

        {/* 选择题选项 */}
        {currentQuestion.question.type === "choice" && currentQuestion.question.options && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {currentQuestion.question.options.map((opt) => {
              const selected = answer?.selectedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(currentQuestion.question.questionId, opt.id)}
                  style={{
                    padding: "12px 14px",
                    border: selected ? "2px solid #2e7d32" : "1px solid #d0d8d0",
                    borderRadius: 8,
                    background: selected ? "#e8f5e9" : "#fff",
                    textAlign: "left",
                    fontSize: 14,
                    color: "#333",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 600, marginRight: 8 }}>{opt.id}.</span>
                  {opt.text}
                </button>
              );
            })}
          </div>
        )}

        {/* Cloze 选词填空 */}
        {currentQuestion.question.type === "cloze" && currentQuestion.question.options && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>选择正确的词填入空格</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {currentQuestion.question.options.map((opt) => {
                const selected = answer?.selectedOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(currentQuestion.question.questionId, opt.id)}
                    style={{
                      padding: "6px 12px",
                      border: selected ? "2px solid #2e7d32" : "1px solid #d0d8d0",
                      borderRadius: 6,
                      background: selected ? "#e8f5e9" : "#fff",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Matching 匹配题 */}
        {currentQuestion.question.type === "matching" && currentQuestion.question.options && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>选择匹配的段落</div>
            {currentQuestion.question.options.map((opt) => {
              const selected = answer?.selectedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(currentQuestion.question.questionId, opt.id)}
                  style={{
                    padding: "10px 12px",
                    border: selected ? "2px solid #2e7d32" : "1px solid #d0d8d0",
                    borderRadius: 8,
                    background: selected ? "#e8f5e9" : "#fff",
                    textAlign: "left",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
        )}

        {/* 主观题（Writing / Translation） */}
        {isSubjective && (
          <div>
            <textarea
              value={answer?.draft ?? answer?.submittedText ?? ""}
              onChange={(e) => handleSubjectiveDraft(currentQuestion.question.questionId, e.target.value)}
              disabled={Boolean(answer?.submittedText)}
              placeholder={currentQuestion.question.type === "subjective_writing" ? "在此输入你的作文…" : "在此输入你的翻译…"}
              style={{
                width: "100%",
                minHeight: 180,
                padding: 12,
                border: "1px solid #d0d8d0",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                background: answer?.submittedText ? "#f5f5f5" : "#fff",
              }}
            />
            {!answer?.submittedText && (
              <button
                onClick={() => {
                  const text = answer?.draft ?? "";
                  if (text.trim()) handleSubjectiveSubmit(currentQuestion.question.questionId, text.trim());
                }}
                disabled={!answer?.draft?.trim()}
                style={{
                  marginTop: 10,
                  padding: "10px 20px",
                  background: answer?.draft?.trim() ? "#2e7d32" : "#ccc",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: answer?.draft?.trim() ? "pointer" : "not-allowed",
                }}
              >
                提交
              </button>
            )}
            {answer?.submittedText && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#2e7d32" }}>已提交</div>
            )}
          </div>
        )}
      </div>

      {/* 导航按钮 */}
      <div style={{ display: "flex", gap: 10, position: "fixed", bottom: 68, left: 0, right: 0, padding: "12px 16px", background: "#fff", borderTop: "1px solid #e0e8e0", maxWidth: 560, margin: "0 auto" }}>
        <button
          onClick={prevQuestion}
          disabled={session.currentQuestionIndex === 0 && session.currentGroupIndex === 0}
          style={{
            flex: 1,
            padding: "12px",
            border: "1px solid #d0d8d0",
            borderRadius: 8,
            background: "#fff",
            fontSize: 14,
            cursor: session.currentQuestionIndex === 0 && session.currentGroupIndex === 0 ? "not-allowed" : "pointer",
            color: "#666",
          }}
        >
          上一题
        </button>
        {!isLastInSection ? (
          <button
            onClick={nextQuestion}
            style={{
              flex: 2,
              padding: "12px",
              background: "#2e7d32",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            下一题
          </button>
        ) : session.currentSectionIndex < paper.sections.length - 1 ? (
          <button
            onClick={nextQuestion}
            style={{
              flex: 2,
              padding: "12px",
              background: "#2e7d32",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            完成本节，进入下一部分
          </button>
        ) : (
          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={!canSubmit}
            style={{
              flex: 2,
              padding: "12px",
              background: canSubmit ? "#1b5e20" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            提交整卷
          </button>
        )}
      </div>

      {/* 提交确认弹窗 */}
      {showSubmitConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" }}>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>确认提交？</h3>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 20, lineHeight: 1.6 }}>
              提交后将无法修改答案。结果页将显示正确率、错题数量和各 section 表现。
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                style={{ flex: 1, padding: "10px", border: "1px solid #d0d8d0", borderRadius: 8, background: "#fff", fontSize: 14, cursor: "pointer" }}
              >
                取消
              </button>
              <button
                onClick={handleSubmitPaper}
                style={{ flex: 1, padding: "10px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
