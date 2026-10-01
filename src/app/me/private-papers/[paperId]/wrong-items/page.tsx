import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import WrongItemsClient from "./WrongItemsClient";
import { privatePaperIdFromRoute } from "@/lib/private-papers/validation";

export default async function Page({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId: routeId } = await params;
  const returnSegment = routeId.startsWith("private:") ? encodeURIComponent(routeId) : routeId;
  if (!(await auth())?.user?.id) redirect("/login?callbackUrl=" + encodeURIComponent(`/me/private-papers/${returnSegment}/wrong-items`));
  let paperId: string;
  try { paperId = privatePaperIdFromRoute(routeId); } catch { notFound(); }
  return <WrongItemsClient key={paperId} paperId={paperId} />;
}
