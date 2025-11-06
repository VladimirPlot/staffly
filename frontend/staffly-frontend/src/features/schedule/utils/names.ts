import type { MemberDto } from "../../employees/api";

export function memberDisplayName(member: MemberDto, full: boolean): string {
  const first = (member.firstName || "").trim();
  const last = (member.lastName || "").trim();
  const fullName = (member.fullName || "").trim();

  if (full) {
    if (first || last) {
      return [first, last].filter(Boolean).join(" ").trim();
    }
    return fullName || "Без имени";
  }

  const firstForShort = first || inferFirstName(fullName);
  const lastForShort = last || inferLastName(fullName);

  if (firstForShort && lastForShort) {
    return `${firstForShort} ${lastForShort.charAt(0)}.`.trim();
  }
  if (firstForShort) return firstForShort;
  if (lastForShort) return `${lastForShort.charAt(0)}.`;
  return "Без имени";
}

function inferFirstName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  return parts[0] || "";
}

function inferLastName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return "";
  return parts[parts.length - 1];
}
