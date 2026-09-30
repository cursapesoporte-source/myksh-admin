"use client";

import { useState, useTransition } from "react";
import { extendSubscription, suspendSubscription } from "@/app/actions/subscriptions";
import {
  createSubscriptionForClient,
  resetClientPassword,
  setAccessDate,
  type ActionResult,
} from "@/app/actions/clients";

export type ClientState = "active" | "expiring" | "expired" | "suspended" | "none";

export type ClientRow = {
  id: string;
  fullName: string;
  email: string | null;
  lastSignInAt: string | null;
  state: ClientState;
  daysLeft: number | null;
  subscription: { id: string; plan: string; status: string; accessUntil: string } | null;
};

const BADGE: Record<ClientState, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-[#4ADE80]/15 text-[#4ADE80]" },
  expiring: { label: "Vence pronto", className: "bg-[#FBBF24]/15 text-[#FBBF24]" },
  expired: { label: "Vencido", className: "bg-[#F87171]/15 text-[#F87171]" },
  suspended: { label: "Suspendido", className: "bg-[#F87171]/15 text-[#F87171]" },
  none: { label: "Sin suscripción", className: "bg-white/10 text-white/60" },
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(date);
}

function daysText(daysLeft: number | null): string {
  if (daysLeft === null) return "";
  if (daysLeft < 0) return `venció hace ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "día" : "días"}`;
  if (daysLeft === 0) return "vence hoy";
  return `quedan ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`;
}

const buttonBase =
  "min-h-10 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function ClientCard({ client }: { client: ClientRow }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const badge = BADGE[client.state];
  const subscription = client.subscription;
  const isSuspended = client.state === "suspended";

  function run(action: () => Promise<ActionResult | void>) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result && !result.ok) {
          setMessage({ ok: false, text: result.message });
          return;
        }
        setMessage({ ok: true, text: result?.message ?? "Cambios guardados." });
      } catch (error) {
        setMessage({
          ok: false,
          text: error instanceof Error ? error.message : "No se pudo completar la acción.",
        });
      }
    });
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{client.fullName || "Sin nombre"}</h2>
          <p className="truncate text-sm text-white/60">{client.email ?? "Correo no disponible"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-white/50">Plan</dt>
          <dd className="mt-1">{subscription?.plan ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-white/50">Acceso hasta</dt>
          <dd className="mt-1">
            {formatDate(subscription?.accessUntil ?? null)}
            {client.daysLeft !== null ? <span className="text-white/45"> · {daysText(client.daysLeft)}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-white/50">Último ingreso</dt>
          <dd className="mt-1">{formatDate(client.lastSignInAt)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {subscription ? (
          <>
            <button type="button" disabled={pending} onClick={() => run(() => extendSubscription(subscription.id, 7))} className={`${buttonBase} bg-[#60A5FA] text-[#0B0F14]`}>
              +7 días
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => extendSubscription(subscription.id, 30))} className={`${buttonBase} bg-[#4ADE80] text-[#0B0F14]`}>
              {isSuspended || client.state === "expired" ? "Reactivar +30 días" : "+30 días"}
            </button>
            {!isSuspended ? (
              <button type="button" disabled={pending} onClick={() => run(() => suspendSubscription(subscription.id))} className={`${buttonBase} border border-[#F87171]/40 text-[#F87171]`}>
                Suspender
              </button>
            ) : null}
          </>
        ) : (
          <button type="button" disabled={pending} onClick={() => run(() => createSubscriptionForClient(client.id, 30))} className={`${buttonBase} bg-[#4ADE80] text-[#0B0F14]`}>
            Crear suscripción (30 días)
          </button>
        )}
        <button type="button" onClick={() => setShowReset((value) => !value)} className={`${buttonBase} border border-white/10 text-white/80`}>
          Restablecer contraseña
        </button>
      </div>

      {subscription ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={`date-${client.id}`} className="text-sm text-white/60">Fecha exacta:</label>
          <input id={`date-${client.id}`} type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-[#4ADE80]" />
          <button type="button" disabled={pending || !dateValue} onClick={() => run(() => setAccessDate(subscription.id, dateValue))} className={`${buttonBase} border border-white/10 text-white/80`}>
            Guardar fecha
          </button>
        </div>
      ) : null}

      {showReset ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="text" autoComplete="off" placeholder="Nueva contraseña temporal (mín. 8)" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="min-h-10 w-full max-w-xs rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-[#4ADE80]" />
          <button
            type="button"
            disabled={pending || newPassword.length < 8}
            onClick={() => {
              run(() => resetClientPassword(client.id, newPassword));
              setNewPassword("");
            }}
            className={`${buttonBase} bg-[#4ADE80] text-[#0B0F14]`}
          >
            Guardar contraseña
          </button>
        </div>
      ) : null}

      {message ? (
        <p className={`mt-3 text-sm ${message.ok ? "text-[#4ADE80]" : "text-[#F87171]"}`}>{message.text}</p>
      ) : null}
    </article>
  );
}
