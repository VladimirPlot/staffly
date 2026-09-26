import React from "react";

import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import type { PositionDto } from "../../dictionaries/api";
import type { MemberDto } from "../../employees/api";
import { displayNameOf } from "../../employees/utils/memberUtils";
import {
  createMarkerDraft,
  type ScheduleBuildMarkerDraft,
  type ScheduleBuildPositionConfigDraft,
} from "../utils/buildTemplateDraft";

type Props = {
  config: ScheduleBuildPositionConfigDraft;
  members: MemberDto[];
  positions: PositionDto[];
  saving: boolean;
  onChange: (next: ScheduleBuildPositionConfigDraft) => void;
};

const ScheduleBuildMarkersEditor: React.FC<Props> = ({ config, members, positions, saving, onChange }) => {
  const [editing, setEditing] = React.useState<ScheduleBuildMarkerDraft | null>(null);
  const [deleteCandidate, setDeleteCandidate] = React.useState<ScheduleBuildMarkerDraft | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const eligibleMembers = React.useMemo(
    () =>
      members
        .filter((member) => member.positionId != null && config.positionIds.includes(member.positionId))
        .sort((left, right) => {
          const nameOrder = displayNameOf(left).localeCompare(displayNameOf(right), "ru-RU", { sensitivity: "base" });
          return nameOrder || left.id - right.id;
        }),
    [config.positionIds, members],
  );
  const positionsById = React.useMemo(
    () => new Map(positions.map((position) => [position.id, position.name])),
    [positions],
  );

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setError(null);
  };

  const saveMarker = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      setError("Укажите название маркера");
      return;
    }
    if (name.length > 100) {
      setError("Название маркера не должно быть длиннее 100 символов");
      return;
    }
    const normalizedName = name.toLocaleLowerCase("ru-RU");
    if (
      config.markers.some(
        (marker) => marker.key !== editing.key && marker.name.trim().toLocaleLowerCase("ru-RU") === normalizedName,
      )
    ) {
      setError("Маркер с таким названием уже существует в блоке");
      return;
    }
    const saved = { ...editing, name, memberIds: [...new Set(editing.memberIds)].sort((a, b) => a - b) };
    const exists = config.markers.some((marker) => marker.key === editing.key);
    onChange({
      ...config,
      markers: exists
        ? config.markers.map((marker) => (marker.key === editing.key ? saved : marker))
        : [...config.markers, saved],
    });
    setEditing(null);
    setError(null);
  };

  const deleteMarker = (marker: ScheduleBuildMarkerDraft) => {
    onChange({
      ...config,
      markers: config.markers.filter((item) => item.key !== marker.key),
      weekdayRegimes: config.weekdayRegimes.map((regime) => ({
        ...regime,
        shiftOptions: regime.shiftOptions.map((option) =>
          option.markerKey === marker.key ? { ...option, markerKey: null } : option,
        ),
      })),
    });
    setDeleteCandidate(null);
  };

  return (
    <section className="space-y-2 rounded-xl bg-gray-50 p-3">
      <div>
        <div className="text-sm font-medium">Маркеры</div>
        <div className="text-muted text-xs">Маркер задаёт приоритет сотрудников для выбранных вариантов смен.</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {config.markers.map((marker) => (
          <button
            key={marker.key}
            type="button"
            disabled={saving}
            className="border-subtle bg-surface hover:bg-app rounded-full border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setEditing({ ...marker, memberIds: [...marker.memberIds] });
              setError(null);
            }}
          >
            {marker.name}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => {
            setEditing(createMarkerDraft());
            setError(null);
          }}
        >
          + Создать маркер
        </Button>
      </div>

      <Modal open={editing !== null} title="Маркер" onClose={closeEditor} className="max-w-lg">
        {editing && (
          <>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <Input
                label="Название"
                value={editing.name}
                disabled={saving}
                onChange={(event) => {
                  setEditing({ ...editing, name: event.target.value });
                  setError(null);
                }}
              />
              <div className="space-y-2">
                <div className="text-sm font-medium">Сотрудники</div>
                {eligibleMembers.length === 0 ? (
                  <div className="text-muted text-sm">В блоке пока нет сотрудников с выбранными должностями.</div>
                ) : (
                  <div className="border-subtle divide-y rounded-xl border">
                    {eligibleMembers.map((member) => {
                      const checked = editing.memberIds.includes(member.id);
                      return (
                        <label key={member.id} className="flex cursor-pointer items-start gap-3 px-3 py-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            disabled={saving}
                            onChange={() =>
                              setEditing({
                                ...editing,
                                memberIds: checked
                                  ? editing.memberIds.filter((id) => id !== member.id)
                                  : [...new Set([...editing.memberIds, member.id])].sort((a, b) => a - b),
                              })
                            }
                          />
                          <span>
                            <span className="block text-sm font-medium">{displayNameOf(member)}</span>
                            <span className="text-muted block text-xs">
                              {member.positionName ??
                                (member.positionId == null
                                  ? "Без должности"
                                  : (positionsById.get(member.positionId) ?? "Должность"))}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            </div>
            <div className="mt-6 flex flex-wrap justify-between gap-2">
              <div>
                {config.markers.some((marker) => marker.key === editing.key) && (
                  <Button
                    variant="danger-ghost"
                    disabled={saving}
                    onClick={() => {
                      setDeleteCandidate(editing);
                      setEditing(null);
                    }}
                  >
                    Удалить маркер
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={saving} onClick={closeEditor}>
                  Отмена
                </Button>
                <Button disabled={saving} onClick={saveMarker}>
                  Сохранить
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>
      <ConfirmDialog
        open={deleteCandidate !== null}
        title={`Удалить маркер «${deleteCandidate?.name ?? ""}»?`}
        description="Он будет снят со всех вариантов смен в этом блоке."
        confirmText="Удалить"
        cancelText="Отмена"
        tone="danger"
        onCancel={() => {
          setEditing(deleteCandidate);
          setDeleteCandidate(null);
        }}
        onConfirm={() => deleteCandidate && deleteMarker(deleteCandidate)}
      />
    </section>
  );
};

export default ScheduleBuildMarkersEditor;
