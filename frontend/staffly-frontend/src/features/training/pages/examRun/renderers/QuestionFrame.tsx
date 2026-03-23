import type { ReactNode } from "react";

type Props = {
  index: number;
  prompt: string;
  children: ReactNode;
  explanation?: ReactNode;
};

export default function QuestionFrame({ index, prompt, children, explanation }: Props) {
  return (
    <div className="rounded-2xl border border-subtle bg-app p-3">
      <div className="font-medium text-default">
        {index + 1}. {prompt}
      </div>
      <div className="mt-2">{children}</div>
      {explanation}
    </div>
  );
}
