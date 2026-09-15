"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/login?error=unauthorized");
  }

  return supabase;
}

export async function extendSubscription(
  subscriptionId: string,
  days: number
) {
  if (![7, 30].includes(days)) {
    throw new Error("Cantidad de días no permitida.");
  }

  const supabase = await requireAdmin();

  const { data: subscription, error: readError } = await supabase
    .from("subscriptions")
    .select("access_until")
    .eq("id", subscriptionId)
    .single();

  if (readError || !subscription) {
    throw new Error("No se encontró la suscripción.");
  }

  const currentAccess = new Date(subscription.access_until);
  const baseDate =
    currentAccess > new Date() ? currentAccess : new Date();

  baseDate.setDate(baseDate.getDate() + days);

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      access_until: baseDate.toISOString(),
      status: "active",
      updated_by_admin_at: new Date().toISOString(),
      last_payment_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function suspendSubscription(subscriptionId: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      access_until: new Date().toISOString(),
      status: "suspended",
      updated_by_admin_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/clients");
  revalidatePath("/dashboard");
}