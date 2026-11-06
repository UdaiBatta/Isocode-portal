"use server";
// The index is removed in T7.2; it can no longer forge a role or a payment.
export async function openPrototypeRoute(_input: unknown) {
  void _input;
  return { ok: false as const, next: "", message: "Sign in with a real demo account from the demo page." };
}
