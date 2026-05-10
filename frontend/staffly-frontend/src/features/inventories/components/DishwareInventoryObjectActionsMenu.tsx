import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";

import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import type { InventoryAction } from "../dishwareInventoriesTypes";

function ActionMenuItem({
  action,
  close,
  isMobile,
}: {
  action: InventoryAction;
  close: () => void;
  isMobile: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={action.disabled}
      className={[
        "flex w-full items-center gap-3 rounded-2xl text-left text-sm transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
        isMobile ? "active:bg-app/80 min-h-12 px-4 py-3" : "hover:bg-app px-3 py-2.5",
        action.tone === "danger" ? "text-red-600" : "text-default",
        action.disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
      onClick={() => {
        if (action.disabled) return;
        close();
        action.onSelect();
      }}
    >
      <Icon icon={action.icon} size="sm" decorative className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
    </button>
  );
}

export default function DishwareInventoryObjectActionsMenu({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions: InventoryAction[];
}) {
  return (
    <DropdownMenu
      menuClassName="w-64"
      mobileSheetTitle={title}
      mobileSheetSubtitle={description}
      trigger={(triggerProps) => (
        <IconButton
          aria-label={`Действия: ${title}`}
          title="Действия"
          variant="unstyled"
          className="border-subtle bg-surface/95 text-default hover:bg-app active:bg-app h-11 w-11 border px-0 py-0 shadow-sm backdrop-blur-sm transition active:scale-[0.98]"
          {...triggerProps}
        >
          <Icon icon={MoreVertical} size="sm" decorative />
        </IconButton>
      )}
    >
      {({ close, isMobile }) => (
        <div className={isMobile ? "space-y-1 pb-1" : "space-y-1 p-1"}>
          {actions.map((action) => (
            <ActionMenuItem key={action.label} action={action} close={close} isMobile={isMobile} />
          ))}
        </div>
      )}
    </DropdownMenu>
  );
}
