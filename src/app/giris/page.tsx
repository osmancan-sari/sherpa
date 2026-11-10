import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sherpa</h1>
          <p className="text-muted-foreground text-sm">
            E-postana tek kullanımlık bir kod gönderilir.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
