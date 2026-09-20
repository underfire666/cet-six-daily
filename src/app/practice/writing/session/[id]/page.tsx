import { WritingSessionPlayer } from "@/components/writing/WritingSessionPlayer";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WritingSessionPlayer id={id} />;
}
