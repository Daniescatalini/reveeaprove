import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin não configurado." }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const agencyId = String(body?.agencyId ?? "");
  const workspace = body?.workspace && typeof body.workspace === "object" ? body.workspace : null;
  const name = typeof workspace?.name === "string" ? workspace.name.trim() : "";

  if (!agencyId || !workspace || !name) {
    return NextResponse.json({ error: "Dados do perfil incompletos." }, { status: 400 });
  }

  const { data: userRow, error: userError } = await supabaseAdmin
    .from("users")
    .select("id,role,agency_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (userError || !userRow || userRow.agency_id !== agencyId || userRow.role !== "agency") {
    return NextResponse.json({ error: "Sem permissão para editar este perfil." }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("agencies")
    .update({ name, workspace_settings: workspace })
    .eq("id", agencyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
