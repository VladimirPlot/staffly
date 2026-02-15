import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";

import Card from "../../../shared/ui/Card";
import Input from "../../../shared/ui/Input";
import ContentText from "../../../shared/ui/ContentText";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Button from "../../../shared/ui/Button";

import type { TrainingCategoryDto } from "../api";
import type { TrainingModuleConfig } from "../config";

type Props = {
  category: TrainingCategoryDto;
  moduleConfig: TrainingModuleConfig;
  canManage: boolean;

  isEditing: boolean;
  editName: string;
  editDescription: string;
  saving: boolean;
  actionsOpen: boolean;
  actionsKey: string;

  onToggleActions: () => void;
  onCloseActions: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditNameChange: (value: string) => void;
  onEditDescriptionChange: (value: string) => void;
  onToggleActive: () => void;
  onDelete: () => void;
};

export default function TrainingCategoryCard({
  category,
  moduleConfig,
  canManage,
  isEditing,
  editName,
  editDescription,
  saving,
  actionsOpen,
  actionsKey,
  onToggleActions,
  onCloseActions,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditNameChange,
  onEditDescriptionChange,
  onToggleActive,
  onDelete,
}: Props) {
  const navigate = useNavigate();
  const isActive = category.active !== false;

  return (
    <Card
      className={[
        "relative flex h-full flex-col gap-3 transition",
        "hover:-translate-y-0.5 hover:shadow-[var(--staffly-shadow)]",
        isActive ? "" : "opacity-60",
        isEditing ? "" : "cursor-pointer",
      ].join(" ")}

      onClick={(e) => {
        if (isEditing) return;

        const target = e.target;
        if (target instanceof Element && target.closest("[data-actions]")) {
          return;
        }

        navigate(`/training/${moduleConfig.slug}/categories/${category.id}`);
      }}
    >
      {isEditing ? (
        <div className="grid gap-3">
          <Input
            label="Название"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            autoFocus
          />
          <Input
            label="Описание (опционально)"
            value={editDescription}
            onChange={(e) => onEditDescriptionChange(e.target.value)}
          />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-strong">
                {category.name}
              </div>

              {!isActive && (
                <div className="mt-2 text-xs font-semibold uppercase text-muted">
                  Скрыта
                </div>
              )}
            </div>

            {canManage && (
              <div
                data-actions
                className="relative shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton
                  aria-label="Действия с категорией"
                  data-actions
                  data-actions-trigger={actionsKey}
                  className="h-10 w-10 border border-subtle bg-surface/80 p-0 backdrop-blur"
                  onClick={onToggleActions}
                >
                  <Icon icon={Pencil} size="md" decorative />
                </IconButton>

                {actionsOpen && (
                  <div
                    data-actions
                    data-actions-menu={actionsKey}
                    className="absolute right-0 top-12 z-40 flex w-60 flex-col gap-2 rounded-2xl border border-subtle bg-surface p-3 shadow-[var(--staffly-shadow)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      onClick={() => {
                        onCloseActions();
                        onStartEdit();
                      }}
                    >
                      Редактировать
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        onCloseActions();
                        onToggleActive();
                      }}
                    >
                      {isActive ? "Скрыть" : "Раскрыть"}
                    </Button>

                    <Button
                      variant="outline"
                      className="text-red-500"
                      onClick={() => {
                        onCloseActions();
                        onDelete();
                      }}
                    >
                      Удалить навсегда
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {category.description && (
            <ContentText className="text-sm text-muted">
              {category.description}
            </ContentText>
          )}
        </>
      )}

      {canManage && isEditing && (
        <div className="relative z-10 mt-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={onSaveEdit} disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onCancelEdit}
            disabled={saving}
          >
            Отмена
          </Button>
        </div>
      )}
    </Card>
  );
}
