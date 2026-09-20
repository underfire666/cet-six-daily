import { ListeningComplete } from "@/components/listening/ListeningComplete";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ListeningComplete id={id} />;
}
