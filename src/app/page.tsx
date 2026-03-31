import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-24">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight mb-6">
          The Standard
        </h1>
        <p className="text-lg text-neutral-500 leading-relaxed mb-12">
          A curated selection of the finest spaces — restaurants, bars, clubs,
          gyms, coffee shops, and more — in the cities that matter.
        </p>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-400 mb-4">
            Cities
          </h2>
          <Link
            href="/miami"
            className="group flex items-center justify-between border-t border-neutral-200 py-5 hover:bg-neutral-50 -mx-4 px-4 transition-colors"
          >
            <div>
              <span className="text-lg font-medium">Miami</span>
              <span className="ml-3 text-sm text-neutral-400">12 spaces</span>
            </div>
            <span className="text-neutral-300 group-hover:text-neutral-900 transition-colors">
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
