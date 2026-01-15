import React from "react";
import { ChevronDown } from "lucide-react";
import Icon from "../../../shared/ui/Icon";

type TaskGroupProps = {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children?: React.ReactNode;
};

const TaskGroup: React.FC<TaskGroupProps> = ({ title, count, defaultOpen = false, children }) => {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold">{title}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
            {count}
          </span>
        </div>
        <Icon
          icon={ChevronDown}
          size="md"
          className={`text-zinc-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-zinc-100 px-4 py-4">{children}</div>}
    </div>
  );
};

export default TaskGroup;
