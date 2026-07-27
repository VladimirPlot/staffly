import { Info, X } from "lucide-react";

import DropdownMenu from "../../../shared/ui/DropdownMenu";

type Props = {
  label: string;
  content: string;
  title?: string;
  className?: string;
  iconClassName?: string;
};

export default function ScheduleInfoButton({ label, content, title = "Комментарий", className, iconClassName }: Props) {
  const text = content.trim();
  if (!text) return null;

  return (
    <DropdownMenu
      modalBackdrop
      menuClassName="w-[min(22rem,calc(100vw-16px))]"
      triggerWrapperClassName="inline-flex"
      mobileSheetClassName="max-h-[min(78vh,480px)]"
      trigger={(triggerProps) => (
        <button type="button" className={className} aria-label={label} title={text} {...triggerProps}>
          <Info className={iconClassName} aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="p-4 text-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-strong font-semibold">{title}</h2>
            <button
              type="button"
              className="text-muted hover:text-strong hover:bg-app -mt-1 -mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full transition"
              aria-label={`Закрыть: ${title}`}
              onClick={close}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-default leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
      )}
    </DropdownMenu>
  );
}
