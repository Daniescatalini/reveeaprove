import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: "Supabase admin não configurado." }, { status: 500 });

    const body = await request.json();
    const agencyId = String(body.agencyId ?? "");
    const email = body.email ? String(body.email).trim().toLowerCase() : "";

    if (!agencyId) return NextResponse.json({ error: "Agência não informada." }, { status: 400 });

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Sessão não informada." }, { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("agency_id, email, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    const profileEmail = String(profile?.email ?? authData.user.email ?? "").trim().toLowerCase();
    if (profile?.role !== "agency" || profile?.agency_id !== agencyId || (email && profileEmail !== email)) {
      return NextResponse.json({ error: "Conta não autorizada para esta agência." }, { status: 403 });
    }

    const { data: exemptionByAgency } = await supabaseAdmin
      .from("exempt_accounts")
      .select("*")
      .eq("agency_id", agencyId)
      .maybeSingle();

    let exemption = exemptionByAgency;

    if (!exemption && email) {
      const { data: exemptionByEmail } = await supabaseAdmin
        .from("exempt_accounts")
        .select("*")
        .ilike("email", email)
        .maybeSingle();
      exemption = exemptionByEmail;
    }

    if (!exemption) return NextResponse.json({ exempt: false });

    const now = new Date().toISOString();
    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        agency_id: agencyId,
        plan: "premium",
        billing_cycle: "monthly",
        status: "exempt",
        past_due_since: null,
        suspended_at: null,
        cancelled_at: null,
        payment_method: "Conta liberada manualmente",
        updated_at: now
      }, { onConflict: "agency_id" })
      .select()
      .single();

    if (subscriptionError) throw subscriptionError;

    if (exemption.id && (!exemption.agency_id || exemption.agency_id !== agencyId)) {
      await supabaseAdmin
        .from("exempt_accounts")
        .update({ agency_id: agencyId, email: exemption.email ?? (email || null) })
        .eq("id", exemption.id);
    }

    return NextResponse.json({ exempt: true, subscription });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar liberação manual." },
      { status: 500 }
    );
  }
}
