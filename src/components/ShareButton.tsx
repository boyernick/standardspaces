"use client";

import { useState, useEffect } from "react";
import { Link2, Check, X, Share2, MessageCircle } from "lucide-react";

export default function ShareButton({
  spotName,
  spotImage,
  spotSubtitle,
  variant,
  title = "Share",
}: {
  spotName?: string;
  spotImage?: string;
  spotSubtitle?: string;
  variant?: "icon";
  title?: string;
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

  // iMessage only renders rich link previews (with photo) when the message
  // body is the URL alone. Any preceding text suppresses the preview, so we
  // send just the URL — the OG metadata on the destination page provides the
  // title, description, and image.
  const smsHref = `sms:&body=${encodeURIComponent(shareUrl)}`;
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
            title={title}
            onClose={() => setModalOpen(false)}
            spotName={spotName}
            spotImage={spotImage}
            spotSubtitle={spotSubtitle}
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
          title={title}
          onClose={() => setModalOpen(false)}
          spotName={spotName}
          spotImage={spotImage}
          spotSubtitle={spotSubtitle}
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

function ShareModal({
  title,
  onClose,
  spotName,
  spotImage,
  spotSubtitle,
  smsHref,
  whatsappHref,
  onCopy,
  copied,
  onNativeShare,
}: {
  title: string;
  onClose: () => void;
  spotName?: string;
  spotImage?: string;
  spotSubtitle?: string;
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
          <h2 className="text-center text-base font-semibold">{title}</h2>
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
            icon={<MessageCircle size={22} />}
          />
          <ShareTile
            href={whatsappHref}
            target="_blank"
            label="WhatsApp"
            icon={
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
              </svg>
            }
          />
          {onNativeShare && (
            <ShareTile onClick={onNativeShare} label="More" icon={<Share2 size={22} />} />
          )}
          <ShareTile
            onClick={onCopy}
            label={copied ? "Copied" : "Copy link"}
            icon={copied ? <Check size={22} /> : <Link2 size={22} />}
          />
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
  icon,
}: {
  href?: string;
  target?: string;
  onClick?: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-ink-100 text-neutral-500 dark:text-neutral-400">
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
