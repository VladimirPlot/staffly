import type { ChecklistDto, ChecklistItemDto, ChecklistKind } from "../api";
import type { ChecklistItemGroups, ChecklistItemSectionKey, ChecklistWorkSummary } from "../types";

export function groupChecklistItems(items: ChecklistItemDto[]): ChecklistItemGroups {
  const groups: ChecklistItemGroups = {
    available: [],
    reserved: [],
    done: [],
  };

  items.forEach((item) => {
    if (item.done) {
      groups.done.push(item);
      return;
    }

    if (item.reservedBy) {
      groups.reserved.push(item);
      return;
    }

    groups.available.push(item);
  });

  return groups;
}

export function getInitialItemTab(groups: ChecklistItemGroups): ChecklistItemSectionKey {
  if (groups.available.length > 0) return "available";
  if (groups.reserved.length > 0) return "reserved";
  if (groups.done.length > 0) return "done";
  return "available";
}

export function getChecklistItemTotal(groups: ChecklistItemGroups): number {
  return groups.available.length + groups.reserved.length + groups.done.length;
}

export function getChecklistWorkSummary(
  checklist: ChecklistDto,
  itemGroups = groupChecklistItems(checklist.items),
): ChecklistWorkSummary {
  const total = getChecklistItemTotal(itemGroups);
  const doneCount = itemGroups.done.length;
  const reservedCount = itemGroups.reserved.length;
  const availableCount = itemGroups.available.length;

  if (total === 0) {
    return {
      label: "Нет пунктов",
      detail: "пока нечего брать",
      status: "empty",
      badgeClassName: "border-subtle bg-[color:var(--staffly-control)] text-muted",
    };
  }

  if (checklist.completed || doneCount === total) {
    return {
      label: "Все готово",
      detail: `${doneCount}/${total} закрыто`,
      status: "completed",
      badgeClassName: "border-emerald-300 bg-emerald-50 text-default dark:border-emerald-500/45 dark:bg-emerald-500/15",
    };
  }

  if (reservedCount > 0) {
    return {
      label: `${reservedCount} в работе`,
      detail: availableCount > 0 ? `${availableCount} не взято` : `${doneCount}/${total} закрыто`,
      status: "reserved",
      badgeClassName: "border-amber-300 bg-amber-50 text-default dark:border-amber-500/45 dark:bg-amber-500/15",
    };
  }

  return {
    label: `${availableCount} не взято`,
    detail: doneCount > 0 ? `${doneCount}/${total} закрыто` : "ожидает старта",
    status: "available",
    badgeClassName: "border-subtle bg-[color:var(--staffly-control)] text-default",
  };
}

export function sortVisibleChecklists(checklists: ChecklistDto[], activeKind: ChecklistKind): ChecklistDto[] {
  const collator = new Intl.Collator("ru", { sensitivity: "base" });
  return [...checklists].sort((a, b) => {
    if (activeKind === "TRACKABLE") {
      const completedDiff = Number(a.completed) - Number(b.completed);
      if (completedDiff !== 0) {
        return completedDiff;
      }
    }
    return collator.compare(a.name ?? "", b.name ?? "");
  });
}
