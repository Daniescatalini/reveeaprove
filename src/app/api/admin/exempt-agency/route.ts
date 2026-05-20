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
    const email = body.email ? String(body.email) : null;
    const reason = body.reason ? String(body.reason) : "Conta liberada manualmente";

    if (!agencyId && !email) return NextResponse.json({ error: "Informe agencyId ou email." }, { status: 400 });

    let targetAgencyId = agencyId;
    if (!targetAgencyId && email) {
      const { data: user } = await supabaseAdmin.from("users").select("agency_id").eq("email", email).maybeSingle();
      targetAgencyId = user?.agency_id;
    }
    if (!targetAgencyId) return NextResponse.json({ error: "Agência não encontrada." }, { status: 404 });

    await supabaseAdmin.rpc("mark_agency_exempt", {
      target_agency_id: targetAgencyId,
      exemption_reason: reason
    });

    return NextResponse.json({ ok: true, agencyId: targetAgencyId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao liberar conta." }, { status: 500 });
  }
}
