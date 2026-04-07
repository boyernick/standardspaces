"use client";

import { useState, useEffect } from "react";
import { Link2, Check, AtSign, X, MessageCircle, Mail, Share2 } from "lucide-react";

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
  const mailHref = `mailto:?subject=${encodeURIComponent(spotName || "Standard Spaces")}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;

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
            mailHref={mailHref}
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
  mailHref,
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
  mailHref: string;
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
            bg="bg-[#25D366]"
            icon={
              <svg viewBox="0 0 32 32" width="22" height="22" fill="white" aria-hidden="true">
                <path d="M19.11 17.21c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.16-1.34-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47-.16-.01-.34-.01-.52-.01s-.48.07-.73.34c-.25.27-.95.93-.95 2.27 0 1.34.97 2.63 1.11 2.81.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.55.57.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.83-1.28.23-.63.23-1.16.16-1.28-.07-.12-.25-.18-.52-.32zM16.02 27.43h-.01c-1.97 0-3.91-.53-5.6-1.53l-.4-.24-4.16 1.09 1.11-4.06-.26-.42a11.27 11.27 0 0 1-1.73-6.02c0-6.23 5.07-11.3 11.3-11.3 3.02 0 5.86 1.18 7.99 3.31a11.23 11.23 0 0 1 3.31 7.99c0 6.23-5.07 11.3-11.3 11.3zM27.41 4.59A13.4 13.4 0 0 0 16.02 0C8.46 0 2.32 6.14 2.32 13.7c0 2.42.63 4.78 1.84 6.86L2.2 28l7.61-2c2 1.09 4.25 1.66 6.55 1.67h.01c7.55 0 13.69-6.14 13.7-13.7 0-3.66-1.43-7.1-4.01-9.69z" />
              </svg>
            }
          />
          <ShareTile
            href={mailHref}
            label="Email"
            bg="bg-neutral-200 dark:bg-neutral-700"
            icon={<Mail size={22} className="text-neutral-700 dark:text-neutral-200" />}
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
