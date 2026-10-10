import { prisma } from "@/lib/db/prisma";
import { checkDatabaseReadiness, createReadinessHandler } from "@/lib/deployment/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readinessResponse = createReadinessHandler(() => prisma.$transaction(
  (transaction) => checkDatabaseReadiness(transaction),
  { maxWait: 1_000, timeout: 2_000 },
));

export function GET(): Promise<Response> {
  return readinessResponse();
}
