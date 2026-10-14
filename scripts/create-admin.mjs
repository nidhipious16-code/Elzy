// Creates the first admin account.
// Usage: node --env-file=.env.local scripts/create-admin.mjs "<full name>" <mobile> <password>
import { createClient } from "@supabase/supabase-js";

const [name, rawPhone, password] = process.argv.slice(2);
if (!name || !rawPhone || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs "Full Name" 9876543210 "Password1"');
  process.exit(1);
}
const digits = rawPhone.replace(/\D/g, "");
const phone = rawPhone.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+${process.env.DEFAULT_COUNTRY_CODE ?? "91"}${digits}` : `+${digits}`;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await supabase.auth.admin.createUser({ phone, password, phone_confirm: true });
if (error) throw error;
const id = data.user.id;
const { error: pErr } = await supabase.from("profiles").insert({ id, full_name: name, phone });
if (pErr) throw pErr;
const { error: rErr } = await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
if (rErr) throw rErr;
console.log(`Admin created. Sign in with ${phone}.`);
