import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import ListClient from "./ListClient";
export default async function Page() {
  if (!(await auth())?.user?.id) redirect("/login?callbackUrl=" + encodeURIComponent("/me/private-papers"));
  return <ListClient />;
}
