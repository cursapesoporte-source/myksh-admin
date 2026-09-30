import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

type SubscriptionRow = {
  user_id: string;
  status: string;
  access_until: string;
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/login?error=unauthorized");
  }

  const { data: clientProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "client");

  const clientIds = (clientProfiles ?? []).map((item) => item.id as string);

  const { data: subscriptionData } = clientIds.length
    ? await supabase
        .from("subscriptions")
        .select("user_id, status, access_until, updated_by_admin_at")
        .in("user_id", clientIds)
        .order("updated_by_admin_at", { ascending: false })
    : { data: [] };

  const latestByUser = new Map<string, SubscriptionRow>();
  for (const item of (subscriptionData ?? []) as SubscriptionRow[]) {
    if (!latestByUser.has(item.user_id)) latestByUser.set(item.user_id, item);
  }

  const nowMs = Date.now();
  let active = 0;
  let expiringSoon = 0;
  let blocked = 0;

  for (const subscription of latestByUser.values()) {
    const until = new Date(subscription.access_until).getTime();
    const live = subscription.status === "active" && until >= nowMs;
    if (live) {
      active += 1;
      if (Math.ceil((until - nowMs) / 86400000) <= 7) expiringSoon += 1;
    } else {
      blocked += 1;
    }
  }

  const withoutSubscription = clientIds.length - latestByUser.size;

  return (
    <main className="min-h-screen bg-[#0B0F14] px-4 py-6 text-[#E5E7EB] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#4ADE80]">MyKSH Admin</p>
            <h1 className="mt-2 text-3xl font-semibold">Hola{profile.full_name ? `, ${profile.full_name}` : ""}</h1>
            <p className="mt-2 text-sm text-white/60">{user.email}</p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-[#4ADE80] hover:text-[#4ADE80]"
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/clients?filter=all" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-[#4ADE80]/50">
            <p className="text-sm text-white/50">Clientes registrados</p>
            <p className="mt-2 text-3xl font-semibold">{clientIds.length}</p>
          </Link>

          <Link href="/clients?filter=active" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-[#4ADE80]/50">
            <p className="text-sm text-white/50">Con acceso activo</p>
            <p className="mt-2 text-3xl font-semibold text-[#4ADE80]">{active}</p>
          </Link>

          <Link href="/clients?filter=expiring7" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-[#FBBF24]/50">
            <p className="text-sm text-white/50">Vencen en 7 días</p>
            <p className="mt-2 text-3xl font-semibold text-[#FBBF24]">{expiringSoon}</p>
          </Link>

          <Link href="/clients?filter=expired" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-[#F87171]/50">
            <p className="text-sm text-white/50">Sin acceso (vencidos o suspendidos)</p>
            <p className="mt-2 text-3xl font-semibold text-[#F87171]">{blocked}</p>
          </Link>
        </section>

        {withoutSubscription > 0 ? (
          <p className="mt-4 text-sm text-[#FBBF24]">
            {withoutSubscription} {withoutSubscription === 1 ? "cliente no tiene" : "clientes no tienen"} suscripción.{" "}
            <Link href="/clients?filter=none" className="underline">Revisarlos</Link>
          </p>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/50">Plan de lanzamiento</p>
            <p className="mt-2 text-3xl font-semibold">S/50</p>
            <p className="mt-1 text-sm text-white/50">Facturación manual</p>
          </article>
        </section>

        <Link
          href="/clients"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#4ADE80] px-5 py-3 font-semibold text-[#0B0F14] transition hover:bg-[#4ADE80]/90"
        >
          Gestionar clientes
        </Link>
      </div>
    </main>
  );
}
