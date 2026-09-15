"use client";

import { useState } from "react";
import {
  extendSubscription,
  suspendSubscription,
} from "@/app/actions/subscriptions";

type ClientSubscriptionCardProps = {
  client: {
    id: string;
    full_name: string | null;
    locale: string;
    email: string;
    subscription: {
      id: string;
      access_until: string;
      status: string;
      plan: string;
    } | null;
  };
};

export default function ClientSubscriptionCard({
  client,
}: ClientSubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const accessDate = client.subscription
    ? new Date(client.subscription.access_until)
    : null;

  const isActive =
    client.subscription?.status === "active" &&
    accessDate !== null &&
    accessDate >= new Date();

  async function handleExtend(days: number) {
    if (!client.subscription) return;

    setLoading(true);
    setMessage("");

    try {
      await extendSubscription(client.subscription.id, days);
      setMessage(`Acceso extendido ${days} días.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo actualizar."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSuspend() {
    if (!client.subscription) return;

    const confirmed = window.confirm(
      `¿Suspender el acceso de ${client.full_name ?? client.email}?`
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      await suspendSubscription(client.subscription.id);
      setMessage("Acceso suspendido.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo suspender."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {client.full_name || "Sin nombre"}
          </h2>
          <p className="mt-1 break-all text-sm text-white/60">{client.email}</p>
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
            isActive
              ? "bg-[#4ADE80]/15 text-[#4ADE80]"
              : "bg-[#F87171]/15 text-[#F87171]"
          }`}
        >
          {isActive ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-white/50">Plan</p>
          <p className="mt-1">{client.subscription?.plan ?? "Sin plan"}</p>
        </div>

        <div>
          <p className="text-white/50">Acceso hasta</p>
          <p className="mt-1">
            {accessDate
              ? accessDate.toLocaleDateString("es-PE")
              : "Sin fecha"}
          </p>
        </div>

        <div>
          <p className="text-white/50">Estado</p>
          <p className="mt-1">{client.subscription?.status ?? "Sin registro"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          disabled={loading || !client.subscription}
          onClick={() => handleExtend(7)}
          className="min-h-11 rounded-xl bg-[#60A5FA] px-4 py-2 text-sm font-semibold text-[#0B0F14] disabled:opacity-50"
        >
          +7 días
        </button>

        <button
          type="button"
          disabled={loading || !client.subscription}
          onClick={() => handleExtend(30)}
          className="min-h-11 rounded-xl bg-[#4ADE80] px-4 py-2 text-sm font-semibold text-[#0B0F14] disabled:opacity-50"
        >
          +30 días
        </button>

        <button
          type="button"
          disabled={loading || !client.subscription}
          onClick={handleSuspend}
          className="min-h-11 rounded-xl border border-[#F87171]/40 px-4 py-2 text-sm font-semibold text-[#F87171] disabled:opacity-50"
        >
          Suspender
        </button>
      </div>

      {message && (
        <p className="mt-4 text-sm text-white/70" aria-live="polite">
          {message}
        </p>
      )}
    </article>
  );
}