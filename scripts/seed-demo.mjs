// Fills a LOCAL database with sample teams, people and leads for trying the app.
// Never run this against production.
// Usage: node --env-file=.env.local scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";

if (!/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  console.error("Refusing to seed: NEXT_PUBLIC_SUPABASE_URL is not a local database.");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const teams = must(await db.from("teams").insert([{ name: "Kochi" }, { name: "Bengaluru" }]).select());
const products = must(await db.from("products").insert([{ name: "Solar Rooftop" }, { name: "Home Inverter" }, { name: "EV Charger" }]).select());
const regions = must(await db.from("regions").insert([{ name: "Kerala" }, { name: "Karnataka" }, { name: "Tamil Nadu" }]).select());

const people = [
  ["Elzi Admin", "9000000001", null, ["admin"]],
  ["Maya Manager", "9000000002", teams[0].id, ["sales_manager"]],
  ["Ravi Sales", "9000000003", teams[0].id, ["sales_person"]],
  ["Anu Sales", "9000000004", teams[0].id, ["sales_person", "call_executive"]],
  ["Cyril Caller", "9000000005", teams[0].id, ["call_executive"]],
  ["Deepa Demo", "9000000006", null, ["demo_manager"]],
  ["Kiran Sales", "9000000007", teams[1].id, ["sales_person"]],
  ["Bina Manager", "9000000008", teams[1].id, ["sales_manager"]],
];
const ids = {};
for (const [full_name, mobile, team_id, roles] of people) {
  const phone = `+91${mobile}`;
  const email = `${full_name.split(" ")[0].toLowerCase()}@elzy.test`;
  const { user } = must(await db.auth.admin.createUser({ email, password: "Password1", email_confirm: true }));
  const id = user.id;
  ids[full_name] = id;
  must(await db.from("profiles").insert({ id, full_name, email, phone, team_id, capacity: 15 }));
  must(await db.from("user_roles").insert(roles.map((role) => ({ user_id: id, role }))));
}

const first = ["Asha", "Vivek", "Fathima", "Joseph", "Lakshmi", "Arjun", "Sneha", "Rahul", "Divya", "Nikhil", "Meera", "Suresh", "Priya", "Anand", "Reshma", "Tom", "Neha", "Hari"];
const sources = ["facebook", "instagram", "whatsapp", "website", "call", "manual"];
for (let i = 0; i < 36; i++) {
  const team = i % 3 === 2 ? teams[1] : teams[0];
  must(
    await db.from("leads").insert({
      full_name: `${first[i % first.length]} ${String.fromCharCode(65 + (i % 26))}.`,
      phone: `+9198${String(10000000 + i * 7919).slice(0, 8)}`,
      source: sources[i % sources.length],
      product_id: products[i % products.length].id,
      region_id: regions[i % regions.length].id,
      team_id: team.id,
      consent_given: true,
      consent_note: "Seed data",
    }),
  );
}

// Move some leads along the journey, acting as the system (service role).
const leads = must(await db.from("leads").select("id, team_id").order("created_at"));
const plan = ["responsive", "not_responsive", "demo_agreed", "converted", "declined", "demo_done"];
for (let i = 0; i < 24; i++) {
  const status = plan[i % plan.length];
  const patch = { status };
  if (status === "converted") patch.deal_value = 40000 + i * 2500;
  if (status === "declined") patch.decline_reason = "Price too high";
  if (status === "demo_done") patch.demo_at = new Date(Date.now() - 86400000).toISOString();
  must(await db.from("leads").update(patch).eq("id", leads[i].id));
}
const month = new Date().toISOString().slice(0, 7) + "-01";
must(await db.from("targets").insert([{ team_id: teams[0].id, month, revenue_target: 500000, conversion_target: 10 }, { user_id: ids["Ravi Sales"], month, revenue_target: 200000, conversion_target: 4 }]));
console.log("Seeded. Password1 for everyone: elzi@elzy.test (admin), maya@elzy.test (manager), ravi@elzy.test (sales), deepa@elzy.test (demo).");
