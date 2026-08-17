import { motion } from "framer-motion";

import { ACTIVE_TAB_TRANSITION, CHECKLIST_ITEM_TABS } from "../constants";
import type { ChecklistItemGroups, ChecklistItemSectionKey } from "../types";

type ChecklistItemTabsProps = {
  checklistId: number;
  itemGroups: ChecklistItemGroups;
  activeItemTab: ChecklistItemSectionKey;
  onActiveItemTabChange: (tab: ChecklistItemSectionKey) => void;
};

export default function ChecklistItemTabs({
  checklistId,
  itemGroups,
  activeItemTab,
  onActiveItemTabChange,
}: ChecklistItemTabsProps) {
  return (
    <div className="border-subtle bg-app/50 flex gap-1 border-b p-1.5 sm:p-2">
      {CHECKLIST_ITEM_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onActiveItemTabChange(tab.key)}
          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition focus:outline-none ${
            activeItemTab === tab.key
              ? "text-[var(--staffly-text-strong)]"
              : "text-muted hover:text-default hover:bg-[color:var(--staffly-control-hover)]"
          }`}
        >
          {activeItemTab === tab.key && (
            <motion.div
              layoutId={`active-tab-${checklistId}`}
              className="absolute inset-0 z-0 rounded-xl bg-[var(--staffly-surface)] shadow-sm"
              transition={ACTIVE_TAB_TRANSITION}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
          <span className="text-muted relative z-10 rounded-full bg-[var(--staffly-control)] px-2 py-0.5 text-[10px] font-bold tabular-nums">
            {itemGroups[tab.key].length}
          </span>
        </button>
      ))}
    </div>
  );
}
