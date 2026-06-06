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

  const { data: userRow, error: userError } = await supabaseAdmin
    .from("users")
    .select("id,role,agency_id,client_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (userError || !userRow) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const target = String(body?.target ?? "");
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const avatar = typeof body?.avatar === "string" ? body.avatar : undefined;

  if (!name) {
    return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  }

  if (target === "client") {
    const clientId = String(body?.clientId ?? "");
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id,agency_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientRow) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const canSync =
      (userRow.role === "client" && userRow.client_id === clientId) ||
      (userRow.agency_id === clientRow.agency_id && (userRow.role === "agency" || userRow.role === "member"));

    if (!canSync) {
      return NextResponse.json({ error: "Sem permissão para sincronizar este cliente." }, { status: 403 });
    }

    const patch = { name, ...(avatar ? { avatar } : {}) };
    const { error: clientUpdateError } = await supabaseAdmin.from("clients").update(patch).eq("id", clientId);
    if (clientUpdateError) {
      return NextResponse.json({ error: clientUpdateError.message }, { status: 500 });
    }

    const { error: userUpdateError } = await supabaseAdmin.from("users").update(patch).eq("client_id", clientId);
    if (userUpdateError) {
      return NextResponse.json({ error: userUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (target === "member") {
    const memberId = String(body?.memberId ?? "");
    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from("team_members")
      .select("id,agency_id,user_id")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError || !memberRow) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    const canSync =
      memberRow.user_id === userRow.id ||
      (userRow.role === "agency" && userRow.agency_id === memberRow.agency_id);

    if (!canSync) {
      return NextResponse.json({ error: "Sem permissão para sincronizar este colaborador." }, { status: 403 });
    }

    const patch = { name, ...(avatar ? { avatar } : {}), updated_at: new Date().toISOString() };
    const { error: memberUpdateError } = await supabaseAdmin.from("team_members").update(patch).eq("id", memberId);
    if (memberUpdateError) {
      return NextResponse.json({ error: memberUpdateError.message }, { status: 500 });
    }

    if (memberRow.user_id) {
      const { error: userUpdateError } = await supabaseAdmin.from("users").update({ name, ...(avatar ? { avatar } : {}) }).eq("id", memberRow.user_id);
      if (userUpdateError) {
        return NextResponse.json({ error: userUpdateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tipo de sincronização inválido." }, { status: 400 });
}
