"use client";

import { useState, useEffect } from "react";
import { Link2, Check, AtSign, X, MessageCircle, Share2 } from "lucide-react";

export default function ShareButton({
  spotName,
  spotImage,
  spotSubtitle,
  variant,
  spotInstagram,
}: {
  spotName?: string;
  spotImage?: string;
  spotSubtitle?: string;
  variant?: "icon";
  spotInstagram?: string;
} = {}) {
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!modalOpen) return;
    setShareUrl(window.location.href);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen]);

  const shareText = spotName
    ? `Check out ${spotName} on Standard Spaces`
    : "Check this out on Standard Spaces";

  const smsBody = `${shareText} ${shareUrl}`;
  // iOS uses ?body=, Android uses ?body= too on most modern devices
  const smsHref = `sms:&body=${encodeURIComponent(smsBody)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          url: shareUrl,
          title: spotName,
          text: shareText,
        });
      } catch {
        /* user cancelled */
      }
    }
  }

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Share"
          data-tooltip="Share"
        >
          <Link2 size={16} strokeWidth={2} className="text-neutral-600 dark:text-neutral-300" />
        </button>

        {modalOpen && (
          <ShareModal
            onClose={() => setModalOpen(false)}
            spotName={spotName}
            spotImage={spotImage}
            spotSubtitle={spotSubtitle}
            spotInstagram={spotInstagram}
            smsHref={smsHref}
            whatsappHref={whatsappHref}
            onCopy={handleCopyLink}
            copied={copied}
            onNativeShare={hasNativeShare ? handleNativeShare : undefined}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
      >
        <Link2 size={14} /> Share
      </button>

      {modalOpen && (
        <ShareModal
          onClose={() => setModalOpen(false)}
          spotName={spotName}
          spotImage={spotImage}
          spotSubtitle={spotSubtitle}
          spotInstagram={spotInstagram}
          smsHref={smsHref}
          whatsappHref={whatsappHref}
          mailHref={mailHref}
          onCopy={handleCopyLink}
          copied={copied}
          onNativeShare={hasNativeShare ? handleNativeShare : undefined}
        />
      )}
    </>
  );
}

function ShareModal({
  onClose,
  spotName,
  spotImage,
  spotSubtitle,
  spotInstagram,
  smsHref,
  whatsappHref,
  onCopy,
  copied,
  onNativeShare,
}: {
  onClose: () => void;
  spotName?: string;
  spotImage?: string;
  spotSubtitle?: string;
  spotInstagram?: string;
  smsHref: string;
  whatsappHref: string;
  onCopy: () => void;
  copied: boolean;
  onNativeShare?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Share"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]"
      />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-sm bg-surface sm:rounded-2xl rounded-t-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 pb-[max(1rem,env(safe-area-inset-bottom))] animate-[slideUp_220ms_cubic-bezier(0.22,1,0.36,1)]">
        <div className="relative px-5 pt-5 pb-2">
          <h2 className="text-center text-base font-semibold">Share</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} className="text-neutral-600 dark:text-neutral-300" />
          </button>
        </div>

        {/* Preview card */}
        {(spotImage || spotName) && (
          <div className="px-5 pt-2 pb-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
              {spotImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spotImage}
                  alt={spotName || ""}
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                {spotName && (
                  <p className="text-sm font-medium truncate">{spotName}</p>
                )}
                {spotSubtitle && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                    {spotSubtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Share options */}
        <div className="px-3 pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          <ShareTile
            href={smsHref}
            label="Messages"
            bg="bg-[#34C759]"
            icon={<MessageCircle size={22} fill="white" stroke="white" strokeWidth={1.5} />}
          />
          <ShareTile
            href={whatsappHref}
            target="_blank"
            label="WhatsApp"
            bg="bg-transparent"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="56" height="56" aria-hidden="true">
                <defs>
                  <linearGradient id="waGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#60D669" />
                    <stop offset="100%" stopColor="#20B038" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#waGradient)"
                  d="M224 32C118.8 32 32 118.8 32 224c0 37.4 10.1 73.8 29.3 105.8L16 480l154.3-44.7C197.1 445.9 210.3 448 224 448c105.2 0 192-86.8 192-192S329.2 32 224 32z"
                />
                <path
                  fill="#FFFFFF"
                  d="M317.1 295.4c-4.4-2.2-26-12.8-30.1-14.2-4.1-1.5-7.1-2.2-10.1 2.2-3 4.4-11.6 14.2-14.2 17.2-2.6 3-5.2 3.3-9.6 1.1-26.1-13-43.1-23.3-60.3-52.7-4.6-7.9 4.6-7.4 13-24.7 1.4-3 0.7-5.6-0.4-7.8-1.1-2.2-10.1-24.3-13.8-33.2-3.6-8.7-7.3-7.5-10.1-7.6-2.6-.1-5.6-.1-8.6-.1s-7.8 1.1-11.9 5.6c-4.1 4.4-15.7 15.4-15.7 37.6 0 22.2 16.1 43.7 18.4 46.7 2.2 3 31.7 48.4 76.7 67.9 10.7 4.6 19 7.4 25.5 9.5 10.7 3.4 20.5 2.9 28.2 1.8 8.6-1.3 26-10.6 29.7-20.8 3.7-10.2 3.7-18.9 2.6-20.8-1.1-1.8-4.1-3-8.5-5.2z"
                />
              </svg>
            }
          />
          <ShareTile
            onClick={onCopy}
            label={copied ? "Copied" : "Copy link"}
            bg="bg-neutral-900 dark:bg-white"
            icon={
              copied ? (
                <Check size={22} className="text-white dark:text-neutral-900" />
              ) : (
                <Link2 size={22} className="text-white dark:text-neutral-900" />
              )
            }
          />
          {spotInstagram && (
            <ShareTile
              href={`https://instagram.com/${spotInstagram.replace("@", "")}`}
              target="_blank"
              label="Instagram"
              bg="bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5]"
              icon={<AtSign size={22} className="text-white" />}
            />
          )}
          {onNativeShare && (
            <ShareTile
              onClick={onNativeShare}
              label="More"
              bg="bg-neutral-200 dark:bg-neutral-700"
              icon={<Share2 size={22} className="text-neutral-700 dark:text-neutral-200" />}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ShareTile({
  href,
  target,
  onClick,
  label,
  bg,
  icon,
}: {
  href?: string;
  target?: string;
  onClick?: () => void;
  label: string;
  bg: string;
  icon: React.ReactNode;
}) {
  const inner = (
    <>
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center ${bg} shadow-sm`}
      >
        {icon}
      </div>
      <span className="text-[11px] text-neutral-700 dark:text-neutral-300 text-center leading-tight">
        {label}
      </span>
    </>
  );

  const className =
    "shrink-0 w-[78px] flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors";

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={className}
      >
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
