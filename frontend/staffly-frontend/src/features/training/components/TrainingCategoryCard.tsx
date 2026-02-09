import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
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
      className={`relative flex h-full flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-[var(--staffly-shadow)] ${
        isActive ? "" : "opacity-60"
      } ${isEditing ? "" : "cursor-pointer"}`}
      onClick={() => {
        if (!isEditing) {
          navigate(`/training/${moduleConfig.slug}/categories/${category.id}`);
        }
      }}
    >
      {canManage && !isEditing && (
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          <IconButton
            aria-label="Редактировать категорию"
            className="h-9 w-9 border border-subtle bg-surface/80 p-0 backdrop-blur"
            onClick={(event) => {
              event.stopPropagation();
              onStartEdit();
            }}
          >
            <Icon icon={Pencil} size="sm" decorative />
          </IconButton>
          <IconButton
            aria-label={isActive ? "Скрыть категорию" : "Раскрыть категорию"}
            className="h-9 w-9 border border-subtle bg-surface/80 p-0 backdrop-blur"
            onClick={(event) => {
              event.stopPropagation();
              onToggleActive();
            }}
          >
            <Icon icon={isActive ? EyeOff : Eye} size="sm" decorative />
          </IconButton>
          <IconButton
            aria-label="Удалить категорию"
            className="h-9 w-9 border border-subtle bg-surface/80 p-0 text-red-500 backdrop-blur"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Icon icon={Trash2} size="sm" decorative />
          </IconButton>
        </div>
      )}

      <div className="relative z-10">
        {isEditing ? (
          <div className="grid gap-3">
            <Input
              label="Название"
              value={editName}
              onChange={(event) => onEditNameChange(event.target.value)}
              autoFocus
            />
            <Input
              label="Описание (опционально)"
              value={editDescription}
              onChange={(event) => onEditDescriptionChange(event.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="text-lg font-semibold text-strong">{category.name}</div>
            {category.description && (
              <ContentText className="mt-1 text-sm text-muted">{category.description}</ContentText>
            )}
            {!isActive && (
              <div className="mt-2 text-xs font-semibold uppercase text-muted">Скрыта</div>
            )}
          </>
        )}
      </div>

      {canManage && isEditing && (
        <div className="relative z-10 mt-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={onSaveEdit} disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={saving}>
            Отмена
          </Button>
        </div>
      )}
    </Card>
  );
}
