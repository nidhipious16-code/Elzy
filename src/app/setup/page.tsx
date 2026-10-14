import { redirect } from "next/navigation";
import { adminExists } from "./actions";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

// One-time page to create the first admin. Once an admin exists it sends
// everyone to sign in instead.
export default async function SetupPage() {
  if (await adminExists()) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-1 text-2xl font-bold">Welcome to Elzy</h1>
        <p className="mb-6 text-slate-600">Create the first admin account. You can add everyone else from the Team page afterwards.</p>
        <SetupForm />
      </div>
    </main>
  );
}
