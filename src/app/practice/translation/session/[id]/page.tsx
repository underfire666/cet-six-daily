import { TranslationSessionPlayer } from "@/components/translation/TranslationSessionPlayer";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TranslationSessionPlayer id={id} />;
}
