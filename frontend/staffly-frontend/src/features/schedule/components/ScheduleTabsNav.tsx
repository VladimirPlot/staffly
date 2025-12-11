import React from "react";

type ScheduleTabsNavProps = {
  activeTab: "today" | "table" | "requests";
  hasTodayShifts: boolean;
  onChange: (tab: "today" | "table" | "requests") => void;
};

const ScheduleTabsNav: React.FC<ScheduleTabsNavProps> = ({ activeTab, hasTodayShifts, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-200 text-sm font-medium text-zinc-700">
      <button
        className={`rounded-t-xl px-4 py-2 transition ${
          activeTab === "today"
            ? "border-b-2 border-black text-black"
            : hasTodayShifts
            ? "text-zinc-600 hover:text-black"
            : "cursor-not-allowed text-zinc-400"
        }`}
        disabled={!hasTodayShifts}
        onClick={() => hasTodayShifts && onChange("today")}
      >
        Состав сегодня
      </button>
      <button
        className={`rounded-t-xl px-4 py-2 transition ${
          activeTab === "table" ? "border-b-2 border-black text-black" : "text-zinc-600 hover:text-black"
        }`}
        onClick={() => onChange("table")}
      >
        График
      </button>
      <button
        className={`rounded-t-xl px-4 py-2 transition ${
          activeTab === "requests"
            ? "border-b-2 border-black text-black"
            : "text-zinc-600 hover:text-black"
        }`}
        onClick={() => onChange("requests")}
      >
        Заявки
      </button>
    </div>
  );
};

export default ScheduleTabsNav;
