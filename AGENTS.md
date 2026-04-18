<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Typography rules

- **Never use all-uppercase headers or labels.** No `uppercase` / `text-transform: uppercase` / `tracking-wider uppercase` combos on headings, section labels, eyebrows, or pills. Use title case instead. This applies everywhere in the app UI.

# Vocabulary rules

- **User-facing copy says "space", never "spot".** The product refers to listings as "spaces". Code identifiers (`Spot`, `spotId`, `spots` tables, variable names, etc.) can stay as-is — but any string the user will read (headings, empty states, buttons, notification copy, placeholders, tooltips, etc.) must use "space" / "spaces".

# Color rules

- **Never use the hero orange brand color unless explicitly instructed.** The brand orange (`#FD5304` / `var(--color-brand-500)` and related brand-* tokens) is reserved — don't reach for it as an accent, hover, focus ring, badge, pill, link color, or numbered-marker fill on your own initiative. Use neutrals (`neutral-*`, `bg-surface`, `ink-*`) by default. If a new surface genuinely needs the brand color, ask first.

# Button rules

- **Never add icons to buttons.** Buttons are text-only. No leading icon, no trailing icon, no icon-plus-label combinations, no arrow/chevron affordances inside a button. Icon-only controls (a bare clear button, a close X, a drag handle) are fine — but the moment a control has a text label, drop the icon. Existing icon+label buttons in the codebase are legacy; leave them alone unless you're explicitly asked to touch them, and don't use them as a pattern to copy.
