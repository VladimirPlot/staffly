import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import Icon from "../../../shared/ui/Icon";

type TaskGroupProps = {
  title: string;
  count: number;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children?: ReactNode;
};

const TaskGroup = ({
  title,
  count,
  defaultOpen = false,
  open,
  onToggle,
  children,
}: TaskGroupProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const handleToggle = () => {
    if (open === undefined) {
      setInternalOpen((prev) => !prev);
      return;
    }
    onToggle?.(!open);
  };

  return (
    <div className="rounded-3xl border border-subtle bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold">{title}</span>
          <span className="rounded-full bg-app px-2 py-0.5 text-xs text-muted">
            {count}
          </span>
        </div>
        <Icon
          icon={ChevronDown}
          size="md"
          className={`text-muted transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && <div className="border-t border-subtle px-4 py-4">{children}</div>}
    </div>
  );
};

export default TaskGroup;
