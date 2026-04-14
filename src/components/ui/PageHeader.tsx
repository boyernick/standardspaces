/**
 * Page header: h1 title + optional right-aligned CTA slot.
 * The h1 inherits its font/size/weight from the base layer type scale —
 * do NOT pass `className` to the h1 or reapply `fontMartina` inline.
 *
 * If the page needs a subtitle or description, place it as a child
 * below the component (not inside it) — keeps this primitive narrow.
 */
export default function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <h1>{title}</h1>
      {action}
    </div>
  );
}
