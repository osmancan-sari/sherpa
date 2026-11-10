"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Signs out on this device only; the other screen keeps its session. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/giris");
}
