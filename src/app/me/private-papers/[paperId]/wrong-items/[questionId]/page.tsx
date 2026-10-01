import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import WrongItemDetailClient from "./WrongItemDetailClient";
import { privatePaperIdFromRoute } from "@/lib/private-papers/validation";

export default async function Page({ params }: { params: Promise<{ paperId: string; questionId: string }> }) {
  const { paperId: routeId, questionId } = await params;
  const returnSegment = routeId.startsWith("private:") ? encodeURIComponent(routeId) : routeId;
  if (!(await auth())?.user?.id) redirect("/login?callbackUrl=" + encodeURIComponent(`/me/private-papers/${returnSegment}/wrong-items/${encodeURIComponent(questionId)}`));
  let paperId: string;
  try { paperId = privatePaperIdFromRoute(routeId); } catch { notFound(); }
  return <WrongItemDetailClient key={`${paperId}:${questionId}`} paperId={paperId} questionId={questionId} />;
}
