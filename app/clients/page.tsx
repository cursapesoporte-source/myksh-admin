import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import ClientCard, { type ClientRow, type ClientState } from "@/components/admin/ClientCard";
import CreateClientForm from "@/components/admin/CreateClientForm";

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  access_until: string;
};

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "expiring7", label: "Vencen en 7 días" },
  { key: "expiring30", label: "Vencen en 30 días" },
  { key: "expired", label: "Vencidos" },
  { key: "suspended", label: "Suspendidos" },
  { key: "none", label: "Sin suscripción" },
] as const;

function computeState(
  subscription: SubscriptionRow | null,
  nowMs: number,
): { state: ClientState; daysLeft: number | null } {
  if (!subscription) return { state: "none", daysLeft: null };

  const until = new Date(subscription.access_until).getTime();
  const daysLeft = Math.ceil((until - nowMs) / 86400000);

  if (subscription.status === "suspended") return { state: "suspended", daysLeft };
  if (until < nowMs || subscription.status === "expired") return { state: "expired", daysLeft };
  if (daysLeft <= 7) return { state: "expiring", daysLeft };
  return { state: "active", daysLeft };
}

function matchesFilter(row: ClientRow, filter: string): boolean {
  const isLive = row.state === "active" || row.state === "expiring";
  switch (filter) {
    case "active":
      return isLive;
    case "expiring7":
      return isLive && (row.daysLeft ?? 999) <= 7;
    case "expiring30":
      return isLive && (row.daysLeft ?? 999) <= 30;
    case "expired":
      return row.state === "expired";
    case "suspended":
      return row.state === "suspended";
    case "none":
      return row.state === "none";
    default:
      return true;
  }
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const filter = FILTERS.some((item) => item.key === params.filter) ? (params.filter as string) : "all";
  const query = (params.q ?? "").trim().toLowerCase();

  const { data: clients, error: clientsError } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  if (clientsError) throw new Error(clientsError.message);

  const clientIds = (clients ?? []).map((client) => client.id as string);

  const { data: subscriptionData } = clientIds.length
    ? await supabase
        .from("subscriptions")
        .select("id, user_id, plan, status, access_until, updated_by_admin_at")
        .in("user_id", clientIds)
        .order("updated_by_admin_at", { ascending: false })
    : { data: [] };

  const latestByUser = new Map<string, SubscriptionRow>();
  for (const item of (subscriptionData ?? []) as SubscriptionRow[]) {
    if (!latestByUser.has(item.user_id)) latestByUser.set(item.user_id, item);
  }

  const authInfo = new Map<string, { email: string | null; lastSignInAt: string | null }>();
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of data?.users ?? []) {
      authInfo.set(user.id, { email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null });
    }
  } catch (error) {
    console.error("[admin/clients] No se pudieron leer los correos:", error);
  }

  const nowMs = Date.now();

  const rows: ClientRow[] = (clients ?? []).map((client) => {
    const subscription = latestByUser.get(client.id as string) ?? null;
    const { state, daysLeft } = computeState(subscription, nowMs);
    const info = authInfo.get(client.id as string);
    return {
      id: client.id as string,
      fullName: (client.full_name as string | null) ?? "",
      email: info?.email ?? null,
      lastSignInAt: info?.lastSignInAt ?? null,
      state,
      daysLeft,
      subscription: subscription
        ? { id: subscription.id, plan: subscription.plan, status: subscription.status, accessUntil: subscription.access_until }
        : null,
    };
  });

  const counts = Object.fromEntries(
    FILTERS.map((item) => [item.key, rows.filter((row) => matchesFilter(row, item.key)).length]),
  ) as Record<string, number>;

  let visible = rows.filter((row) => matchesFilter(row, filter));

  if (query) {
    visible = visible.filter(
      (row) => row.fullName.toLowerCase().includes(query) || (row.email ?? "").toLowerCase().includes(query),
    );
  }

  if (filter === "expiring7" || filter === "expiring30") {
    visible = [...visible].sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  }

  const hrefFor = (key: string) =>
    `/clients?filter=${key}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <main className="min-h-screen bg-[#0B0F14] px-4 py-6 text-[#E5E7EB] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#4ADE80]">MyKSH Admin</p>
            <h1 className="mt-2 text-3xl font-semibold">Clientes</h1>
            <p className="mt-2 text-sm text-white/60">Crea clientes y gestiona su acceso.</p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-[#4ADE80] hover:text-[#4ADE80]"
          >
            Volver al dashboard
          </Link>
        </div>

        <details className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <summary className="cursor-pointer text-base font-semibold text-[#4ADE80]">+ Nuevo cliente</summary>
          <CreateClientForm />
        </details>

        <section className="mt-8">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const active = item.key === filter;
              return (
                <Link
                  key={item.key}
                  href={hrefFor(item.key)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-[#4ADE80] bg-[#4ADE80]/15 text-[#4ADE80]"
                      : "border-white/10 text-white/70 hover:border-[#4ADE80]/50"
                  }`}
                >
                  {item.label} <span className="text-white/45">({counts[item.key]})</span>
                </Link>
              );
            })}
          </div>

          <form action="/clients" method="get" className="mt-4 flex gap-2">
            <input type="hidden" name="filter" value={filter} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Buscar por nombre o correo"
              className="min-h-11 w-full max-w-sm rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none focus:border-[#4ADE80]"
            />
            <button type="submit" className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-white/80 transition hover:border-[#4ADE80] hover:text-[#4ADE80]">
              Buscar
            </button>
          </form>
        </section>

        <section className="mt-6 grid gap-4">
          {visible.length ? (
            visible.map((row) => <ClientCard key={row.id} client={row} />)
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
              No hay clientes para este filtro.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
