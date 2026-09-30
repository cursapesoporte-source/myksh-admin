"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ActionResult = { ok: boolean; message: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DAYS = [7, 15, 30, 60, 90];

function fail(message: string): ActionResult {
  return { ok: false, message };
}

function daysFromNowISO(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function endOfDayLimaISO(dateISO: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  const date = new Date(`${dateISO}T23:59:59-05:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function refresh() {
  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function createClientAccess(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const days = Number(formData.get("days") ?? 30);

  if (fullName.length < 2) return fail("Escribe el nombre del cliente.");
  if (!EMAIL_REGEX.test(email)) return fail("El correo no es válido.");
  if (password.length < 8) return fail("La contraseña temporal debe tener al menos 8 caracteres.");
  if (!ALLOWED_DAYS.includes(days)) return fail("La duración de acceso no es válida.");

  const admin = createServiceRoleClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created?.user) {
    const raw = createError?.message ?? "";
    if (/already|registered|exists/i.test(raw)) return fail("Ya existe un usuario con ese correo.");
    return fail(raw || "No se pudo crear el usuario.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, full_name: fullName, role: "client", locale: "es" }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return fail(`No se pudo crear el perfil: ${profileError.message}`);
  }

  const { error: subscriptionError } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan: "unico",
    status: "active",
    access_until: daysFromNowISO(days),
    notes: "Alta desde el panel admin",
    updated_by_admin_at: new Date().toISOString(),
  });

  if (subscriptionError) {
    await admin.auth.admin.deleteUser(userId);
    return fail(`No se pudo crear la suscripción: ${subscriptionError.message}`);
  }

  refresh();
  return { ok: true, message: `Cliente creado: ${email}.` };
}

export async function setAccessDate(
  subscriptionId: string,
  dateISO: string,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const accessUntil = endOfDayLimaISO(dateISO);
  if (!accessUntil) return fail("La fecha no es válida.");

  const isFuture = new Date(accessUntil).getTime() > Date.now();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      access_until: accessUntil,
      status: isFuture ? "active" : "expired",
      updated_by_admin_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) return fail(error.message);

  refresh();
  return { ok: true, message: "Fecha de acceso actualizada." };
}

export async function createSubscriptionForClient(
  userId: string,
  days: number,
): Promise<ActionResult> {
  await requireAdmin();

  if (!ALLOWED_DAYS.includes(days)) return fail("La duración de acceso no es válida.");

  const admin = createServiceRoleClient();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (existing && existing.length > 0) return fail("Este cliente ya tiene una suscripción.");

  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan: "unico",
    status: "active",
    access_until: daysFromNowISO(days),
    notes: "Suscripción creada desde el panel admin",
    updated_by_admin_at: new Date().toISOString(),
  });

  if (error) return fail(error.message);

  refresh();
  return { ok: true, message: "Suscripción creada." };
}

export async function resetClientPassword(
  userId: string,
  newPassword: string,
): Promise<ActionResult> {
  await requireAdmin();

  if (newPassword.length < 8) return fail("La contraseña debe tener al menos 8 caracteres.");

  const admin = createServiceRoleClient();

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (target?.role !== "client") return fail("Solo se pueden restablecer contraseñas de clientes.");

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });

  if (error) return fail(error.message);

  return {
    ok: true,
    message: "Contraseña restablecida. Compártela por un canal privado.",
  };
}
