// Creates the first admin account.
// Usage: node --env-file=.env.local scripts/create-admin.mjs "<full name>" <email> <password>
import { createClient } from "@supabase/supabase-js";

const [name, rawEmail, password] = process.argv.slice(2);
if (!name || !rawEmail || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs "Full Name" you@company.com "Password1"');
  process.exit(1);
}
const email = rawEmail.trim().toLowerCase();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const id = data.user.id;
const { error: pErr } = await supabase.from("profiles").insert({ id, full_name: name, email });
if (pErr) throw pErr;
const { error: rErr } = await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
if (rErr) throw rErr;
console.log(`Admin created. Sign in with ${email}.`);
