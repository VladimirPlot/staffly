import type React from "react";

export type ContentTextProps = React.HTMLAttributes<HTMLDivElement>;

export default function ContentText({ className = "", ...rest }: ContentTextProps) {
  return <div className={`whitespace-pre-wrap break-words ${className}`.trim()} {...rest} />;
}
