// Uses real components and local fixtures only; no API requests or working data.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import CommonScheduleView from "../src/features/commonSchedule/components/CommonScheduleView";
import ScheduleTable from "../src/features/schedule/components/ScheduleTable";
import ScheduleTableZoomControls from "../src/features/schedule/components/ScheduleTableZoomControls";
import { useScheduleTableZoom } from "../src/features/schedule/hooks/useScheduleTableZoom";
import { daysBetween } from "../src/features/schedule/utils/date";
import type { CommonSchedule } from "../src/features/commonSchedule/api";
import type { ScheduleData } from "../src/features/schedule/types";
import "../src/index.css";

const days = daysBetween("2026-10-01", "2026-10-30");
const rows = [
  { id: 1, memberId: 1, displayName: "Анна Петрова", positionId: 1, positionName: "Бармен" },
  { id: 2, memberId: 2, displayName: "Александр Константинов", positionId: 1, positionName: "Бармен" },
  { id: 3, memberId: 3, displayName: "Иван Орлов", positionId: 2, positionName: "Старший администратор зала" },
];
const base: ScheduleData = {
  id: 10,
  version: 1,
  title: "Бар",
  status: "PUBLISHED",
  config: { startDate: days[0], endDate: days.at(-1)!, positionIds: [1, 2], shiftMode: "FULL", showFullName: true },
  days: days.map((date) => ({ date, dayNumber: date.slice(-2), weekdayLabel: "пн" })),
  rows,
  cellValues: Object.fromEntries(rows.flatMap((row) => days.map((date) => [`${row.memberId}:${date}`, "09:00-17:00"]))),
};
const fixture: CommonSchedule = {
  summary: {
    id: 1,
    version: 1,
    title: "Общий график · октябрь",
    startDate: days[0],
    endDate: days.at(-1)!,
    visibleToPositions: false,
    scheduleIds: [10, 20],
  },
  sources: [
    { id: 10, version: 1, title: "Бар", content: base },
    {
      id: 20,
      version: 1,
      title: "Официанты и хостес · вечерний состав",
      content: { ...base, config: { ...base.config, startDate: "2026-10-05", endDate: "2026-10-25" } },
    },
  ],
};

function Harness() {
  const [ordinary, setOrdinary] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const zoom = useScheduleTableZoom();
  return (
    <main className="bg-app text-default min-h-screen p-4">
      <div className="mb-4 flex flex-wrap gap-4">
        <label>
          <input type="checkbox" checked={ordinary} onChange={(e) => setOrdinary(e.target.checked)} /> Обычный график
        </label>
        <label>
          <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> Ширина телефона
        </label>
      </div>
      <div style={{ maxWidth: narrow ? 360 : 1440 }} className="space-y-3">
        {ordinary ? (
          <>
            <ScheduleTableZoomControls {...zoom} />
            <div className="overflow-auto">
              <ScheduleTable data={base} readOnly onChange={() => {}} zoomScale={zoom.zoomScale} />
            </div>
          </>
        ) : (
          <CommonScheduleView
            schedule={fixture}
            canManage
            timeZone="Europe/Moscow"
            refreshing={false}
            onBack={() => {}}
            onRefresh={() => {}}
            onEdit={() => {}}
          />
        )}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
