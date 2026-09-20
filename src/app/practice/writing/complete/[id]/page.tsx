import { WritingComplete } from "@/components/writing/WritingComplete";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WritingComplete id={id} />;
}
