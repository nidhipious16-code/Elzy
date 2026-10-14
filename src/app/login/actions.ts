"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

export async function signIn(_prev: { error?: string } | undefined, formData: FormData) {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!phone || !password) return { error: "Enter your mobile number and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ phone, password });
  if (error) {
    // Same message whether the number or the password is wrong.
    return { error: "That mobile number and password don't match. Please try again." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
