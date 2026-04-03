"use client";

import { useState, useRef, useEffect } from "react";
import { Link2, Check, AtSign } from "lucide-react";

export default function ShareButton({
  spotName,
  variant,
  spotInstagram,
}: {
  spotName?: string;
  variant?: "icon";
  spotInstagram?: string;
} = {}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleCopyLink() {
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
        setMenuOpen(false);
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }

    setCopied(true);
    setMenuOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  if (variant === "icon") {
    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Share"
          title={copied ? "Copied!" : "Share"}
        >
          {copied ? (
            <Check size={16} strokeWidth={2} className="text-green-600" />
          ) : (
            <Link2 size={16} strokeWidth={2} className="text-neutral-600 dark:text-neutral-300" />
          )}
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-44 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg py-1.5 z-50">
            <button
              onClick={handleCopyLink}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <Link2 size={14} strokeWidth={2} />
              Copy link
            </button>
            {spotInstagram && (
              <a
                href={`https://instagram.com/${spotInstagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                <AtSign size={14} strokeWidth={2} />
                View on Instagram
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleCopyLink}
      className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
    >
      {copied ? <><Check size={14} /> Copied</> : <><Link2 size={14} /> Share</>}
    </button>
  );
}
