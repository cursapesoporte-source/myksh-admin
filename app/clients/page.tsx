import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientSubscriptionCard from "@/components/admin/ClientSubscriptionCard";

export default async function ClientsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminProfile?.role !== "admin") {
    redirect("/login?error=unauthorized");
  }

  const { data: clients, error: clientsError } = await supabase
    .from("profiles")
    .select("id, full_name, locale, role")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  if (clientsError) {
    throw new Error(clientsError.message);
  }

  const clientIds = (clients ?? []).map((client) => client.id);

  const { data: subscriptions } = clientIds.length
    ? await supabase
        .from("subscriptions")
        .select("id, user_id, access_until, status, plan")
        .in("user_id", clientIds)
        .order("updated_by_admin_at", { ascending: false })
    : { data: [] };

  const emailByUserId = new Map<string, string>();

  for (const client of clients ?? []) {
    emailByUserId.set(client.id, "Correo protegido");
  }

  const clientsWithSubscriptions = (clients ?? []).map((client) => ({
    ...client,
    email: emailByUserId.get(client.id) ?? "Correo no disponible",
    subscription:
      subscriptions?.find((subscription) => subscription.user_id === client.id) ??
      null,
  }));

  return (
    <main className="min-h-screen bg-[#0B0F14] px-4 py-6 text-[#E5E7EB] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#4ADE80]">
              MyKSH Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Clientes</h1>
            <p className="mt-2 text-sm text-white/60">
              Gestiona el acceso manual de tus clientes.
            </p>
          </div>

        <Link
  href="/dashboard"
  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-[#4ADE80] hover:text-[#4ADE80]"
>
  Volver al dashboard
</Link>
        </div>

        <section className="mt-8 grid gap-4">
          {clientsWithSubscriptions.length ? (
            clientsWithSubscriptions.map((client) => (
              <ClientSubscriptionCard key={client.id} client={client} />
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
              Todavía no hay clientes registrados.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}