/** Accept only relative same-origin return paths, never an external redirect. */
export function loginReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f\x7f]/u.test(value)) return "/me";
  try {
    const url = new URL(value, "https://local.invalid");
    return url.origin === "https://local.invalid" ? url.pathname + url.search + url.hash : "/me";
  } catch { return "/me"; }
}
