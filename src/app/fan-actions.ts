"use server";

export interface JoinState {
  status: "idle" | "ok" | "demo" | "error";
  message: string;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * "Join the crew" sign-up. Posts the address to `FAN_SIGNUP_WEBHOOK` (point it at your
 * email provider's form endpoint, Zapier, n8n, ...). Without the variable it reports
 * demo mode instead of pretending to save anything.
 */
export async function joinCrew(_prev: JoinState, formData: FormData): Promise<JoinState> {
  // Honeypot: real people never see or fill this field.
  if (String(formData.get("company") ?? "").length > 0) {
    return { status: "ok", message: "You're in. Watch your inbox for the next drop." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) {
    return { status: "error", message: "That email doesn't look right. Check it and try again." };
  }

  const webhook = process.env.FAN_SIGNUP_WEBHOOK;
  if (!webhook) {
    return {
      status: "demo",
      message: "Sign-ups are in demo mode: nothing was saved. Set FAN_SIGNUP_WEBHOOK in .env.local to enable them.",
    };
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "fan-zone", at: new Date().toISOString() }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
    return { status: "ok", message: "You're in. Watch your inbox for the next drop." };
  } catch {
    return { status: "error", message: "We couldn't save that right now. Please try again in a moment." };
  }
}
