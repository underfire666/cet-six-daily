import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPrivatePaper, PrivatePaperStoreError } from "@/content/private-paper-store";
import { checkPrivatePaperReadiness, type PrivateFlatQuestion } from "@/lib/private-papers/readiness";
import { privatePaperIdFromRoute } from "@/lib/private-papers/validation";
import StudyClient from "./StudyClient";

export default async function StudyPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId: routeId } = await params;
  const returnSegment = routeId.startsWith("private:") ? encodeURIComponent(routeId) : routeId;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=" + encodeURIComponent(`/me/private-papers/${returnSegment}/study`));
  }

  let paperId: string;
  try {
    paperId = privatePaperIdFromRoute(routeId);
  } catch {
    notFound();
  }

  let paper;
  try {
    paper = await getPrivatePaper(session.user.id, paperId);
  } catch (err) {
    if (err instanceof PrivatePaperStoreError && err.code === "NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  const readiness = checkPrivatePaperReadiness(paper.content);
  const questions: PrivateFlatQuestion[] = readiness.questions;

  return (
    <StudyClient
      key={paperId}
      paperId={paperId}
      paperTitle={paper.title}
      questions={questions}
      contentHash={readiness.contentHash}
      ready={readiness.ready}
      notReadyReason={readiness.reason}
    />
  );
}
