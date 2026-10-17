import type { CommonSchedule } from "../src/features/commonSchedule/api";

export function commonExportFixture(employeeCount = 2): CommonSchedule {
  return {
    summary: {
      id: 1,
      version: 1,
      title: "Кухня & зал — октябрь",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      visibleToPositions: true,
      scheduleIds: [10, 20],
    },
    sources: [10, 20].map((id, group) => ({
      id,
      version: 1,
      title: group ? "Зал <вечер>" : "Кухня",
      content: {
        config: {
          startDate: group ? "2026-10-05" : "2026-10-01",
          endDate: "2026-10-31",
          shiftMode: group ? "ARRIVAL_ONLY" : "FULL",
          showFullName: true,
          positionIds: [1],
        },
        days: [],
        rows: Array.from({ length: employeeCount }, (_, index) => ({
          id: index + 100,
          memberId: index === 1 ? 1 : index + 1,
          historical: index === 1,
          displayName: index === 0 ? "Александра Константинова" : `Сотрудник ${index + 1}`,
          positionId: 1,
          positionName: group ? "Официант" : "Старший повар",
        })),
        cellValues: Object.fromEntries(
          Array.from({ length: employeeCount }, (_, index) =>
            Array.from({ length: 31 }, (_, day) => [
              `${index === 1 ? -(index + 100) : index + 1}:2026-10-${String(day + 1).padStart(2, "0")}`,
              group ? "09:30" : index === 1 ? "22:00-06:00" : "09:00-17:00",
            ]),
          ).flat(),
        ),
      },
    })),
  };
}
