import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
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

  if (userError || !userRow?.agency_id) {
    return NextResponse.json({ error: "Agência não encontrada." }, { status: 404 });
  }

  if (userRow.role === "client" && userRow.client_id) {
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("agency_id")
      .eq("id", userRow.client_id)
      .maybeSingle();

    if (clientError || clientRow?.agency_id !== userRow.agency_id) {
      return NextResponse.json({ error: "Cliente sem acesso a esta agência." }, { status: 403 });
    }
  }

  const { data: agency, error } = await supabaseAdmin
    .from("agencies")
    .select("name,billing_document,workspace_settings")
    .eq("id", userRow.agency_id)
    .maybeSingle();

  if (error || !agency) {
    return NextResponse.json({ error: error?.message ?? "Agência não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ agency });
}
