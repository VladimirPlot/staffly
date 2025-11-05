import React from "react";

type Props = {
  name: string;
  imageUrl?: string;
  className?: string;
};

export default function Avatar({ name, imageUrl, className = "" }: Props) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => { setBroken(false); }, [imageUrl]);

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
        className={`h-9 w-9 rounded-full border border-zinc-200 object-cover ${className}`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
