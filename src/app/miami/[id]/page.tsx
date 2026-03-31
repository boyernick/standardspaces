import { notFound } from "next/navigation";
import Link from "next/link";
import { getSpotById, spots } from "@/lib/data";
import { CATEGORY_LABELS } from "@/lib/types";

export function generateStaticParams() {
  return spots
    .filter((s) => s.city === "Miami")
    .map((s) => ({ id: s.id }));
}

export default async function SpotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spot = getSpotById(id);

  if (!spot) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-neutral-400 mb-10">
        <Link href="/miami" className="hover:text-neutral-900 transition-colors">
          Miami
        </Link>
        <span>/</span>
        <span className="text-neutral-600">{spot.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Image placeholder */}
        <div className="aspect-[4/3] bg-neutral-100" />

        {/* Details */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 mb-3">
            {CATEGORY_LABELS[spot.category]}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            {spot.name}
          </h1>
          <p className="text-sm text-neutral-400 mb-8">{spot.neighborhood}</p>

          <p className="text-base text-neutral-600 leading-relaxed mb-8">
            {spot.description}
          </p>

          <div className="border-t border-neutral-200 pt-6">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 mb-2">
              Address
            </p>
            <p className="text-sm text-neutral-700">{spot.address}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
