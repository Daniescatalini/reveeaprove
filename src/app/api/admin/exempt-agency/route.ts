import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: "Supabase admin não configurado." }, { status: 500 });
    const adminSecret = process.env.REVEE_ADMIN_SECRET;
    if (adminSecret && request.headers.get("x-revee-admin-secret") !== adminSecret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const agencyId = String(body.agencyId ?? "");
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const reason = body.reason ? String(body.reason) : "Conta liberada manualmente";

    if (!agencyId && !email) return NextResponse.json({ error: "Informe agencyId ou email." }, { status: 400 });

    let targetAgencyId = agencyId;
    if (!targetAgencyId && email) {
      const { data: user } = await supabaseAdmin.from("users").select("agency_id").ilike("email", email).maybeSingle();
      targetAgencyId = user?.agency_id;
    }

    if (!targetAgencyId && email) {
      const { data: existing } = await supabaseAdmin
        .from("exempt_accounts")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (existing?.id) {
        await supabaseAdmin.from("exempt_accounts").update({ reason }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("exempt_accounts").insert({ email, reason });
      }

      return NextResponse.json({ ok: true, pending: true, email });
    }

    if (!targetAgencyId) return NextResponse.json({ error: "Agência não encontrada." }, { status: 404 });

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("subscriptions")
      .upsert({
        agency_id: targetAgencyId,
        plan: "premium",
        billing_cycle: "monthly",
        status: "exempt",
        past_due_since: null,
        suspended_at: null,
        cancelled_at: null,
        payment_method: "Conta liberada manualmente",
        updated_at: now
      }, { onConflict: "agency_id" });

    if (email) {
      const { data: existing } = await supabaseAdmin
        .from("exempt_accounts")
        .select("id")
        .or(`agency_id.eq.${targetAgencyId},email.ilike.${email}`)
        .maybeSingle();
      if (existing?.id) {
        await supabaseAdmin.from("exempt_accounts").update({ agency_id: targetAgencyId, email, reason }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("exempt_accounts").insert({ agency_id: targetAgencyId, email, reason });
      }
    }

    return NextResponse.json({ ok: true, agencyId: targetAgencyId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao liberar conta." }, { status: 500 });
  }
}
