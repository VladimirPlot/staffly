import type { MouseEvent, ReactNode } from "react";
import IconButton from "../../../../shared/ui/IconButton";

type ActionItem = {
  key: string;
  ariaLabel: string;
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type Props = {
  actions: ActionItem[];
  mobile?: boolean;
  onActionClick?: (event: MouseEvent<HTMLButtonElement>, callback: () => void) => void;
};

export default function EntityActionIconBar({ actions, mobile = false, onActionClick }: Props) {
  return (
    <div className={`relative z-10 ${mobile ? "flex sm:hidden" : "hidden sm:flex"} shrink-0 items-center gap-1`}>
      {actions.map((action) => (
        <IconButton
          key={action.key}
          aria-label={action.ariaLabel}
          title={action.title}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            if (onActionClick) {
              onActionClick(event, action.onClick);
              return;
            }
            action.onClick();
          }}
          disabled={action.disabled}
          className="px-2 py-1.5"
        >
          {action.icon}
        </IconButton>
      ))}
    </div>
  );
}
