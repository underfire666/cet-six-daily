import { healthResponse } from "@/lib/deployment/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return healthResponse();
}
