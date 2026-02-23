import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import Icon from "../../../shared/ui/Icon";

type Props = {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

export default function SectionCard({ title, description, to, icon: CardIcon }: Props) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(to);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={title}
      className="group border-subtle bg-surface relative flex min-h-24 flex-col justify-between gap-3 rounded-3xl border p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md focus-visible:-translate-y-[1px] focus-visible:shadow-md"
      onClick={handleNavigate}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleNavigate();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Icon
            icon={CardIcon}
            decorative
            className="text-icon pointer-events-none absolute right-4 bottom-4 h-12 w-12 opacity-[0.12] sm:pointer-events-auto sm:static sm:h-6 sm:w-6 sm:opacity-100"
          />
          <div className="text-strong relative z-10 text-base font-semibold sm:text-lg">
            {title}
          </div>
        </div>
      </div>

      <div className="text-muted hidden text-sm sm:block">{description}</div>
    </div>
  );
}
