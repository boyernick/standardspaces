"use client";

import { useRef, useState } from "react";
import { Eye, GripVertical, Loader2, Plus, Trash2, Upload } from "lucide-react";
import Lightbox from "@/components/Lightbox";

// Photo grid used by both admin forms. Uploads go through the shared
// /api/admin/upload-photo endpoint — which accepts `recommendationId` as the
// form field (the endpoint predates the unification so we keep that name on
// the wire even when editing a published spot).

export function PhotoManager({
  images,
  onChange,
  spotId,
  uploadFn,
  onCurate,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  spotId?: string;
  // Optional custom uploader — events use /api/events/upload-cover, admin
  // spot forms use /api/admin/upload-photo. When provided, replaces the
  // default admin upload path entirely.
  uploadFn?: (file: File) => Promise<string | null>;
  // Optional "Curate photos" action. When provided, renders a button next
  // to "Add photos" that delegates to the parent (which typically opens
  // the CuratePhotosModal). Only the review form uses this today.
  onCurate?: () => void;
}) {
  const [uploading, setUploading] = useState<number | "add" | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);

  async function uploadFile(file: File): Promise<string | null> {
    if (uploadFn) return uploadFn(file);
    const formData = new FormData();
    formData.append("file", file);
    if (spotId) formData.append("recommendationId", spotId);
    try {
      const res = await fetch("/api/admin/upload-photo", { method: "POST", body: formData });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url;
    } catch {
      return null;
    }
  }

  function triggerFileInput(replaceIndex: number | null) {
    replaceIndexRef.current = replaceIndex;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const replaceIndex = replaceIndexRef.current;
    replaceIndexRef.current = null;

    if (replaceIndex !== null) {
      setUploading(replaceIndex);
      const url = await uploadFile(files[0]);
      if (url) {
        const next = [...images];
        next[replaceIndex] = url;
        onChange(next);
      }
      setUploading(null);
    } else {
      setUploading("add");
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFile(files[i]);
        if (url) newUrls.push(url);
      }
      if (newUrls.length > 0) onChange([...images, ...newUrls]);
      setUploading(null);
    }

    e.target.value = "";
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }
  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }
  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    onChange(next);
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      <p className="text-sm font-medium mb-3">Photos</p>

      {images.length > 0 && (
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[320px] rounded-xl overflow-hidden mb-3">
          {(() => {
            const slots = [...images.slice(0, 5)];
            while (slots.length < 5) slots.push("");
            return (
              <>
                <div className="col-span-2 row-span-2 relative group bg-neutral-100 dark:bg-neutral-800">
                  {slots[0] ? (
                    <>
                      <img src={slots[0]} alt="Photo 1" className="w-full h-full object-cover" />
                      <PhotoOverlay index={0} onView={() => setLightboxIndex(0)} onReplace={() => triggerFileInput(0)} onRemove={() => removeImage(0)} uploading={uploading === 0} draggable onDragStart={() => handleDragStart(0)} onDragOver={(e) => handleDragOver(e, 0)} onDrop={() => handleDrop(0)} onDragEnd={handleDragEnd} isDragOver={dragOverIndex === 0} />
                    </>
                  ) : (
                    <EmptySlot onClick={() => triggerFileInput(null)} />
                  )}
                </div>
                {slots.slice(1, 5).map((url, i) => {
                  const idx = i + 1;
                  return (
                    <div key={idx} className="relative group bg-neutral-100 dark:bg-neutral-800">
                      {url ? (
                        <>
                          <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          <PhotoOverlay index={idx} onView={() => setLightboxIndex(idx)} onReplace={() => triggerFileInput(idx)} onRemove={() => removeImage(idx)} uploading={uploading === idx} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={() => handleDrop(idx)} onDragEnd={handleDragEnd} isDragOver={dragOverIndex === idx} />
                        </>
                      ) : (
                        <EmptySlot onClick={() => triggerFileInput(null)} />
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      {images.length > 5 && (
        <div className="grid grid-cols-5 gap-2 mb-3">
          {images.slice(5).map((url, i) => {
            const idx = i + 5;
            return (
              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                <PhotoOverlay index={idx} onView={() => setLightboxIndex(idx)} onReplace={() => triggerFileInput(idx)} onRemove={() => removeImage(idx)} uploading={uploading === idx} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={() => handleDrop(idx)} onDragEnd={handleDragEnd} isDragOver={dragOverIndex === idx} />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => triggerFileInput(null)}
          disabled={uploading !== null}
          className="flex items-center gap-2 px-4 py-2.5 text-sm border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
        >
          {uploading === "add" ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <Plus size={14} /> Add photos
            </>
          )}
        </button>
        {onCurate && (
          <button
            type="button"
            onClick={onCurate}
            disabled={uploading !== null || images.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50"
            title={images.length === 0 ? "Add or re-scrape photos first" : "Score and auto-select the best representative photos"}
          >
            Curate photos
          </button>
        )}
      </div>

      {lightboxIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          name="Photo"
          index={Math.min(lightboxIndex, images.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(images.length - 1, (i ?? 0) + 1))}
          onGoTo={(i) => setLightboxIndex(i)}
        />
      )}
    </div>
  );
}

function PhotoOverlay({
  index,
  onView,
  onReplace,
  onRemove,
  uploading,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}: {
  index: number;
  onView: () => void;
  onReplace: () => void;
  onRemove: () => void;
  uploading: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  isDragOver?: boolean;
}) {
  void index;
  return (
    <div
      draggable={draggable && !uploading}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if (e.target === e.currentTarget) onView();
      }}
      className={`absolute inset-0 flex items-center justify-center transition-all cursor-zoom-in ${
        isDragOver
          ? "bg-brand-500/20 ring-2 ring-inset ring-brand-500"
          : uploading
            ? "bg-black/40"
            : "bg-black/0 hover:bg-black/40"
      }`}
    >
      {uploading ? (
        <Loader2 size={20} className="text-white animate-spin" />
      ) : (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
          <button type="button" onClick={onView} className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors" title="View photo">
            <Eye size={14} />
          </button>
          <button type="button" onClick={onReplace} className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors" title="Replace photo">
            <Upload size={14} />
          </button>
          <button type="button" onClick={onRemove} className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-red-500 hover:bg-white dark:hover:bg-neutral-800 transition-colors" title="Remove photo">
            <Trash2 size={14} />
          </button>
          {draggable && (
            <div className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 cursor-grab active:cursor-grabbing" title="Drag to reorder">
              <GripVertical size={14} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptySlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-500 transition-colors"
    >
      <Plus size={20} />
      <span className="text-xs mt-1">Add</span>
    </button>
  );
}
