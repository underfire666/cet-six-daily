import { PrivatePaperStoreError } from "@/content/private-paper-store";
import { isRecord } from "@/content/private-paper-validation";

export const PRIVATE_BODY_LIMIT = 1024 * 1024;
class BodyError extends Error { constructor(public status: number, message: string) { super(message); } }
/** Count actual stream bytes before decoding/parsing, even without Content-Length. */
export async function readPrivateBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > PRIVATE_BODY_LIMIT) throw new BodyError(413, "request body exceeds 1 MiB");
  if (!request.body) throw new BodyError(400, "JSON object required");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > PRIVATE_BODY_LIMIT) {
        void reader.cancel().catch(() => {});
        throw new BodyError(413, "request body exceeds 1 MiB");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isRecord(body)) throw new BodyError(400, "JSON object required");
    return body;
  } catch (error) {
    if (error instanceof BodyError) throw error;
    throw new BodyError(400, "invalid JSON body");
  } finally { reader.releaseLock(); }
}
export function privateErrorResponse(error: unknown): Response {
  if (error instanceof BodyError) return Response.json({ error: error.message }, {
    status: error.status,
    // An unread/cancelled oversized upload must not reuse its HTTP/1 connection.
    headers: error.status === 413 ? { Connection: "close" } : undefined,
  });
  if (error instanceof PrivatePaperStoreError) {
    const status = { UNAUTHORIZED: 401, NOT_FOUND: 404, VALIDATION_ERROR: 422, DUPLICATE_ID: 409, INTERNAL_ERROR: 500 }[error.code];
    return Response.json({ error: error.message, code: error.code, details: error.details }, { status });
  }
  return Response.json({ error: "internal error" }, { status: 500 });
}
/** Keep authentication ahead of parsing and catch session/params/database failures. */
export async function privateRequest(
  session: () => Promise<{ user?: { id?: string } } | null>,
  operation: (ownerId: string) => Promise<Response>,
): Promise<Response> {
  try {
    const ownerId = (await session())?.user?.id;
    if (!ownerId) return Response.json({ error: "unauthorized" }, { status: 401 });
    return await operation(ownerId);
  } catch (error) { return privateErrorResponse(error); }
}
