"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClientAccess, type ActionResult } from "@/app/actions/clients";

const APP_URL = "https://myksh-app.vercel.app";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join("");
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#4ADE80]";

export default function CreateClientForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createClientAccess,
    null,
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const handled = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state?.ok && state !== handled.current) {
      handled.current = state;
      setCreated({ email, password });
      setFullName("");
      setEmail("");
      setPassword("");
      setCopied(false);
    }
  }, [state, email, password]);

  async function copyWelcome() {
    if (!created) return;
    const text = [
      "Tu acceso a MYKSH",
      `Enlace: ${APP_URL}/login`,
      `Correo: ${created.email}`,
      `Contraseña temporal: ${created.password}`,
      `Puedes cambiar tu contraseña aquí: ${APP_URL}/cambiar-password`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <div className="mt-4">
      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="full_name" className="mb-2 block text-sm text-white/70">Nombre</label>
          <input id="full_name" name="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm text-white/70">Correo</label>
          <input id="email" name="email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm text-white/70">Contraseña temporal</label>
          <div className="flex gap-2">
            <input id="password" name="password" required minLength={8} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <button type="button" onClick={() => setPassword(generatePassword())} className="shrink-0 rounded-xl border border-white/10 px-3 text-sm text-white/80 transition hover:border-[#4ADE80] hover:text-[#4ADE80]">
              Generar
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="days" className="mb-2 block text-sm text-white/70">Acceso inicial</label>
          <select id="days" name="days" defaultValue="30" className={inputClass}>
            <option value="7" className="bg-[#0B0F14]">7 días</option>
            <option value="15" className="bg-[#0B0F14]">15 días</option>
            <option value="30" className="bg-[#0B0F14]">30 días</option>
            <option value="60" className="bg-[#0B0F14]">60 días</option>
            <option value="90" className="bg-[#0B0F14]">90 días</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-[#4ADE80] px-5 py-3 font-semibold text-[#0B0F14] transition hover:bg-[#4ADE80]/90 disabled:opacity-50">
            {pending ? "Creando…" : "Crear cliente"}
          </button>
        </div>
      </form>

      {state && !state.ok ? (
        <p className="mt-4 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">{state.message}</p>
      ) : null}

      {created ? (
        <div className="mt-4 rounded-xl border border-[#4ADE80]/30 bg-[#4ADE80]/10 p-4 text-sm">
          <p className="font-medium text-[#4ADE80]">Cliente creado: {created.email}</p>
          <p className="mt-1 text-white/60">Copia el mensaje y envíalo por un canal privado. La contraseña temporal no se vuelve a mostrar.</p>
          <button type="button" onClick={copyWelcome} className="mt-3 rounded-xl border border-[#4ADE80]/40 px-4 py-2 text-[#4ADE80] transition hover:bg-[#4ADE80]/10">
            {copied ? "Copiado ✓" : "Copiar mensaje de bienvenida"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
