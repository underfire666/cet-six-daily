import { parsePrivateWrongItems } from "./wrong-items";
import { sameReviewQuestion, type PrivateReviewSession } from "./review";
import { parseReviewMutation, parseReviewSnapshot, reconcileReview, type ReviewSnapshot } from "./review-sync";

export interface ReviewState {
  status: "loading" | "idle" | "reviewing" | "submitting" | "submitted" | "error" | "invalid";
  session: PrivateReviewSession | null; error: string | null; storageError: string | null;
  syncStatus: "idle" | "saving" | "saved" | "error" | "conflict"; syncError: string | null;
}
interface Dependencies {
  fetch: typeof fetch;
  readLocal: () => { session: PrivateReviewSession | null; warning: string | null };
  writeLocal: (session: PrivateReviewSession) => void;
  clearLocal: (hash: string) => void;
  isCurrent: () => boolean;
  onState: (state: ReviewState) => void;
}
class HttpError extends Error { constructor(public status: number) { super("复习进度请求失败，请检查网络后重试。"); } }
const errorText = (e: unknown) => e instanceof Error && /[\u4e00-\u9fff]/.test(e.message) ? e.message : "同步失败，答案仍保留在本地。请重试。";
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/** One controller per authenticated scope. Writes serialize; obsolete instances cannot persist. */
export class PrivateReviewController {
  state: ReviewState = { status: "loading", session: null, error: null, storageError: null, syncStatus: "idle", syncError: null };
  private disposed = false;
  private operation = 0;
  private editSerial = 0;
  private blocked = false;
  private mutating = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<boolean> | null = null;
  private controllers = new Set<AbortController>();
  private root: string;
  constructor(private ownerId: string, private paperId: string, private deps: Dependencies) {
    this.root = `/api/private-papers/${encodeURIComponent(paperId)}/wrong-items`;
  }
  private active() { return !this.disposed && this.deps.isCurrent(); }
  private emit(patch: Partial<ReviewState>) {
    if (!this.active()) return;
    this.state = { ...this.state, ...patch };
    this.deps.onState(this.state);
  }
  private persist(session: PrivateReviewSession) {
    if (!this.active()) return null;
    try { this.deps.writeLocal(session); return null; }
    catch { return "本地存档失败。答案仍保留在本页，刷新可能丢失尚未同步的修改。"; }
  }
  private apply(session: PrivateReviewSession | null, syncStatus: ReviewState["syncStatus"] = "saved") {
    if (!this.active()) return;
    const storageError = session ? this.persist(session) : this.state.storageError;
    this.emit({ session, status: session ? (session.submitted ? "submitted" : "reviewing") : "idle", storageError, error: null, syncStatus: session ? syncStatus : "idle", syncError: null });
  }
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  dispose() { this.disposed = true; this.operation++; this.clearTimer(); for (const c of this.controllers) c.abort(); }
  private async request(path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController(); this.controllers.add(controller);
    try {
      const res = await this.deps.fetch(this.root + path, { method: body === undefined ? "GET" : "POST", ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), cache: "no-store", signal: controller.signal });
      if (!this.active()) throw new Error("obsolete request");
      if (!res.ok) throw new HttpError(res.status);
      const data: unknown = await res.json();
      if (!this.active()) throw new Error("obsolete response");
      return data;
    } finally { this.controllers.delete(controller); }
  }
  private fail(e: unknown, operation: number, fallbackStatus: ReviewState["status"] = "error") {
    if (!this.active() || operation !== this.operation) return;
    if (e instanceof HttpError && [401,404,422].includes(e.status)) {
      this.blocked = true;
      this.emit({ status: "invalid", session: null, error: "登录、试卷或题目状态已变化，请返回错题本重新检查。", syncStatus: "error", syncError: null });
    } else if (e instanceof HttpError && e.status === 409) {
      this.blocked = true;
      this.emit({ status: this.state.session ? "reviewing" : "error", syncStatus: "conflict", syncError: "云端进度已变化。本地作答已保留，请选择如何继续。", error: null });
    } else this.emit({ status: fallbackStatus, error: fallbackStatus === "error" ? errorText(e) : null, syncStatus: "error", syncError: errorText(e) });
  }
  private async cloud(): Promise<{ snapshot: ReviewSnapshot; valid: (session: PrivateReviewSession) => boolean }> {
    const snapshot = parseReviewSnapshot(await this.request("/review/progress"), this.ownerId, this.paperId);
    const wrong = parsePrivateWrongItems(await this.request(""), this.ownerId, this.paperId);
    const valid = (s: PrivateReviewSession) => s.questions.every(q => wrong.items.some(item => item.status === "active" && item.removedAt === null && item.contentHash === s.contentHash && item.questionId === q.questionId && item.question && sameReviewQuestion(q, { questionId: item.questionId, ...item.question })));
    if (snapshot.progress && !valid(snapshot.progress)) return { snapshot: { progress: null, revision: snapshot.revision, invalidated: true }, valid };
    return { snapshot, valid };
  }
  async load(choice?: "cloud" | "local") {
    if (!this.active() || this.mutating) return;
    const operation = ++this.operation;
    this.clearTimer();
    this.emit({ status: "loading", error: null });
    if (this.saving) await this.saving;
    if (!this.active() || operation !== this.operation) return;
    const restored = this.state.session ? { session: this.state.session, warning: this.state.storageError } : this.deps.readLocal();
    const local = restored.session;
    this.emit({ session: local, storageError: restored.warning });
    try {
      const { snapshot, valid } = await this.cloud();
      if (!this.active() || operation !== this.operation) return;
      if (snapshot.invalidated || (local && (local.syncDirty || local.syncRevision === undefined) && !valid(local))) {
        this.blocked = true;
        this.emit({ status: "invalid", session: null, error: "内容版本或错题已变化，此批次失效。本地草稿仍保留，请重新开始复习。", syncStatus: "idle", syncError: null });
        return;
      }
      if (choice === "local" && local) {
        if (!valid(local)) throw new Error("本地批次题目已失效，不能覆盖云端。草稿仍保留。");
        let target = snapshot.progress;
        if (!target || target.submitted || target.reviewBatchId !== local.reviewBatchId) {
          target = parseReviewMutation(await this.request("/review/start", { limit: 5, resume: { baseRevision: snapshot.revision, contentHash: local.contentHash, questionIds: local.questions.map(q => q.questionId) } }), this.ownerId, this.paperId);
          if (!this.active() || operation !== this.operation) return;
        }
        if (target.contentHash !== local.contentHash || target.questions.length !== local.questions.length || !target.questions.every((q,i) => sameReviewQuestion(q,local.questions[i]))) throw new Error("本地与云端题目不同，草稿仍保留，不能直接覆盖。");
        this.blocked = false; this.editSerial++;
        this.apply({ ...local, reviewBatchId: target.reviewBatchId, submitted: false, result: undefined, submittedAt: undefined, syncRevision: target.syncRevision, syncDirty: true, updatedAt: new Date().toISOString() }, "saving");
        void this.flush();
        return;
      }
      const decision = choice === "cloud" ? "cloud" : reconcileReview(local, snapshot);
      if (decision === "conflict") {
        this.blocked = true;
        this.emit({ status: local?.submitted ? "submitted" : "reviewing", session: local, syncStatus: "conflict", syncError: "云端进度与本地未同步作答不同。请选择采用云端，或保留本地作答。", error: null });
      } else if (decision === "local" && local) {
        this.blocked = false; this.apply(local, "saving"); void this.flush();
      } else {
        this.blocked = false;
        if (!snapshot.progress && local && choice === "cloud") {
          try { this.deps.clearLocal(local.contentHash); } catch { this.emit({ storageError: "旧本地存档清理失败。" }); }
        }
        this.apply(snapshot.progress);
      }
    } catch(e) { this.fail(e, operation); }
  }
  private schedule() {
    this.clearTimer();
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 800);
  }
  edit(update: (s: PrivateReviewSession) => PrivateReviewSession | null) {
    const current = this.state.session;
    if (!this.active() || this.state.status !== "reviewing" || !current || current.submitted) return;
    const changed = update(current); if (!changed) return;
    this.editSerial++;
    this.apply({ ...changed, syncDirty: true, updatedAt: new Date().toISOString() }, this.blocked ? "conflict" : "saving");
    if (!this.blocked) this.schedule();
  }
  /** At most one request in flight. A response acknowledges only its captured edit serial. */
  flush(): Promise<boolean> {
    this.clearTimer();
    if (this.saving) return this.saving;
    const run = async () => {
      while (this.active() && !this.blocked && this.state.session?.syncDirty && !this.state.session.submitted) {
        const session = this.state.session, serial = this.editSerial;
        const baseRevision = session.syncRevision;
        if (!Number.isSafeInteger(baseRevision)) { this.blocked = true; this.emit({ syncStatus: "conflict", syncError: "本地草稿需要先核对云端版本。" }); return false; }
        this.emit({ syncStatus: "saving", syncError: null });
        try {
          const data = await this.request("/review/progress/save", { reviewBatchId: session.reviewBatchId, contentHash: session.contentHash, answers: session.answers, currentIndex: session.currentIndex, baseRevision });
          if (!this.active() || this.state.session?.reviewBatchId !== session.reviewBatchId) return false;
          if (!record(data) || data.ownerId !== this.ownerId || data.paperId !== this.paperId || data.revision !== Number(baseRevision)+1 || typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("保存响应数据异常，尚未确认同步成功。");
          const latest = this.state.session;
          const acknowledged = { ...latest, syncRevision: Number(data.revision), syncDirty: serial !== this.editSerial };
          // Keep current status (e.g. submitting) and latest answers, never the old request snapshot.
          this.emit({ session: acknowledged, storageError: this.persist(acknowledged), syncStatus: acknowledged.syncDirty ? "saving" : "saved", syncError: null });
        } catch(e) {
          // A load/start may now be awaiting this write; keep its latest state, and let it recheck.
          if (this.active()) this.fail(e, this.operation, this.state.status === "submitting" ? "reviewing" : this.state.status);
          return false;
        }
      }
      return this.active() && !this.blocked && this.state.syncStatus !== "error";
    };
    this.saving = run().finally(() => { this.saving = null; });
    return this.saving;
  }
  async start() {
    if (!this.active() || this.mutating) return;
    this.mutating = true;
    const operation = ++this.operation;
    this.clearTimer(); this.emit({ status: "loading", error: null });
    if (this.saving) await this.saving;
    if (!this.active() || operation !== this.operation) { this.mutating = false; return; }
    try {
      const session = parseReviewMutation(await this.request("/review/start", { limit: 5 }), this.ownerId, this.paperId);
      if (!this.active() || operation !== this.operation) return;
      this.blocked = false; this.editSerial++;
      this.apply(session);
    } catch(e) { this.fail(e, operation); }
    finally { this.mutating = false; }
  }
  async submit(): Promise<boolean> {
    if (!this.active() || this.mutating || this.state.status !== "reviewing" || !this.state.session || this.state.session.submitted || this.blocked) return false;
    this.mutating = true;
    const operation = ++this.operation;
    this.clearTimer(); this.emit({ status: "submitting", error: null });
    if (!await this.flush()) {
      if (this.active() && operation === this.operation && ["submitting"].includes(this.state.status)) this.emit({ status: "reviewing" });
      this.mutating = false; return false;
    }
    if (!this.active() || operation !== this.operation) { this.mutating = false; return false; }
    const session = this.state.session!;
    this.emit({ syncStatus: "saving", syncError: null });
    try {
      const submitted = parseReviewMutation(await this.request("/review/grade", { reviewBatchId: session.reviewBatchId, contentHash: session.contentHash, answers: session.answers, baseRevision: session.syncRevision }), this.ownerId, this.paperId);
      if (!this.active() || operation !== this.operation) return false;
      if (!submitted.submitted || submitted.reviewBatchId !== session.reviewBatchId || submitted.contentHash !== session.contentHash || submitted.questions.length !== session.questions.length || !submitted.questions.every((q,i) => sameReviewQuestion(q,session.questions[i]) && submitted.answers[q.questionId] === session.answers[q.questionId])) throw new Error("提交结果与当前作答不一致。");
      this.apply(submitted);
      return true;
    } catch(e) { this.fail(e, operation, "reviewing"); return false; }
    finally { this.mutating = false; }
  }
}
