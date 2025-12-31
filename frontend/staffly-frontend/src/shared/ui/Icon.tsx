import type { LucideIcon } from "lucide-react";

type IconSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<IconSize, string> = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
};

type Props = {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  title?: string;
  decorative?: boolean;
};

export default function Icon({
  icon: IconComp,
  size = "sm",
  className = "",
  title,
  decorative = true,
}: Props) {

  return (
    <IconComp
      className={`${sizeMap[size]} ${className}`}
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative ? title : undefined}
      focusable="false"
    />
  );
}
