import type { MemberDto } from "../../employees/api";

type MemberNameParts = {
  id: number;
  first: string;
  last: string;
};

export function buildMemberDisplayNameMap(members: MemberDto[]): Record<number, string> {
  const partsList: MemberNameParts[] = members
    .map((member) => ({
      id: member.id,
      first: (member.firstName || "").trim() || inferFirstName(member.fullName),
      last: (member.lastName || "").trim() || inferLastName(member.fullName),
    }))
    .map((item) => ({
      ...item,
      first: item.first.trim(),
      last: item.last.trim(),
    }));

  const result: Record<number, string> = {};

  const groups = new Map<string, MemberNameParts[]>();
  partsList.forEach((item) => {
    const key = item.first || "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  groups.forEach((group) => {
    if (group.length === 1) {
      const [item] = group;
      result[item.id] = formatShortName(item.first, item.last, 1);
      return;
    }

    const maxLastLength = Math.max(...group.map((item) => item.last.length));
    let length = 1;
    let unique = false;

    while (!unique && length <= maxLastLength) {
      const seen = new Set<string>();
      unique = group.every((item) => {
        const prefix = lastPrefix(item.last, length);
        if (seen.has(prefix)) {
          return false;
        }
        seen.add(prefix);
        return true;
      });
      if (!unique) length += 1;
    }

    group.forEach((item) => {
      result[item.id] = formatShortName(item.first, item.last, length);
    });
  });

  return result;
}

export function memberDisplayName(member: MemberDto, overrides?: Record<number, string>): string {
  if (overrides?.[member.id]) return overrides[member.id];

  const first = (member.firstName || "").trim() || inferFirstName(member.fullName);
  const last = (member.lastName || "").trim() || inferLastName(member.fullName);

  return formatShortName(first, last, 1);
}

function formatShortName(first: string, last: string, lastLength: number): string {
  const trimmedFirst = first.trim();
  const trimmedLast = last.trim();

  if (trimmedFirst && trimmedLast) {
    return `${trimmedFirst} ${lastPrefix(trimmedLast, lastLength)}.`.trim();
  }
  if (trimmedFirst) return trimmedFirst;
  if (trimmedLast) return `${lastPrefix(trimmedLast, lastLength)}.`;
  return "Без имени";
}

function lastPrefix(last: string, length: number): string {
  return last.slice(0, Math.max(1, length)).trim();
}

function inferFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  return parts[0] || "";
}

function inferLastName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return "";
  return parts[parts.length - 1];
}
