import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-1 text-2xl font-bold">CRM Meshy</h1>
        <p className="mb-6 text-slate-600">Sign in with your mobile number.</p>
        <LoginForm notice={error === "inactive" ? "Your account is switched off. Please contact your admin." : undefined} />
      </div>
    </main>
  );
}
