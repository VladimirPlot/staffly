import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { ArrowLeft, ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

type Props = {
  home?: React.ReactNode;
  homeTo?: string;
  homeLabel?: string;
  items: BreadcrumbItem[];
  className?: string;
};

export default function Breadcrumbs({
  home,
  homeTo = "/app",
  homeLabel = "На главную",
  items,
  className = "",
}: Props) {
  const navigate = useNavigate();

  const pillBase =
    "inline-flex items-center gap-1 rounded-2xl border border-zinc-300 " +
    "bg-white px-2 py-1 text-sm font-medium text-zinc-700 shadow-sm " +
    "transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300";

  const currentPill =
    "inline-flex items-center rounded-2xl border border-zinc-300 " +
    "bg-zinc-50 px-2 py-1 text-sm font-medium text-zinc-800";

  const sep = <Icon icon={ChevronRight} size="xs" className="text-zinc-400" decorative />;

  const depth = items.length;

  // parent = предпоследний элемент (если есть)
  const parent = depth >= 2 ? items[depth - 2] : undefined;
  const parentTo = parent?.to;

  const handleBack = () => {
    if (parentTo) navigate(parentTo);
    else navigate(-1);
  };

  // label для кнопки "Назад"
  const backLabel = parent?.label ? `${parent.label}` : "Назад";

  const homeButton =
    home ?? (
      <Link to={homeTo} className={pillBase + " shrink-0"} title={homeLabel}>
        <Icon icon={ArrowLeft} size="xs" decorative />
        <span className="truncate">{homeLabel}</span>
      </Link>
    );

  const shouldShowBack = depth >= 2;

  return (
    <>
      {/* Mobile: Home + Back(with parent) */}
      <div className={`flex min-w-0 items-center gap-2 text-sm text-zinc-700 sm:hidden ${className}`}>
        {/* Home фиксированный, не сжимается */}
        {homeButton}

        {/* Back занимает оставшееся место и красиво обрезается */}
        {shouldShowBack && (
          <button
            type="button"
            onClick={handleBack}
            className={pillBase + " shrink-0 max-w-[60vw]"}
            title={backLabel}
          >
            <Icon icon={ArrowLeft} size="xs" decorative />
            <span className="min-w-0 truncate">{backLabel}</span>
          </button>
        )}
      </div>

      {/* Desktop: home + full breadcrumbs */}
      <div className={`hidden flex-wrap items-center gap-1 text-sm text-zinc-700 sm:flex ${className}`}>
        {homeButton}
        {items.length > 0 && sep}
        {items.map((it, i) => {
          const isLast = i === items.length - 1;

          return (
            <React.Fragment key={i}>
              {i > 0 && sep}
              {it.to && !isLast ? (
                <Link to={it.to} className={pillBase} title={it.label}>
                  <span className="truncate">{it.label}</span>
                </Link>
              ) : (
                <span className={isLast ? currentPill : pillBase} title={it.label}>
                  <span className="truncate">{it.label}</span>
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}
