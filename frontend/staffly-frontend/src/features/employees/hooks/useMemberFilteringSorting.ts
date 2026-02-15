import { useEffect, useMemo, useState } from "react";
import type { MemberDto } from "../api";
import { positionKeyOf, sortMembers } from "../utils/memberUtils";

export function useMemberFilteringSorting(members: MemberDto[]) {
  const [positionFilter, setPositionFilter] = useState<string | null>(null);

  const positionOptions = useMemo(() => {
    const unique = new Map<string, string>();

    members.forEach((member) => {
      const key = positionKeyOf(member);
      const label = (member.positionName ?? "").trim();
      if (!key || !label) return;
      if (!unique.has(key)) unique.set(key, label);
    });

    const options = Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((left, right) => left.label.localeCompare(right.label, "ru-RU", { sensitivity: "base" }));

    const hasWithoutPosition = members.some((member) => !(member.positionName ?? "").trim());
    if (hasWithoutPosition) {
      options.push({ key: "none", label: "Без должности" });
    }

    return options;
  }, [members]);

  useEffect(() => {
    if (!positionFilter) return;
    const optionKeys = positionOptions.map((option) => option.key);

    if (positionFilter === "none" && !optionKeys.includes("none")) {
      setPositionFilter(null);
      return;
    }

    if (positionFilter !== "none" && !optionKeys.includes(positionFilter)) {
      setPositionFilter(null);
    }
  }, [positionFilter, positionOptions]);

  const filteredMembers = useMemo(() => {
    if (!positionFilter) return members;

    return members.filter((member) => {
      const label = (member.positionName ?? "").trim();
      if (positionFilter === "none") return !label;
      return positionKeyOf(member) === positionFilter;
    });
  }, [members, positionFilter]);

  const sortedMembers = useMemo(() => sortMembers(filteredMembers), [filteredMembers]);

  return {
    positionOptions,
    filteredMembers,
    sortedMembers,
    positionFilter,
    setPositionFilter,
  };
}
