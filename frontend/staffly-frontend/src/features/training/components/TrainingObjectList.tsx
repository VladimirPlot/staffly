import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, useCombinedRefs } from "@dnd-kit/utilities";
import {
  BookOpen,
  ClipboardCheck,
  ExternalLink,
  Folder,
  FolderOpen,
  HelpCircle,
  Play,
} from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "../../../shared/lib/cn";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import type { ExamProgressDto, TrainingExamDto } from "../api/types";
import { trainingFolderDropId, getTrainingDragOverlayWidth, trainingObjectId } from "../trainingFolderDnd";
import type { TrainingFolderListObject } from "../trainingFolderObjects";
import { trainingObjectTitle } from "../trainingFolderObjects";
import { QUESTION_GROUP_LABELS, QUESTION_TYPE_LABELS } from "../utils/questionLabels";
import type { PracticeExamStatus } from "../utils/practiceExamStatus";
import PracticeExamStatusBadge from "./PracticeExamStatusBadge";
import TrainingObjectActionsMenu, { type TrainingObjectAction } from "./TrainingObjectActionsMenu";
import { buildTrainingObjectManagementActions, trainingObjectArchiveActionKey } from "./trainingObjectManagementActions";

const objectCardClassName =
  "group hover:bg-app relative touch-manipulation select-none overflow-hidden rounded-[1.25rem] p-2.5 transition-[background,border-color,box-shadow,opacity,transform] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] motion-reduce:transition-none sm:p-3";
const selectedCardClassName = "bg-[color:var(--staffly-control)]/25 shadow-[0_14px_34px_rgba(15,23,42,0.08)]";
const selectedCardOverlayClassName =
  "pointer-events-none absolute inset-0 rounded-[1.25rem] border border-[color:var(--staffly-divider)] opacity-0 shadow-[0_0_0_2px_rgba(24,24,27,0.035)_inset] transition-opacity duration-200 ease-out motion-reduce:transition-none";

function handleObjectCardKeyDown(event: KeyboardEvent<HTMLElement>, onOpen: () => void, onClearSelection: () => void) {
  if (event.key === "Enter") {
    event.preventDefault();
    onOpen();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    onClearSelection();
  }
}

function objectIcon(object: TrainingFolderListObject, isOver = false) {
  if (object.kind === "folder") return isOver ? FolderOpen : Folder;
  if (object.kind === "knowledgeItem") return BookOpen;
  if (object.kind === "question") return HelpCircle;
  return ClipboardCheck;
}

function objectDescription(object: TrainingFolderListObject, progress?: ExamProgressDto, practiceStatus?: PracticeExamStatus) {
  switch (object.kind) {
    case "folder":
      return object.folder.description || "Папка";
    case "knowledgeItem":
      return object.item.description || object.item.composition || "Карточка базы знаний";
    case "question":
      return object.question.prompt;
    case "practiceExam":
      return `Вопросов: ${object.exam.questionCount} · Проходной балл: ${object.exam.passPercent}%${
        typeof progress?.scorePercent === "number" ? ` · Последний результат: ${progress.scorePercent}%` : ""
      }${practiceStatus === "IN_PROGRESS" ? " · В процессе" : ""}`;
  }
}

function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span className={cn("border-subtle bg-surface inline-flex rounded-full border px-2 py-0.5 text-xs", muted ? "text-muted" : "text-default")}>
      {children}
    </span>
  );
}

function TrainingObjectCard({
  object,
  actionLoading,
  dragEnabled,
  canDropInto,
  isDragActive,
  selected,
  progress,
  practiceStatus,
  runRoute,
  canManage,
  onOpen,
  onSelect,
  onClearSelection,
  onEdit,
  onMove,
  onArchive,
  onRunPracticeExam,
}: {
  object: TrainingFolderListObject;
  actionLoading: string | null;
  dragEnabled: boolean;
  canDropInto: boolean;
  isDragActive: boolean;
  selected: boolean;
  progress?: ExamProgressDto;
  practiceStatus?: PracticeExamStatus;
  runRoute?: string | null;
  canManage: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onClearSelection: () => void;
  onEdit: () => void;
  onMove: () => void;
  onArchive: () => void;
  onRunPracticeExam?: () => void;
}) {
  const sortableId = trainingObjectId(object.kind, object.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled: !dragEnabled,
  });
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({
    id: object.kind === "folder" ? trainingFolderDropId(object.id) : `training-disabled-drop:${object.kind}:${object.id}`,
    disabled: !dragEnabled || object.kind !== "folder" || !canDropInto,
  });
  const setCombinedNodeRef = useCombinedRefs(setNodeRef, setDropNodeRef);
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const title = trainingObjectTitle(object);
  const IconComponent = objectIcon(object, isOver);
  const managementActions = buildTrainingObjectManagementActions({
    archiveActionKey: trainingObjectArchiveActionKey(object.kind, object.id),
    actionLoading,
    onEdit,
    onMove,
    onArchive,
  });
  const showUnavailableDrop = object.kind === "folder" && isDragActive && !canDropInto && !isDragging;
  const actions: TrainingObjectAction[] = [
    { label: "Открыть", icon: ExternalLink, onSelect: onOpen },
    ...(canManage ? [managementActions.edit, managementActions.move] : []),
    ...(object.kind === "practiceExam" && runRoute
      ? [{ label: "Пройти", icon: Play, onSelect: onRunPracticeExam ?? onOpen } satisfies TrainingObjectAction]
      : []),
    ...(canManage ? [managementActions.archive] : []),
  ];

  return (
    <div ref={setCombinedNodeRef} style={style}>
      <Card
        {...attributes}
        {...listeners}
        data-training-object-card="true"
        role="option"
        tabIndex={0}
        aria-selected={selected}
        className={cn(
          objectCardClassName,
          dragEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          selected && selectedCardClassName,
          isDragging && "opacity-0",
          object.kind === "folder" && isDragActive && canDropInto && !isOver && "ring-dashed ring-1 ring-[var(--staffly-border)]/70 ring-inset",
          isOver &&
            "translate-y-[-1px] scale-[1.006] bg-[color:var(--staffly-control)]/45 shadow-[0_18px_42px_rgba(15,23,42,0.13)] ring-1 ring-[var(--staffly-ring)] ring-inset",
          showUnavailableDrop && "opacity-60",
        )}
        onClick={onSelect}
        onDoubleClick={onOpen}
        onKeyDown={(event) => handleObjectCardKeyDown(event, onOpen, onClearSelection)}
      >
        <span aria-hidden="true" className={cn(selectedCardOverlayClassName, selected && "opacity-100")} />
        <div className="flex items-start gap-2">
          <div className="flex min-h-14 min-w-0 flex-1 items-start gap-3 rounded-2xl px-2 py-2 text-left">
            <span
              className={cn(
                "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--staffly-control)] transition group-hover:bg-[color:var(--staffly-control-hover)]",
                (selected || isOver) &&
                  "text-strong bg-[color:var(--staffly-control-hover)] shadow-sm ring-1 ring-[var(--staffly-ring)]/70 ring-inset",
              )}
            >
              <Icon icon={IconComponent} size="sm" decorative />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="block text-base font-semibold [overflow-wrap:anywhere]">{title}</span>
                {object.kind === "question" ? (
                  <>
                    <Badge>{QUESTION_GROUP_LABELS[object.question.questionGroup]}</Badge>
                    <Badge muted>{QUESTION_TYPE_LABELS[object.question.type]}</Badge>
                  </>
                ) : null}
                {object.kind === "practiceExam" ? <PracticeExamStatusBadge status={practiceStatus ?? null} isHidden={!object.exam.active} /> : null}
              </span>
              <span className="text-muted mt-1 line-clamp-2 block text-sm [overflow-wrap:anywhere]">
                {objectDescription(object, progress, practiceStatus)}
              </span>
            </span>
          </div>
          <div
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <TrainingObjectActionsMenu title={title} description={objectDescription(object, progress, practiceStatus)} actions={actions} />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function TrainingDragOverlayCard({
  object,
  width,
}: {
  object: TrainingFolderListObject | null;
  width: number | null;
}) {
  if (!object) return null;

  const title = trainingObjectTitle(object);
  const IconComponent = objectIcon(object);

  return (
    <div className="pointer-events-none" style={{ width: getTrainingDragOverlayWidth(width) }}>
      <Card className="bg-surface/95 rounded-2xl p-2 opacity-50 shadow-xl ring-1 ring-[var(--staffly-ring)] backdrop-blur">
        <div className="flex min-h-11 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--staffly-control-hover)]">
            <Icon icon={IconComponent} size="sm" decorative />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{title}</span>
            <span className="text-muted mt-0.5 block truncate text-xs">{object.kind}</span>
          </span>
        </div>
      </Card>
    </div>
  );
}

export default function TrainingObjectList({
  objects,
  activeObjectId,
  selectedObjectId,
  blockedFolderIds,
  actionLoading,
  canManage,
  progressByExamId,
  practiceStatusByExamId,
  runRouteByExamId,
  onSelectObject,
  onClearSelection,
  onOpenObject,
  onEditObject,
  onMoveObject,
  onArchiveObject,
  onRunPracticeExam,
}: {
  objects: TrainingFolderListObject[];
  activeObjectId: string | null;
  selectedObjectId: string | null;
  blockedFolderIds: Set<number>;
  actionLoading: string | null;
  canManage: boolean;
  progressByExamId?: Map<number, ExamProgressDto>;
  practiceStatusByExamId?: Map<number, PracticeExamStatus>;
  runRouteByExamId?: Map<number, string | null>;
  onSelectObject: (object: TrainingFolderListObject) => void;
  onClearSelection: () => void;
  onOpenObject: (object: TrainingFolderListObject) => void;
  onEditObject: (object: TrainingFolderListObject) => void;
  onMoveObject: (object: TrainingFolderListObject) => void;
  onArchiveObject: (object: TrainingFolderListObject) => void;
  onRunPracticeExam?: (exam: TrainingExamDto) => void;
}) {
  if (objects.length === 0) return null;

  return (
    <div className="space-y-3" role="listbox" aria-label="Папки и материалы тренинга">
      {objects.map((object) => {
        const objectKey = trainingObjectId(object.kind, object.id);
        const progress = object.kind === "practiceExam" ? progressByExamId?.get(object.id) : undefined;
        const practiceStatus = object.kind === "practiceExam" ? practiceStatusByExamId?.get(object.id) : undefined;
        const runRoute = object.kind === "practiceExam" ? runRouteByExamId?.get(object.id) : undefined;

        return (
          <TrainingObjectCard
            key={objectKey}
            object={object}
            actionLoading={actionLoading}
            dragEnabled={canManage}
            canDropInto={canManage && Boolean(activeObjectId) && !blockedFolderIds.has(object.id)}
            isDragActive={Boolean(activeObjectId)}
            selected={selectedObjectId === objectKey}
            progress={progress}
            practiceStatus={practiceStatus}
            runRoute={runRoute}
            canManage={canManage}
            onOpen={() => onOpenObject(object)}
            onSelect={() => onSelectObject(object)}
            onClearSelection={onClearSelection}
            onEdit={() => onEditObject(object)}
            onMove={() => onMoveObject(object)}
            onArchive={() => onArchiveObject(object)}
            onRunPracticeExam={() => {
              if (object.kind === "practiceExam") onRunPracticeExam?.(object.exam);
            }}
          />
        );
      })}
    </div>
  );
}
