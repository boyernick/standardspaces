import twilio from "twilio";

/**
 * Send an SMS via Twilio's Messaging Service. Returns true if dispatched,
 * false if env vars are missing or Twilio throws. Never rethrows — callers
 * should treat SMS delivery as best-effort.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!accountSid || !authToken || !messagingServiceSid) {
    console.warn("sendSms: Twilio env vars missing — skipping", { to });
    return false;
  }
  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({ body, messagingServiceSid, to });
    return true;
  } catch (err) {
    console.error("sendSms: Twilio send failed", { to, err });
    return false;
  }
}
