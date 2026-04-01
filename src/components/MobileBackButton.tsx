"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function MobileBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="md:hidden absolute top-4 left-4 z-30 p-2 rounded-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-lg shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
    >
      <ChevronLeft size={20} strokeWidth={2} />
    </button>
  );
}
