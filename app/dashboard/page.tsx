import { redirect } from "next/navigation";
import Link from "next/link"; // 1. Importar Link
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

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

  const { count: usersCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "client");

  const { count: activeSubscriptionsCount } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .gte("access_until", new Date().toISOString());

  return (
    <main className="min-h-screen bg-[#0B0F14] px-4 py-6 text-[#E5E7EB] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#4ADE80]">
              MyKSH Admin
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              Hola{profile.full_name ? `, ${profile.full_name}` : ""}
            </h1>

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

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/50">Clientes registrados</p>
            <p className="mt-2 text-3xl font-semibold">
              {usersCount ?? 0}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/50">Suscripciones activas</p>
            <p className="mt-2 text-3xl font-semibold text-[#4ADE80]">
              {activeSubscriptionsCount ?? 0}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:col-span-2 lg:col-span-1">
            <p className="text-sm text-white/50">Plan de lanzamiento</p>
            <p className="mt-2 text-3xl font-semibold">S/55</p>
            <p className="mt-1 text-sm text-white/50">Facturación manual</p>
          </article>
        </section>

        {/* 2. Enlace hacia /clients */}
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