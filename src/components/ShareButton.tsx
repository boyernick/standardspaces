"use client";

import { useState, useEffect } from "react";
import { Link2, Check, X, Share2 } from "lucide-react";

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
            icon={
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <path d="M5.285 0A5.273 5.273 0 0 0 0 5.285v13.43A5.273 5.273 0 0 0 5.285 24h13.43A5.273 5.273 0 0 0 24 18.715V5.285A5.273 5.273 0 0 0 18.715 0ZM12 4.154a8.809 7.337 0 0 1 8.809 7.338A8.809 7.337 0 0 1 12 18.828a8.809 7.337 0 0 1-2.492-.303A8.656 7.337 0 0 1 5.93 19.93a9.929 7.337 0 0 0 1.54-2.155 8.809 7.337 0 0 1-4.279-6.283A8.809 7.337 0 0 1 12 4.154" />
              </svg>
            }
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
          <ShareTile
            onClick={onCopy}
            label={copied ? "Copied" : "Copy link"}
            icon={copied ? <Check size={22} /> : <Link2 size={22} />}
          />
          {spotInstagram && (
            <ShareTile
              href={`https://instagram.com/${spotInstagram.replace("@", "")}`}
              target="_blank"
              label="Instagram"
              icon={
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                  <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
                </svg>
              }
            />
          )}
          {onNativeShare && (
            <ShareTile onClick={onNativeShare} label="More" icon={<Share2 size={22} />} />
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
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm">
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
