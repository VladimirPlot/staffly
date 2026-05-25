import React from "react";
import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Textarea from "../../../shared/ui/Textarea";
import type { PositionDto } from "../../dictionaries/api";
import type { SaveScheduleBuildTemplateRequest, ScheduleBuildTargetPattern, ScheduleBuildTemplateDto } from "../api";

type Props = {
  open: boolean;
  template: ScheduleBuildTemplateDto | null;
  positions: PositionDto[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (req: SaveScheduleBuildTemplateRequest, id?: number) => void;
};
const patterns: { value: ScheduleBuildTargetPattern; label: string }[] = [
  { value: "NONE", label: "Без шаблона" },
  { value: "TWO_TWO", label: "2/2" },
  { value: "THREE_THREE", label: "3/3" },
  { value: "FIVE_TWO", label: "5/2" },
];
const days = [1, 2, 3, 4, 5, 6, 7];
const createOption = () => ({ startTime: "", endTime: "", label: "", isFullShift: false, sortOrder: 0 });
const createRule = () => ({ dayOfWeek: 1, startTime: "", endTime: "", requiredCount: 1, sortOrder: 0 });
type PositionDraft = {
  positionId: number | string;
  fullShiftStart: string;
  fullShiftEnd: string;
  targetPattern: ScheduleBuildTargetPattern;
  minRestHours: number;
  maxShiftsPerPeriod: number;
  sortOrder: number;
  shiftOptions: ReturnType<typeof createOption>[];
  coverageRules: ReturnType<typeof createRule>[];
};
const createPosition = () => ({
  positionId: "",
  fullShiftStart: "",
  fullShiftEnd: "",
  targetPattern: "NONE" as ScheduleBuildTargetPattern,
  minRestHours: 12,
  maxShiftsPerPeriod: 5,
  sortOrder: 0,
  shiftOptions: [createOption()],
  coverageRules: [] as ReturnType<typeof createRule>[],
});

const ScheduleBuildTemplateDialog: React.FC<Props> = ({ open, template, positions, saving, onClose, onSubmit }) => {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [positionConfigs, setPositionConfigs] = React.useState<PositionDraft[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setDescription(template?.description ?? "");
    setError(null);
    setPositionConfigs(
      template?.positionConfigs?.map((c) => ({
        positionId: c.positionId,
        fullShiftStart: c.fullShiftStart,
        fullShiftEnd: c.fullShiftEnd,
        targetPattern: c.targetPattern,
        minRestHours: c.minRestHours,
        maxShiftsPerPeriod: c.maxShiftsPerPeriod,
        sortOrder: c.sortOrder,
        shiftOptions: (c.shiftOptions ?? []).map((o) => ({
          startTime: o.startTime,
          endTime: o.endTime,
          label: o.label ?? "",
          isFullShift: o.isFullShift,
          sortOrder: o.sortOrder,
        })),
        coverageRules: (c.coverageRules ?? []).map((r) => ({
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          requiredCount: r.requiredCount,
          sortOrder: r.sortOrder,
        })),
      })) ?? [createPosition()],
    );
  }, [open, template]);
  const validate = () => {
    if (!name.trim()) return "Укажите название шаблона";
    if (positionConfigs.length === 0) return "Добавьте хотя бы одну должность";
    for (let i = 0; i < positionConfigs.length; i++) {
      const c = positionConfigs[i];
      if (!c.positionId) return `Укажите должность #${i + 1}`;
      if (!c.fullShiftStart || !c.fullShiftEnd) return `Укажите полную смену для должности #${i + 1}`;
      if ((c.shiftOptions ?? []).length === 0) return `Добавьте хотя бы одну смену для должности #${i + 1}`;
      for (const o of c.shiftOptions) {
        if (!o.startTime || !o.endTime) return `Заполните время смены для должности #${i + 1}`;
      }
    }
    return null;
  };
  const submit = () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    onSubmit(
      {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        positionConfigs: positionConfigs.map((c, i) => ({
          positionId: Number(c.positionId),
          fullShiftStart: c.fullShiftStart,
          fullShiftEnd: c.fullShiftEnd,
          targetPattern: c.targetPattern,
          minRestHours: Number(c.minRestHours) || 0,
          maxShiftsPerPeriod: Number(c.maxShiftsPerPeriod) || 0,
          sortOrder: i,
          shiftOptions: c.shiftOptions.map((o, oi) => ({
            startTime: o.startTime,
            endTime: o.endTime,
            label: o.label?.trim() ? o.label.trim() : null,
            isFullShift: o.isFullShift,
            sortOrder: oi,
          })),
          coverageRules: c.coverageRules.map((r, ri) => ({
            dayOfWeek: Number(r.dayOfWeek),
            startTime: r.startTime,
            endTime: r.endTime,
            requiredCount: Number(r.requiredCount) || 0,
            sortOrder: ri,
          })),
        })),
      },
      template?.id,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? "Редактировать шаблон" : "Создать шаблон"}
      description="MVP настройки сборки графика"
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        {positionConfigs.map((config, idx) => (
          <div key={idx} className="border-subtle space-y-3 rounded-2xl border p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Должность #{idx + 1}</h4>
              <Button variant="outline" onClick={() => setPositionConfigs((prev) => prev.filter((_, i) => i !== idx))}>
                Удалить
              </Button>
            </div>
            <DropdownSelect
              value={String(config.positionId)}
              onChange={(e) =>
                setPositionConfigs((prev) =>
                  prev.map((p, i) =>
                    i === idx ? { ...p, positionId: e.target.value ? Number(e.target.value) : "" } : p,
                  ),
                )
              }
            >
              <option value="">Выберите должность</option>
              {positions
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </DropdownSelect>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Полная смена с"
                type="time"
                value={config.fullShiftStart}
                onChange={(e) =>
                  setPositionConfigs((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, fullShiftStart: e.target.value } : p)),
                  )
                }
              />
              <Input
                label="по"
                type="time"
                value={config.fullShiftEnd}
                onChange={(e) =>
                  setPositionConfigs((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, fullShiftEnd: e.target.value } : p)),
                  )
                }
              />
            </div>
            <DropdownSelect
              value={config.targetPattern}
              onChange={(e) =>
                setPositionConfigs((prev) =>
                  prev.map((p, i) =>
                    i === idx ? { ...p, targetPattern: e.target.value as ScheduleBuildTargetPattern } : p,
                  ),
                )
              }
            >
              {patterns.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </DropdownSelect>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Мин. отдых (ч)"
                type="number"
                value={String(config.minRestHours)}
                onChange={(e) =>
                  setPositionConfigs((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, minRestHours: Number(e.target.value) } : p)),
                  )
                }
              />
              <Input
                label="Макс. смен"
                type="number"
                value={String(config.maxShiftsPerPeriod)}
                onChange={(e) =>
                  setPositionConfigs((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, maxShiftsPerPeriod: Number(e.target.value) } : p)),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Варианты смен</div>
              {config.shiftOptions.map((opt, oi) => (
                <div key={oi} className="border-subtle grid grid-cols-2 gap-2 rounded-xl border p-2">
                  <Input
                    type="time"
                    label="С"
                    value={opt.startTime}
                    onChange={(e) =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                shiftOptions: p.shiftOptions.map((x, j) =>
                                  j === oi ? { ...x, startTime: e.target.value } : x,
                                ),
                              }
                            : p,
                        ),
                      )
                    }
                  />
                  <Input
                    type="time"
                    label="По"
                    value={opt.endTime}
                    onChange={(e) =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                shiftOptions: p.shiftOptions.map((x, j) =>
                                  j === oi ? { ...x, endTime: e.target.value } : x,
                                ),
                              }
                            : p,
                        ),
                      )
                    }
                  />
                  <Input
                    label="Название"
                    value={opt.label}
                    onChange={(e) =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                shiftOptions: p.shiftOptions.map((x, j) =>
                                  j === oi ? { ...x, label: e.target.value } : x,
                                ),
                              }
                            : p,
                        ),
                      )
                    }
                  />
                  <label className="mt-8 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={opt.isFullShift}
                      onChange={(e) =>
                        setPositionConfigs((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? {
                                  ...p,
                                  shiftOptions: p.shiftOptions.map((x, j) =>
                                    j === oi ? { ...x, isFullShift: e.target.checked } : x,
                                  ),
                                }
                              : p,
                          ),
                        )
                      }
                    />
                    Полная смена
                  </label>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, shiftOptions: p.shiftOptions.filter((_, j) => j !== oi) } : p,
                        ),
                      )
                    }
                  >
                    Удалить смену
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setPositionConfigs((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, shiftOptions: [...p.shiftOptions, createOption()] } : p)),
                  )
                }
              >
                Добавить смену
              </Button>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Правила покрытия</div>
              {config.coverageRules.map((rule, ri) => (
                <div key={ri} className="border-subtle grid grid-cols-2 gap-2 rounded-xl border p-2">
                  <DropdownSelect
                    value={String(rule.dayOfWeek)}
                    onChange={(e) =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                coverageRules: p.coverageRules.map((x, j) =>
                                  j === ri ? { ...x, dayOfWeek: Number(e.target.value) } : x,
                                ),
                              }
                            : p,
                        ),
                      )
                    }
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </DropdownSelect>
                  <Input
                    label="Требуется"
                    type="number"
                    value={String(rule.requiredCount)}
                    onChange={(e) =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                coverageRules: p.coverageRules.map((x, j) =>
                                  j === ri ? { ...x, requiredCount: Number(e.target.value) } : x,
                                ),
                              }
                            : p,
                        ),
                      )
                    }
                  />
                  <Input
                    label="С"
                    type="time"
                    value={rule.startTime}
                    onChange={(e) =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                coverageRules: p.coverageRules.map((x, j) =>
                                  j === ri ? { ...x, startTime: e.target.value } : x,
                                ),
                              }
                            : p,
                        ),
                      )
                    }
                  />
                  <Input
                    label="По"
                    type="time"
                    value={rule.endTime}
                    onChange={(e) =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                coverageRules: p.coverageRules.map((x, j) =>
                                  j === ri ? { ...x, endTime: e.target.value } : x,
                                ),
                              }
                            : p,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      setPositionConfigs((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, coverageRules: p.coverageRules.filter((_, j) => j !== ri) } : p,
                        ),
                      )
                    }
                  >
                    Удалить правило
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setPositionConfigs((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, coverageRules: [...p.coverageRules, createRule()] } : p)),
                  )
                }
              >
                Добавить правило
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => setPositionConfigs((prev) => [...prev, createPosition()])}>
          Добавить должность
        </Button>
        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
    </Modal>
  );
};

export default ScheduleBuildTemplateDialog;
