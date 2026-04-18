"use client";

// Three-snap bottom sheet for the mobile planner (peek / half / full).
// The map lives behind the sheet — we never hide it — so the user can
// see candidate pins while the sheet is at peek or half.
//
// Mechanics:
// - Drag handle (the 36×4 pill) is the drag target; body doesn't drive
//   the gesture so internal scrolling works cleanly at the full snap.
// - Snap points are expressed as fractions of viewport height
//   (DEFAULT_SNAPS), resolved on mount + on window resize so rotation
//   recomputes correctly.
// - When the user lifts off, we pick the nearest snap that also agrees
//   with the swipe velocity (framer-motion's `info.velocity.y`) — a
//   fast flick skips a snap.
// - At "full" snap we render a subtle scrim behind the sheet (still
//   tappable — map stays reactive).
//
// This component is purely presentational — it takes children and
// reports snap changes. The planner wires its own peek / half / full
// content density via conditional rendering.

import {
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export type BottomSheetSnap = "peek" | "half" | "full";

export interface BottomSheetProps {
  snap: BottomSheetSnap;
  onSnapChange: (next: BottomSheetSnap) => void;
  /** Fractions of `window.innerHeight` to subtract from the bottom. The
   *  default triples are the plan spec: peek ≈ 18vh, half ≈ 55vh,
   *  full ≈ 95vh of *visible* sheet height. */
  snapFractions?: { peek: number; half: number; full: number };
  children: React.ReactNode;
  /** Optional aria label so screen readers describe the drawer. */
  ariaLabel?: string;
  /** Rendered inside the sheet above children — typically the plan header
   *  that stays visible at peek. Falls outside the scroll container so
   *  it doesn't get lost when the body scrolls. */
  header?: React.ReactNode;
}

const DEFAULT_SNAPS = { peek: 0.18, half: 0.55, full: 0.95 };

export default function BottomSheet({
  snap,
  onSnapChange,
  snapFractions = DEFAULT_SNAPS,
  children,
  ariaLabel = "Plan details",
  header,
}: BottomSheetProps) {
  // Resolve snap fractions to absolute "translateY from bottom" numbers.
  // We store the sheet's `y` motion value so the handle drag moves the
  // container in real-time and the snap animation settles to an exact
  // pixel height.
  const [vh, setVh] = useState<number>(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );

  useEffect(() => {
    function onResize() {
      setVh(window.innerHeight);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const snapPx = {
    peek: Math.round(vh * snapFractions.peek),
    half: Math.round(vh * snapFractions.half),
    full: Math.round(vh * snapFractions.full),
  };

  // We animate `height` via motion so the sheet grows upward from the
  // bottom. `y` is unused for position — it just scales the scrim opacity
  // during drag via a derived transform.
  const height = useMotionValue<number>(snapPx[snap]);
  const controls = useAnimation();

  // Re-sync when the parent changes snap (e.g. programmatic drop to
  // half after "+ Add").
  useEffect(() => {
    controls.start({ height: snapPx[snap] }).catch(() => {});
    height.set(snapPx[snap]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, vh]);

  const scrimOpacity = useTransform(
    height,
    [snapPx.peek, snapPx.full],
    [0, 0.35],
  );

  // During the drag, we mutate `height` directly: the handle pushes the
  // sheet's top edge up/down. We don't hand control to framer's own
  // `drag="y"` on a transform because we want the sheet to visually
  // grow, not slide.
  const dragStartHeightRef = useRef<number>(snapPx[snap]);

  const pickSnap = useCallback(
    (targetHeight: number, velocityY: number): BottomSheetSnap => {
      const points: [BottomSheetSnap, number][] = [
        ["peek", snapPx.peek],
        ["half", snapPx.half],
        ["full", snapPx.full],
      ];
      // Velocity > 0 means finger moved down (sheet shrinks) — prefer
      // a smaller snap than the resting nearest. Velocity < 0 means up —
      // prefer a larger snap.
      const VELOCITY_THRESHOLD = 600;
      const currentIdx = nearest(targetHeight, points.map(([, v]) => v));
      if (velocityY > VELOCITY_THRESHOLD && currentIdx > 0) {
        return points[currentIdx - 1][0];
      }
      if (velocityY < -VELOCITY_THRESHOLD && currentIdx < points.length - 1) {
        return points[currentIdx + 1][0];
      }
      return points[currentIdx][0];
    },
    [snapPx.peek, snapPx.half, snapPx.full],
  );

  function onDragStart() {
    dragStartHeightRef.current = height.get();
  }

  function onDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const next = clamp(
      dragStartHeightRef.current - info.offset.y,
      snapPx.peek * 0.5,
      snapPx.full + 20,
    );
    height.set(next);
  }

  function onDragEnd(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) {
    const next = pickSnap(height.get(), info.velocity.y);
    controls.start({ height: snapPx[next] }).catch(() => {});
    if (next !== snap) onSnapChange(next);
  }

  return (
    <>
      {/* Scrim — pointer-events: none so the map behind stays tappable.
          Scales with sheet height so there's a gentle darken at full. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: scrimOpacity }}
      />

      <motion.section
        role="dialog"
        aria-label={ariaLabel}
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-2xl shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.25)] border-t border-neutral-200 dark:border-neutral-800 flex flex-col"
        style={{
          height,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          touchAction: "none",
        }}
        animate={controls}
        transition={{ type: "spring", stiffness: 320, damping: 36 }}
      >
        {/* Drag handle — the only drag target. */}
        <motion.div
          className="shrink-0 py-2.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0}
          dragMomentum={false}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          onClick={() => {
            // Tap-to-cycle up: peek → half → full → peek.
            const order: BottomSheetSnap[] = ["peek", "half", "full"];
            const idx = order.indexOf(snap);
            onSnapChange(order[(idx + 1) % order.length]);
          }}
        >
          <div className="w-9 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </motion.div>

        {header && <div className="shrink-0">{header}</div>}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </motion.section>
    </>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function nearest(target: number, points: number[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(points[i] - target);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
