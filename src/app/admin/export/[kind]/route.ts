import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { statusLabels } from "@/lib/admin/season-status";

const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csv = (rows: unknown[][]) => "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");

/** CSV exports behind the "Exporter" buttons. Admin only; honours the same filters as the list screens. */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  await requireAdmin();
  const { kind } = await params;
  const url = new URL(request.url);
  const db = createSupabaseAdminClient();
  let body: string;
  if (kind === "seasons") {
    let query = db.from("seasons").select("name,status,starts_on,ends_on").order("starts_on", { ascending: false });
    const q = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status");
    if (q) query = query.ilike("name", `%${q.replace(/[%,]/g, "")}%`);
    if (status && statusLabels[status]) query = query.eq("status", status);
    const { data } = await query;
    body = csv([["Saison", "Statut", "Début", "Fin"], ...(data ?? []).map((s) => [s.name, statusLabels[s.status]?.label ?? s.status, s.starts_on, s.ends_on])]);
  } else if (kind === "managers") {
    const { data } = await db.rpc("admin_managers", { p_search: url.searchParams.get("q") ?? "", p_status: url.searchParams.get("status") ?? "", p_since: url.searchParams.get("since") || null, p_limit: 5000, p_offset: 0 });
    body = csv([["Nom", "Mail", "Statut", "Inscription", "Dernière connexion", "Comptes liés"], ...((data ?? []) as { username: string; email: string; status: string; created_at: string; last_sign_in_at: string | null; linked: number }[]).map((m) => [m.username, m.email, m.status, m.created_at, m.last_sign_in_at ?? "", m.linked])]);
  } else return NextResponse.json({ error: "Export inconnu" }, { status: 404 });
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}.csv"` } });
}
