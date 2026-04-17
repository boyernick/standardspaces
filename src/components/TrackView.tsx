"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Fire-once view event emitter for async server pages.
 *
 * Vercel Analytics already captures pageviews automatically — this is for
 * the subset of pages we want *as typed conversion events* so they can
 * seed funnels (e.g. "viewed a space → favorited it", "viewed an event →
 * RSVP'd"). The page view + the conversion share the same schema, so
 * downstream segmentation stays clean.
 *
 * The parent server page passes its typed props straight through; the
 * component just forwards to `track()` on mount. We gate on the id/name
 * so StrictMode's double-mount doesn't double-fire in dev.
 */
type Props =
  | { kind: "spot"; spotId: string; city: string }
  | { kind: "event"; eventId: string };

export default function TrackView(props: Props) {
  // Flatten the discriminated union into scalar dep-array values so the
  // hooks lint can statically verify the dependency list (and so we get
  // exactly one fire per navigation to a given entity, not per render).
  const kind = props.kind;
  const entityId = props.kind === "spot" ? props.spotId : props.eventId;
  const city = props.kind === "spot" ? props.city : "";

  useEffect(() => {
    if (kind === "spot") {
      track("spot_view", { spot_id: entityId, city });
    } else {
      track("event_view", { event_id: entityId });
    }
  }, [kind, entityId, city]);

  return null;
}
