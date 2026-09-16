import { Suspense } from "react";
import { notFound } from "next/navigation";
import { validDate } from "@/lib/dates";
import { LessonComplete } from "@/components/lesson/LessonComplete";
export default async function Page({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!validDate(date)) notFound();
  return (
    <Suspense>
      <LessonComplete date={date} />
    </Suspense>
  );
}
