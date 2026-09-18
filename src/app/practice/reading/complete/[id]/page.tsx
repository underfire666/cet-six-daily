import { ReadingComplete } from "@/components/reading/ReadingComplete";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReadingComplete id={id} />;
}
