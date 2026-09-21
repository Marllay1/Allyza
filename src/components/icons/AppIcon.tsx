import { ICONS, type IconName } from "./registry";

/** The only way UI code renders an icon. Consistent size, weight (set once in CSS) and alignment. */
export function AppIcon({ name, size = 20, className = "", label }: { name: IconName; size?: number; className?: string; label?: string }) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
