"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Upload, FileJson, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { parseJsonContent, countContentStats, validateImportDraft, serializeImport, IMPORT_BODY_LIMIT } from "@/lib/private-papers/validation";

const MAX_BYTES = IMPORT_BODY_LIMIT;

interface PreviewStats {
  sections: number;
  groups: number;
  questions: number;
  isPartial: boolean;
  schemaVersion: string;
}

interface ImportError {
  field?: string;
  message: string;
}

export default function PrivatePapersImportPage() {
  const { status } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [localPaperId, setLocalPaperId] = useState("");
  const [title, setTitle] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [fileName, setFileName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fileReading, setFileReading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeReader = useRef<FileReader | null>(null);
  const submitInFlight = useRef(false);
  useEffect(() => () => activeReader.current?.abort(), []);

  const parsed = useMemo(() => parseJsonContent(jsonText), [jsonText]);
  const parsedContent = parsed.content;
  const parseError = parsed.error;

  const preview = useMemo<PreviewStats | null>(() => {
    return parsedContent ? countContentStats(parsedContent) : null;
  }, [parsedContent]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/me/private-papers/import");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main className="me-page">
        <p className="me-loading">加载中…</p>
      </main>
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    activeReader.current?.abort();
    activeReader.current = null;
    setFileReading(false);
    if (!file.name.toLowerCase().endsWith(".json")) { setSubmitError("请选择 .json 文件"); e.target.value = ""; return; }

    if (file.size > MAX_BYTES) {
      setSubmitError(`文件过大（${(file.size / 1024).toFixed(1)} KiB），上限 1 MiB`);
      e.target.value = "";
      return;
    }

    setSubmitError("");

    const reader = new FileReader();
    activeReader.current = reader;
    setFileReading(true);
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (activeReader.current !== reader) return;
      setFileName(file.name);
      setJsonText(text);
      setFileReading(false);
    };
    reader.onerror = () => {
      if (activeReader.current !== reader) return;
      setFileReading(false);
      setSubmitError("文件读取失败，请重试");
    };
    reader.readAsText(file, "utf-8");
  }

  function validate(): boolean {
    const result = validateImportDraft({ localPaperId, title, content: parsedContent, parseError, acknowledged });
    const errs: ImportError[] = result.errors;
    setErrors(errs);
    return errs.length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitInFlight.current || fileReading) return;
    setSubmitError("");

    if (!validate()) return;

    submitInFlight.current = true;
    setSubmitting(true);
    let succeeded = false;
    try {
      const { body } = serializeImport({ localPaperId, title, content: parsedContent, parseError, acknowledged });

      const res = await fetch("/api/private-papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setSubmitError(`该 localPaperId 已存在：${data.error || "重复 ID"}`);
        } else if (res.status === 422) {
          const details = data.details?.join("； ") || "";
          setSubmitError(`内容校验失败：${data.error}${details ? " — " + details : ""}`);
        } else {
          setSubmitError(data.error || `导入失败 (${res.status})`);
        }
        return;
      }

      // Success: redirect to detail page
      const paperId = data.paperId as string;
      succeeded = true;
      if (paperId) {
        router.push(`/me/private-papers/${encodeURIComponent(paperId)}`);
      } else {
        router.push("/me/private-papers");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "网络错误，请重试");
    } finally {
      if (!succeeded) { submitInFlight.current = false; setSubmitting(false); }
    }
  }

  function fieldError(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  return (
    <main className="me-page">
      <header className="me-header">
        <Link href="/me/private-papers" className="me-back-link" aria-label="返回">
          <ArrowLeft size={20} />
        </Link>
        <h1>导入私有卷</h1>
      </header>

      <form onSubmit={handleSubmit} className="pp-import-form" noValidate>
        {/* Mode toggle */}
        <div className="pp-mode-tabs">
          <button
            type="button"
            className={`pp-mode-tab ${mode === "paste" ? "active" : ""}`}
            onClick={() => { activeReader.current?.abort(); activeReader.current = null; setFileReading(false); setMode("paste"); }}
            disabled={submitting}
          >
            <FileJson size={16} /> 粘贴 JSON
          </button>
          <button
            type="button"
            className={`pp-mode-tab ${mode === "file" ? "active" : ""}`}
            onClick={() => setMode("file")}
            disabled={submitting}
          >
            <Upload size={16} /> 选择文件
          </button>
        </div>

        {/* localPaperId */}
        <div className="pp-field">
          <label htmlFor="pp-local-id">localPaperId</label>
          <input
            id="pp-local-id"
            type="text"
            value={localPaperId}
            onChange={(e) => setLocalPaperId(e.target.value)}
            placeholder="my-paper-001"
            className={fieldError("localPaperId") ? "pp-input error" : "pp-input"}
            disabled={submitting}
          />
          {fieldError("localPaperId") && (
            <span className="pp-field-error"><AlertCircle size={12} /> {fieldError("localPaperId")}</span>
          )}
        </div>

        {/* Title */}
        <div className="pp-field">
          <label htmlFor="pp-title">标题</label>
          <input
            id="pp-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="我的私有卷标题"
            className={fieldError("title") ? "pp-input error" : "pp-input"}
            disabled={submitting}
          />
          {fieldError("title") && (
            <span className="pp-field-error"><AlertCircle size={12} /> {fieldError("title")}</span>
          )}
        </div>

        {/* JSON content */}
        <div className="pp-field">
          <label htmlFor="pp-json">内容（JSON）</label>
          {mode === "paste" ? (
            <textarea
              id="pp-json"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={'{\n  "schemaVersion": "1.0.0",\n  "isPartial": true,\n  "sections": []\n}'}
              className={fieldError("content") || parseError ? "pp-textarea error" : "pp-textarea"}
              rows={12}
              disabled={submitting}
              spellCheck={false}
            />
          ) : (
            <div className="pp-file-area">
              <input
                id="pp-json"
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="pp-file-input"
                disabled={submitting}
              />
              {fileName ? (
                <div className="pp-file-name">
                  <CheckCircle size={16} /> {fileName}
                </div>
              ) : (
                <div className="pp-file-placeholder">
                  点击选择 .json 文件（上限 1 MiB）
                </div>
              )}
            </div>
          )}
          {fieldError("content") && (
            <span className="pp-field-error"><AlertCircle size={12} /> {fieldError("content")}</span>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className="pp-preview">
            <h3>预览</h3>
            <div className="pp-preview-grid">
              <div><strong>{preview.sections}</strong><span>Section</span></div>
              <div><strong>{preview.groups}</strong><span>Group</span></div>
              <div><strong>{preview.questions}</strong><span>题目</span></div>
              <div><strong>{preview.isPartial ? "是" : "否"}</strong><span>草稿</span></div>
            </div>
            {preview.isPartial && (
              <p className="pp-preview-note">不完整草稿暂不能开始学习，可后续补充内容。</p>
            )}
          </div>
        )}

        {/* Rights acknowledgement */}
        <div className="pp-field">
          <label className="pp-checkbox-label">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={submitting}
            />
            <span>
              我确认此内容为我自行导入的私有内容，不侵犯他人版权，
              且理解平台不对私有内容的准确性和合法性负责。
              
            </span>
          </label>
          {fieldError("acknowledgement") && (
            <span className="pp-field-error"><AlertCircle size={12} /> {fieldError("acknowledgement")}</span>
          )}
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="pp-error" role="alert">
            <AlertCircle size={16} /> {submitError}
          </div>
        )}

        {/* Submit */}
        <div className="pp-form-actions">
          <Link href="/me/private-papers" className="pp-cancel-btn" aria-disabled={submitting}>
            取消
          </Link>
          <button type="submit" className="pp-submit-btn" disabled={submitting || fileReading || !acknowledged}>
            {submitting ? (
              <><Loader2 size={18} className="spin" /> 导入中…</>
            ) : (
              <><Upload size={18} /> 确认导入</>
            )}
          </button>
        </div>
      </form>

      <div className="me-spacer" />
    </main>
  );
}

