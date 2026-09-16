import { notFound } from "next/navigation";
import { modules } from "@/data/mock";
import { Placeholder } from "@/components/Placeholder";
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!modules.some((item) => item.key === module)) notFound();
  return <Placeholder kind="practice" value={module} />;
}
