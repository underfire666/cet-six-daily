import { ReadingSessionPlayer } from "@/components/reading/ReadingSessionPlayer";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReadingSessionPlayer id={id} />;
}
