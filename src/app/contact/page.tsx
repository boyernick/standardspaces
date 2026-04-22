import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Standard Spaces team.",
};

export default function ContactPage() {
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
          Contact
        </h1>

        <div
          className="mt-8 space-y-6 text-[15px] leading-relaxed text-black/80 dark:text-white/80"
          style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
        >
          <section>
            <p>
              Questions about membership, recommendations, events, or anything
              else — email us at{" "}
              <a
                href="mailto:hello@standardspaces.com"
                className="underline underline-offset-2"
              >
                hello@standardspaces.com
              </a>
              . We read every message and typically reply within a couple of
              business days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">SMS support</h2>
            <p className="mt-2">
              If you&apos;re receiving unwanted texts, reply{" "}
              <span className="font-medium">STOP</span> to opt out, or{" "}
              <span className="font-medium">HELP</span> for help. See our{" "}
              <Link href="/privacy#sms-consent" className="underline underline-offset-2">
                SMS consent policy
              </Link>{" "}
              for the full details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Recommend a space</h2>
            <p className="mt-2">
              Members can submit recommendations from inside the app. If
              you&apos;re a space owner and want to be considered, email us with
              a link and a short note about what makes it worth adding.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
