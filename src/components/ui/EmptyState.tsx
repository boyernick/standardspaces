import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "./Button";

/**
 * Canonical empty state: ocean circle + icon + h3 + body + optional CTA.
 * Pattern copied 6+ times across the app before extraction. Always use
 * this rather than hand-rolling — that's how drift starts.
 *
 * Optional `image` prop swaps the icon circle for a faded watercolor
 * illustration — drop a PNG into `public/empty-states/` and pass the
 * path. The image is masked with a radial gradient so its edges
 * dissolve into the surface rather than reading as a hard rectangle.
 * When `image` is set, `icon` is ignored; one or the other is required.
 */
export default function EmptyState({
  icon: Icon,
  image,
  title,
  body,
  cta,
}: {
  icon?: LucideIcon;
  image?: { src: string; alt?: string };
  title: string;
  body?: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="px-6 py-24 text-center">
      {image ? (
        <div className="mx-auto mb-6 w-full max-w-[480px] aspect-[16/9] relative">
          <Image
            src={image.src}
            alt={image.alt ?? ""}
            aria-hidden={!image.alt}
            fill
            sizes="480px"
            className="object-contain select-none pointer-events-none dark:opacity-40 dark:mix-blend-screen"
            style={{
              WebkitMaskImage:
                "radial-gradient(ellipse at center, black 35%, transparent 78%)",
              maskImage:
                "radial-gradient(ellipse at center, black 35%, transparent 78%)",
            }}
          />
        </div>
      ) : Icon ? (
        <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-ink-100">
          <Icon
            size={22}
            strokeWidth={1.5}
            className="text-neutral-500 dark:text-neutral-400"
          />
        </div>
      ) : null}
      <h3 className="text-base font-medium">{title}</h3>
      {body && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
          {body}
        </p>
      )}
      {cta && (
        <div className="mt-6">
          <ButtonLink href={cta.href}>{cta.label}</ButtonLink>
        </div>
      )}
    </div>
  );
}
