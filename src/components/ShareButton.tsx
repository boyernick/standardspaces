"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export default function ShareButton({ spotName, variant }: { spotName?: string; variant?: "icon" } = {}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          url,
          ...(spotName && {
            title: spotName,
            text: `Check out ${spotName} on Standard Spaces`,
          }),
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — use a hidden input fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Share"
        title={copied ? "Copied!" : "Share"}
      >
        {copied ? <Check size={16} strokeWidth={2} className="text-green-600" /> : <Link2 size={16} strokeWidth={2} className="text-neutral-600 dark:text-neutral-300" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
    >
      {copied ? <><Check size={14} /> Copied</> : <><Link2 size={14} /> Share</>}
    </button>
  );
}
