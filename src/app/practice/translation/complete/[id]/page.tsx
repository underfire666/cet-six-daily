import { TranslationComplete } from "@/components/translation/TranslationComplete";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TranslationComplete id={id} />;
}
