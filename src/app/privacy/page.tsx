import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Standard Spaces collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-[var(--background)] text-[var(--foreground)] px-5 py-12 md:px-8 md:py-20">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
          style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
        >
          ← Standard Spaces
        </Link>

        <h1
          className="mt-6 text-3xl md:text-4xl"
          style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
        >
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-black/50 dark:text-white/50">
          Last updated: April 15, 2026
        </p>

        <div
          className="mt-8 space-y-6 text-[15px] leading-relaxed text-black/80 dark:text-white/80"
          style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
        >
          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">What we collect</h2>
            <p className="mt-2">
              When you apply for or use Standard Spaces, we collect the information you give us
              (name, email, phone number, city, answers to application questions) and activity
              generated inside the product (favorites, check-ins, events you create or attend,
              referrals you send).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">How we use it</h2>
            <p className="mt-2">
              We use this information to run the product — authenticating you, showing you
              relevant spaces and events, sending you transactional email and SMS (account
              approvals, event reminders, referrals), and improving the experience. We do not
              sell your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Service providers</h2>
            <p className="mt-2">
              We rely on a small number of service providers to deliver the product: Supabase
              (database and authentication), Vercel (hosting), Mapbox (maps), Resend
              (transactional email), Twilio (SMS), and Google Places (venue data). Your
              information is shared with these providers only to the extent necessary to run the
              service.
            </p>
          </section>

          <section id="sms-consent">
            <h2 className="text-lg font-medium text-black dark:text-white">SMS consent</h2>
            <p className="mt-2">
              You opt in to receive SMS from Standard Spaces by submitting your phone number on
              our{" "}
              <Link href="/apply" className="underline underline-offset-2">
                apply
              </Link>{" "}
              or{" "}
              <Link href="/login" className="underline underline-offset-2">
                sign-in
              </Link>{" "}
              pages, or by tapping &ldquo;Resend&rdquo; on a referral you send from within the
              product. We do not share your mobile information with third parties or affiliates
              for their own marketing or promotional purposes.
            </p>
            <p className="mt-3">
              The messages you may receive are account-related and transactional: one-time
              sign-in codes, application status updates, event reminders for events you RSVP to,
              and invitation texts for referrals you personally initiate. Examples:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>&ldquo;Your Standard Spaces code is 123456.&rdquo;</li>
              <li>&ldquo;Your application was approved — sign in at thestandardspaces.com.&rdquo;</li>
              <li>&ldquo;Reminder: [Event name] is tomorrow at 7pm.&rdquo;</li>
              <li>&ldquo;[Your friend] invited you to Standard Spaces: thestandardspaces.com/apply?ref=…&rdquo;</li>
            </ul>
            <p className="mt-3">
              Message frequency varies based on your activity (typically a few messages per
              month). Message and data rates may apply. Reply HELP for help or STOP at any time
              to opt out — you will receive a confirmation message and no further texts.
              Carriers are not liable for delayed or undelivered messages. For support, email{" "}
              <a href="mailto:hello@standardspaces.com" className="underline underline-offset-2">
                hello@standardspaces.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Your choices</h2>
            <p className="mt-2">
              You can request a copy of your data, correct it, or delete your account at any
              time by emailing us at{" "}
              <a
                href="mailto:hello@standardspaces.com"
                className="underline underline-offset-2"
              >
                hello@standardspaces.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Changes</h2>
            <p className="mt-2">
              We may update this policy as the product evolves. Material changes will be
              communicated by email or in-app.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
