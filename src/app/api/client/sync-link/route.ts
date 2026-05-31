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
    .select("*")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (userError || !userRow || userRow.role !== "client") {
    return NextResponse.json({ profile: userRow ?? null });
  }

  const email = String(userRow.email || authData.user.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ profile: userRow });
  }

  let query = supabaseAdmin
    .from("clients")
    .select("id,agency_id,email,created_at")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(5);

  if (userRow.agency_id) {
    query = query.eq("agency_id", userRow.agency_id);
  }

  const { data: clients, error: clientError } = await query;
  if (clientError || !clients?.length) {
    return NextResponse.json({ profile: userRow });
  }

  const linkedClient = clients.find((client) => client.id === userRow.client_id) ?? clients[0];
  const patch = {
    agency_id: linkedClient.agency_id,
    client_id: linkedClient.id
  };

  if (userRow.agency_id === patch.agency_id && userRow.client_id === patch.client_id) {
    return NextResponse.json({ profile: userRow });
  }

  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from("users")
    .update(patch)
    .eq("id", userRow.id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ profile: updatedProfile ?? { ...userRow, ...patch } });
}
