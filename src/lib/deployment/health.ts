import { Prisma } from "@prisma/client";
import packageJson from "../../../package.json";

const responseHeaders = { "Cache-Control": "no-store" };

// These are the current application's tables, not user data or connection details.
export const REQUIRED_DATABASE_TABLES = [
  "User", "Profile", "StudyPreferences", "LearningSession", "XpEvent",
  "WordbookEntry", "ReviewItem", "DailyPlanState", "TranslationHistory",
  "WritingHistory", "UserSettings", "SyncMutation", "MigrationRecord",
  "PrivatePaper", "PrivatePaperProgress", "PrivateReviewProgress", "PrivateWrongItem",
] as const;

interface ReadinessRow {
  connected: number;
  schema_ready: boolean;
}

export interface ReadinessQueryClient {
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
}

export function healthResponse(): Response {
  return Response.json(
    { status: "ok", version: packageJson.version },
    { status: 200, headers: responseHeaders },
  );
}

/** A read-only PostgreSQL probe; an empty, unmigrated database must not be ready. */
export async function checkDatabaseReadiness(client: ReadinessQueryClient): Promise<boolean> {
  const rows = await client.$queryRaw<ReadinessRow[]>(Prisma.sql`
    SELECT 1 AS connected,
      NOT EXISTS (
        SELECT 1
        FROM unnest(ARRAY[${Prisma.join([...REQUIRED_DATABASE_TABLES])}]::text[]) AS required_table(name)
        WHERE to_regclass(format('%I.%I', current_schema(), required_table.name)) IS NULL
      ) AS schema_ready
  `);
  return rows[0]?.connected === 1 && rows[0]?.schema_ready === true;
}

export function createReadinessHandler(
  probe: () => Promise<boolean>,
  { timeoutMs = 3_000 }: { timeoutMs?: number } = {},
): () => Promise<Response> {
  let inFlight: Promise<boolean> | undefined;

  function sharedProbe(): Promise<boolean> {
    if (inFlight) return inFlight;
    // Wrap synchronous exceptions and consume delayed rejections after a timeout.
    const pending = Promise.resolve().then(probe).then((ready) => ready === true, () => false);
    inFlight = pending;
    void pending.then(() => {
      if (inFlight === pending) inFlight = undefined;
    });
    return pending;
  }

  return async function readinessResponse(): Promise<Response> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const ready = await Promise.race([
        sharedProbe(),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
      return Response.json(
        { status: ready ? "ready" : "unavailable", version: packageJson.version },
        { status: ready ? 200 : 503, headers: responseHeaders },
      );
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
}
