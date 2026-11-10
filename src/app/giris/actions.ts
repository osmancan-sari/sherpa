"use server";

import { redirect } from "next/navigation";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth/allowed-email";
import { createClient } from "@/lib/supabase/server";
import { forgetPendingLogin, rememberPendingLogin } from "./pending";
import type { LoginState } from "./state";

/**
 * One action for the whole login form. The `intent` field says which button was pressed:
 * `request` sends a code, `resend` sends another, `verify` checks it,
 * `reset` goes back to the e-mail step.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const intent = String(formData.get("intent") ?? "request");
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (intent === "reset") {
    await forgetPendingLogin();
    return { step: "email" };
  }

  // Single user: any other address is turned away before Supabase is even asked.
  if (!isAllowedEmail(email, process.env.ALLOWED_EMAIL)) {
    return { step: "email", email, error: "Bu e-posta ile giriş yapılamıyor." };
  }

  const supabase = await createClient();

  if (intent === "verify") {
    const token = String(formData.get("token") ?? "").replace(/\D/g, "");
    // The code's length is set in Supabase (supabase/config.toml: otp_length); it is never under 6.
    if (token.length < 6) {
      return { step: "code", email, error: "Kodu eksiksiz yaz." };
    }

    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      return { step: "code", email, error: "Kod geçersiz ya da süresi dolmuş." };
    }
    await forgetPendingLogin();
    redirect("/");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    const message =
      error.status === 429
        ? "Çok sık denendi. Biraz sonra yeniden dene."
        : "Kod gönderilemedi. Yeniden dene.";
    // A resend that fails leaves the earlier code usable, so stay on the code step.
    return { step: intent === "resend" ? "code" : "email", email, error: message };
  }

  await rememberPendingLogin(email);
  return {
    step: "code",
    email,
    notice: intent === "resend" ? "Yeni kod gönderildi." : undefined,
  };
}
