"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ReveeLogo } from "@/components/logo";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Confirmando seu acesso...");

  useEffect(() => {
    async function confirmEmail() {
      if (!supabase) {
        window.location.replace("/?auth_error=missing_config");
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        await supabase.auth.signOut();
        setMessage("E-mail confirmado. Redirecionando para o login...");
        window.location.replace("/?confirmed=true");
      } catch {
        setMessage("Não conseguimos confirmar esse link.");
        window.location.replace("/?auth_error=confirmation_failed");
      }
    }

    void confirmEmail();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-4 text-white">
      <div className="flex flex-col items-center gap-4 rounded-[24px] border border-white/10 bg-white/10 px-8 py-7 text-center shadow-modal">
        <ReveeLogo tone="light" className="h-7" />
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <p className="text-sm text-white/75">{message}</p>
      </div>
    </main>
  );
}
