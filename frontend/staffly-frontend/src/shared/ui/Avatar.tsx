import React from "react";

type Props = {
  name: string;
  imageUrl?: string;
  className?: string;
};

export default function Avatar({ name, imageUrl, className = "" }: Props) {
  const [broken, setBroken] = React.useState(false);

  React.useEffect(() => {
    setBroken(false);
  }, [imageUrl]);

  const initials = React.useMemo(() => {
    return (
      (name || "")
        .trim()
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U"
    );
  }, [name]);

  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`h-9 w-9 overflow-hidden rounded-full border border-subtle bg-surface object-cover ${className}`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`flex h-9 w-9 select-none items-center justify-center overflow-hidden rounded-full border border-subtle bg-app text-xs font-semibold text-default ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
