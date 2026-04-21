// Compute up-to-2-letter uppercase initials from a display name. Used as the
// avatar fallback whenever a profile has no photo set — reads as "Edwin
// Dorsey" → "ED", "madonna" → "M", trimmed/multi-space safe.
export function getInitials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
  );
}
