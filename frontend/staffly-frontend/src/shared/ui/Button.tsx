import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export default function Button({ variant = "primary", className = "", ...rest }: Props) {
  const base = "rounded-2xl px-4 py-2 text-sm font-medium transition shadow-sm";
  const styles = {
    primary: "bg-black text-white hover:opacity-90 active:opacity-80",
    ghost: "bg-transparent hover:bg-zinc-100",
    outline: "border border-zinc-300 hover:bg-zinc-50",
  } as const;

  return <button className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}
