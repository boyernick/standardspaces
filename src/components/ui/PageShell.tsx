import Navbar from "@/components/Navbar";

type MaxWidth = "sm" | "md" | "lg";

const widthClass: Record<MaxWidth, string> = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-3xl",
};

/**
 * Canonical authenticated-page wrapper. Renders Navbar, sets the surface
 * background, and constrains content to one of three widths.
 *
 * Prior to this component the same shell was written 4 different ways
 * across the app (`bg-surface` class, inline CSS var, `min-h-screen`,
 * `h-[100dvh] flex flex-col`). Always use `<PageShell>` for standard
 * content pages. For bespoke full-bleed pages (landing, map, auth),
 * keep handcrafting.
 */
export default function PageShell({
  children,
  maxWidth = "md",
}: {
  children: React.ReactNode;
  maxWidth?: MaxWidth;
}) {
  return (
    <div
      className="h-full overflow-y-auto"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <Navbar />
      <div className={`${widthClass[maxWidth]} mx-auto px-4 md:px-6 py-8 page-enter`}>
        {children}
      </div>
    </div>
  );
}
