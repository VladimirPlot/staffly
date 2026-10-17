import { useRef, useState } from "react";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import { getErrorMessage } from "../../../shared/utils/errors";
import type { CommonSchedule } from "../api";
import { exportCommonScheduleToJpeg, exportCommonScheduleToXlsx } from "../exporters";

export default function CommonScheduleDownload({ loadSchedule }: { loadSchedule: () => Promise<CommonSchedule> }) {
  const [downloading, setDownloading] = useState<"xlsx" | "jpg" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const download = async (format: "xlsx" | "jpg") => {
    if (busy.current) return;
    busy.current = true;
    setDownloading(format);
    setError(null);
    try {
      // Recheck server access and use one fresh, consistent snapshot of every source.
      const schedule = await loadSchedule();
      if (format === "xlsx") exportCommonScheduleToXlsx(schedule);
      else await exportCommonScheduleToJpeg(schedule);
    } catch (cause) {
      setError(getErrorMessage(cause, "Не удалось скачать общий график."));
    } finally {
      busy.current = false;
      setDownloading(null);
    }
  };
  return (
    <div className="flex max-w-full flex-col items-start gap-1">
      <DropdownMenu
        disabled={downloading != null}
        mobileSheetTitle="Скачать общий график"
        menuClassName="w-72"
        trigger={(props) => (
          <Button variant="outline" {...props} isLoading={downloading != null}>
            {downloading ? `Подготавливаем ${downloading.toUpperCase()}…` : "Скачать"}
          </Button>
        )}
      >
        {({ close }) => (
          <div className="space-y-1 p-1">
            <button
              type="button"
              role="menuitem"
              className="hover:bg-app text-default w-full rounded-xl px-3 py-3 text-left text-sm"
              onClick={() => {
                close();
                void download("xlsx");
              }}
            >
              Скачать XLSX
            </button>
            <button
              type="button"
              role="menuitem"
              className="hover:bg-app text-default w-full rounded-xl px-3 py-3 text-left text-sm"
              onClick={() => {
                close();
                void download("jpg");
              }}
            >
              Скачать JPG в высоком качестве
            </button>
            <p className="text-muted px-3 pb-2 text-xs">Большие графики сохраняются несколькими JPG в ZIP-архиве.</p>
          </div>
        )}
      </DropdownMenu>
      {error && (
        <p role="alert" className="max-w-72 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
