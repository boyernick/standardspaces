import Link from "next/link";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  // Dark fill. Used for the single "commit" action on a page.
  primary:
    "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90",
  // Bordered. The default — most CTAs in the app.
  secondary:
    "border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-900 dark:text-white",
  // No chrome at rest; wash on hover. Good for dense toolbars.
  ghost:
    "text-neutral-600 dark:text-neutral-400 hover:bg-ink-100",
  // Red-on-hover for destructive actions (cancel, delete).
  danger:
    "text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

function composeClasses({
  variant = "secondary",
  size = "md",
  className = "",
}: Pick<CommonProps, "variant" | "size" | "className">) {
  return [
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium",
    "transition-[background-color,border-color,opacity,transform] duration-[var(--duration-fast)]",
    "active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className,
  ].join(" ");
}

/**
 * Single source of truth for buttons across the app.
 *
 * Use `<Button>` for buttons and `<Button as="a" href=...>` style would be
 * nice — but to stay simple with Next's Link, use `<ButtonLink>` for hrefs.
 */
export const Button = forwardRef<
  HTMLButtonElement,
  CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function Button(
  { variant = "secondary", size = "md", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={composeClasses({ variant, size, className })}
      {...rest}
    >
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  children,
  href,
  ...rest
}: CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  }) {
  return (
    <Link
      href={href}
      className={composeClasses({ variant, size, className })}
      {...rest}
    >
      {children}
    </Link>
  );
}
