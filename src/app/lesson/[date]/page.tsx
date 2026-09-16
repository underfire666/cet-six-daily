import { notFound } from "next/navigation";
import { validDate } from "@/lib/dates";
import { Placeholder } from "@/components/Placeholder";
export default async function Page({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!validDate(date)) notFound();
  return <Placeholder kind="lesson" value={date} />;
}
