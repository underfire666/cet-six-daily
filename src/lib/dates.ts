const DAY = 86_400_000;
export function todayInShanghai(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function addDays(value: string, amount: number): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + amount * DAY)
    .toISOString()
    .slice(0, 10);
}
export function dayDifference(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );
}
export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function monthCells(month: string): (string | null)[] {
  const first = `${month}-01`;
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const count = dayDifference(first, `${shiftMonth(month, 1)}-01`);
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let index = 0; index < count; index++) cells.push(addDays(first, index));
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function shortDate(value: string): string {
  return `${Number(value.slice(5, 7))} 月 ${Number(value.slice(8))} 日`;
}
export function countdownText(today: string, exam: string): string {
  const days = dayDifference(today, exam);
  return days > 0
    ? `距离六级考试还有 ${days} 天`
    : days === 0
      ? "今天是六级考试日，加油！"
      : "本次目标日期已结束，请更新考试日期";
}
