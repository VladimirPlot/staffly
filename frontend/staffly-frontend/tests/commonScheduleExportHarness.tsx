// Local fixtures only. No API calls or production data.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import SchedulePageTabs, { type SchedulePageTab } from "../src/features/schedule/components/SchedulePageTabs";
import CommonScheduleView from "../src/features/commonSchedule/components/CommonScheduleView";
import CommonScheduleDownload from "../src/features/commonSchedule/components/CommonScheduleDownload";
import { renderCommonScheduleJpegs, exportCommonScheduleToXlsx } from "../src/features/commonSchedule/exporters";
import { commonExportFixture } from "./commonScheduleExportFixture";
import Button from "../src/shared/ui/Button";
import "../src/index.css";

function Harness() {
  const [tab, setTab] = useState<SchedulePageTab>("common");
  const [narrow, setNarrow] = useState(false);
  const [large, setLarge] = useState(false);
  const [images, setImages] = useState<{ url: string; filename: string }[]>([]);
  const [message, setMessage] = useState("");
  const fixture = commonExportFixture(large ? 90 : 2);
  useEffect(() => () => images.forEach((image) => URL.revokeObjectURL(image.url)), [images]);
  const preview = async () => {
    setMessage("Формируем JPG…");
    try {
      const files = await renderCommonScheduleJpegs(fixture);
      setImages(files.map((file) => ({ filename: file.filename, url: URL.createObjectURL(file.blob) })));
      setMessage(`Готово: ${files.length} JPG`);
    } catch (error) {
      setMessage(String(error));
    }
  };
  return (
    <main className="bg-app text-default min-h-screen space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <label>
          <input type="checkbox" checked={narrow} onChange={(event) => setNarrow(event.target.checked)} /> Ширина
          телефона
        </label>
        <label>
          <input type="checkbox" checked={large} onChange={(event) => setLarge(event.target.checked)} /> 180 сотрудников
        </label>
        <Button onClick={() => exportCommonScheduleToXlsx(fixture)}>Тестовый XLSX</Button>
        <Button onClick={() => void preview()}>Проверить JPG</Button>
      </div>
      <div style={{ width: narrow ? 360 : undefined, maxWidth: "100%" }} className="space-y-4">
        <SchedulePageTabs value={tab} canManage onChange={setTab} />
        {tab === "common" ? (
          <CommonScheduleView
            schedule={fixture}
            canManage
            timeZone="Europe/Moscow"
            refreshing={false}
            downloadControl={<CommonScheduleDownload loadSchedule={async () => fixture} />}
            onBack={() => setTab("schedules")}
            onRefresh={() => {}}
            onEdit={() => {}}
          />
        ) : (
          <p>{tab === "schedules" ? "Список обычных графиков" : "Список шаблонов"}</p>
        )}
      </div>
      <p role="status">{message}</p>
      {images.slice(0, 1).map((image) => (
        <figure key={image.url} className="max-w-full overflow-auto border bg-white">
          <figcaption>{image.filename}</figcaption>
          <img src={image.url} alt={image.filename} style={{ width: "auto", maxWidth: "none" }} />
        </figure>
      ))}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
