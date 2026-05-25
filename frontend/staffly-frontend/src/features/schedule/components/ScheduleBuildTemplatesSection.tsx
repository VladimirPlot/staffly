import React from "react";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import type { PositionDto } from "../../dictionaries/api";
import type { SaveScheduleBuildTemplateRequest, ScheduleBuildTemplateDto } from "../api";
import ScheduleBuildTemplateDialog from "./ScheduleBuildTemplateDialog";

type Props = {
  templates: ScheduleBuildTemplateDto[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  deletingId: number | null;
  positions: PositionDto[];
  onLoad: () => void;
  onCreate: (request: SaveScheduleBuildTemplateRequest) => void;
  onUpdate: (templateId: number, request: SaveScheduleBuildTemplateRequest) => void;
  onArchive: (templateId: number) => void;
};

const ScheduleBuildTemplatesSection: React.FC<Props> = ({
  templates,
  loading,
  error,
  saving,
  deletingId,
  positions,
  onLoad,
  onCreate,
  onUpdate,
  onArchive,
}) => {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ScheduleBuildTemplateDto | null>(null);
  React.useEffect(() => {
    void onLoad();
  }, [onLoad]);
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Настройки сборки</h2>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Создать шаблон
          </Button>
        </div>
        {loading && <div className="text-muted text-sm">Загрузка шаблонов...</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && templates.length === 0 && <div className="text-muted text-sm">Пока нет шаблонов сборки.</div>}
        <div className="space-y-3">
          {templates.map((item) => (
            <div key={item.id} className="border-subtle rounded-2xl border p-3">
              <div className="font-medium">{item.name}</div>
              <div className="text-muted text-sm">{item.description ?? "Без описания"}</div>
              <div className="mt-1 text-sm">Должностей: {item.positionConfigs?.length ?? 0}</div>
              <div className="text-muted mt-1 text-xs">
                {(item.positionConfigs ?? [])
                  .slice(0, 3)
                  .map((p) => p.positionName)
                  .join(", ") || "—"}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(item);
                    setOpen(true);
                  }}
                >
                  Редактировать
                </Button>
                <Button variant="outline" disabled={deletingId === item.id} onClick={() => onArchive(item.id)}>
                  {deletingId === item.id ? "Архивирование..." : "Архивировать"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ScheduleBuildTemplateDialog
        open={open}
        template={editing}
        positions={positions}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={(request, id) => {
          if (id) {
            onUpdate(id, request);
          } else {
            onCreate(request);
          }
          setOpen(false);
        }}
      />
    </Card>
  );
};

export default ScheduleBuildTemplatesSection;
