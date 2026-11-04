"use server";

import { z } from "zod";
import { mutateProto, fail } from "@/lib/fixtures/state";
import { prototypeRoutes } from "@/lib/prototype-routes";
import { submitMockPayment } from "@/lib/actions/payments";

export async function openPrototypeRoute(input: unknown) {
  const parsed = z.object({ key: z.string(), state: z.enum(["normal", "loading", "empty", "error"]) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Unknown prototype route." };
  const route = prototypeRoutes.find((item) => item.key === parsed.data.key);
  const prepared = await mutateProto(null, (state) => {
    if (!route) fail("invalid", "Unknown prototype route.");
    // LIMIT: reviewer-only role switching; remove this helper with /proto before production.
    if (route.role !== "public") { state.role = route.role; delete state.centreId; }
    if (route.role === "parent") { state.phone = "+919000000587"; state.otp = { attempts: 0, sends: 1, verified: true }; state.consent = route.key !== "consent"; delete state.declined; }
    if (route.key === "login" || route.key === "staff-login") { delete state.role; delete state.phone; delete state.otp; delete state.consent; }
    return { next: route.path as string };
  });
  if (!prepared.ok) return prepared;
  let next = prepared.next;
  if (route?.key === "result" && parsed.data.state === "normal") {
    const result = await submitMockPayment({ token: "STU-0587-3", outcome: "success" });
    if (!result.ok) return result;
    next += `?e=${encodeURIComponent(result.eventId)}`;
  }
  if (parsed.data.state !== "normal") next += `${next.includes("?") ? "&" : "?"}state=${parsed.data.state}`;
  return { ok: true as const, next };
}
