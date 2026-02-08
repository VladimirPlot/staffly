import React from "react";

type ScheduleTabsNavProps = {
  activeTab: "today" | "table" | "requests";
  hasTodayShifts: boolean;
  onChange: (tab: "today" | "table" | "requests") => void;
};

const ScheduleTabsNav: React.FC<ScheduleTabsNavProps> = ({ activeTab, hasTodayShifts, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2 border-b border-subtle text-sm font-medium text-default">
      <button
        className={`rounded-t-xl px-4 py-2 transition ${
          activeTab === "today"
            ? "border-b-2 border-subtle text-strong"
            : hasTodayShifts
            ? "text-muted hover:text-strong"
            : "cursor-not-allowed text-muted"
        }`}
        disabled={!hasTodayShifts}
        onClick={() => hasTodayShifts && onChange("today")}
      >
        Состав сегодня
      </button>
      <button
        className={`rounded-t-xl px-4 py-2 transition ${
          activeTab === "table"
            ? "border-b-2 border-subtle text-strong"
            : "text-muted hover:text-strong"
        }`}
        onClick={() => onChange("table")}
      >
        График
      </button>
      <button
        className={`rounded-t-xl px-4 py-2 transition ${
          activeTab === "requests"
            ? "border-b-2 border-subtle text-strong"
            : "text-muted hover:text-strong"
        }`}
        onClick={() => onChange("requests")}
      >
        Заявки
      </button>
    </div>
  );
};

export default ScheduleTabsNav;
