import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms you agree to when using Standard Spaces.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] px-5 py-12 md:px-8 md:py-20">
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
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-black/50 dark:text-white/50">
          Last updated: April 15, 2026
        </p>

        <div
          className="mt-8 space-y-6 text-[15px] leading-relaxed text-black/80 dark:text-white/80"
          style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
        >
          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">The service</h2>
            <p className="mt-2">
              Standard Spaces is an invitation-only guide to curated spaces and events in cities
              we cover. Access is granted at our discretion via the application process, and we
              may revoke it at any time if these terms are violated.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Your account</h2>
            <p className="mt-2">
              You are responsible for activity on your account and for keeping your sign-in
              credentials (email, phone) secure. Don&apos;t share your account, and let us know
              right away if you suspect it&apos;s been accessed without your permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Acceptable use</h2>
            <p className="mt-2">
              Use the service in good faith. Don&apos;t scrape, resell, or redistribute the
              content; don&apos;t harass other members; don&apos;t create events, listings, or
              recommendations that are misleading, unlawful, or unsafe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Content you submit</h2>
            <p className="mt-2">
              You retain ownership of content you post (recommendations, events, profile
              details). By posting it you grant us a non-exclusive license to display it inside
              the product and to members you direct it to.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">No warranty</h2>
            <p className="mt-2">
              The service is provided &quot;as is&quot; without warranties of any kind. We
              don&apos;t guarantee that any space, event, or recommendation meets your
              expectations. Use your own judgment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Limitation of liability</h2>
            <p className="mt-2">
              To the fullest extent permitted by law, Standard Spaces is not liable for
              indirect, incidental, or consequential damages arising from your use of the
              service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-black dark:text-white">Changes</h2>
            <p className="mt-2">
              We may update these terms as the product evolves. Continued use after a change
              means you accept the updated terms. Questions:{" "}
              <a
                href="mailto:hello@standardspaces.com"
                className="underline underline-offset-2"
              >
                hello@standardspaces.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
