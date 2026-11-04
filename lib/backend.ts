import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type BackendResult<T extends object> = ({ ok: true } & T) | { ok: false; code: string; message: string };
export interface SessionInfo {
  role: "parent" | "accounts" | "counsellor" | "admin";
  phone: string | null;
  centreId: string | null;
  consent: boolean;
  declined: boolean;
  children: { id: string; name: string }[];
}

export async function backendResponse(name: string, input?: unknown) {
  const secret = process.env.INTERNAL_API_SECRET;
  const base = process.env.BACKEND_URL;
  if (!secret || !base) throw new Error("Backend connection is not configured.");
  const sid = (await cookies()).get("sid")?.value;
  return fetch(`${base}/api/${name}`, {
    method: input === undefined ? "GET" : "POST",
    headers: { "X-Internal-Key": secret, ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(sid ? { Cookie: `sid=${sid}` } : {}) },
    body: input === undefined ? undefined : JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
}

export async function backendResult<T extends object>(response: Response): Promise<BackendResult<T>> {
  const result = await response.json();
  if (!result || typeof result.ok !== "boolean") throw new Error("Unexpected backend response.");
  if (response.status >= 500) throw new Error("The service is unavailable.");
  return result;
}

export async function backend<T extends object>(name: string, signIn = "/login"): Promise<T & { ok: true }> {
  const response = await backendResponse(name);
  const result = await backendResult<T>(response);
  if (response.status === 401) redirect(signIn);
  if (!result.ok && response.status === 403 && result.code === "consent_required") redirect("/consent");
  if (!result.ok) throw new Error(result.message);
  return result;
}

export const getMe = cache(async () => {
  if (!(await cookies()).get("sid")?.value) return null;
  const response = await backendResponse("me");
  if (response.status === 401) return null;
  const result = await backendResult<SessionInfo>(response);
  if (!result.ok) throw new Error(result.message);
  return result;
});
