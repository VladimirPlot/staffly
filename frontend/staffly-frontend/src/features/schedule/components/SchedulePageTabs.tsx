export type SchedulePageTab = "schedules" | "templates" | "common";

export default function SchedulePageTabs({
  value,
  canManage,
  onChange,
}: {
  value: SchedulePageTab;
  canManage: boolean;
  onChange: (value: SchedulePageTab) => void;
}) {
  const tabs: { value: SchedulePageTab; label: string }[] = [
    { value: "schedules", label: "Графики" },
    ...(canManage ? [{ value: "templates" as const, label: "Шаблоны" }] : []),
    { value: "common", label: "Общие графики" },
  ];
  return (
    <div className="max-w-full overflow-x-auto">
      <div
        className="border-subtle bg-surface inline-flex rounded-2xl border p-1 shadow-[var(--staffly-shadow)]"
        role="tablist"
        aria-label="Разделы графиков"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={value === tab.value}
            onClick={() => onChange(tab.value)}
            className={
              "shrink-0 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition " +
              (value === tab.value
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted hover:bg-app hover:text-default")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
