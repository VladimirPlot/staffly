import type { PositionDto } from "../../dictionaries/api";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Switch from "../../../shared/ui/Switch";

type Props = {
  canManage: boolean;
  includeInactive: boolean;
  onToggleIncludeInactive: (v: boolean) => void;
  positions: PositionDto[];
  positionFilter: number | null;
  onChangePositionFilter: (id: number | null) => void;
  onCreateFolder: () => void;
  onCreateCard: () => void;
  onCreateTest: () => void;
};

export default function KnowledgeHeader({
  canManage,
  includeInactive,
  onToggleIncludeInactive,
  positions,
  positionFilter,
  onChangePositionFilter,
  onCreateFolder,
  onCreateCard,
  onCreateTest,
}: Props) {
  if (!canManage) return null;

  const selectValue = positionFilter == null ? "all" : String(positionFilter);

  return (
    <div className="border-subtle bg-surface space-y-3 rounded-2xl border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Switch
          label="Скрытые элементы"
          checked={includeInactive}
          onChange={(e) => onToggleIncludeInactive(e.target.checked)}
        />

        {/* Desktop: компактный select */}
        <div className="hidden sm:block">
          <label className="flex items-center gap-2">
            <span className="text-sm text-muted">Должность</span>
            <select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                onChangePositionFilter(v === "all" ? null : Number(v));
              }}
              className={
                "h-10 rounded-2xl border border-subtle bg-surface px-3 text-sm text-default shadow-[var(--staffly-shadow)] " +
                "transition hover:bg-app focus:outline-none focus:ring-2 ring-default"
              }
            >
              <option value="all">Все должности</option>
              {positions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Mobile: тоже select (во всю ширину, аккуратный) */}
        <div className="sm:hidden">
          <label className="block">
            <div className="mb-1 text-sm text-muted">Должность</div>
            <select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                onChangePositionFilter(v === "all" ? null : Number(v));
              }}
              className={
                "h-10 w-full rounded-2xl border border-subtle bg-surface px-3 text-sm text-default shadow-[var(--staffly-shadow)] " +
                "transition hover:bg-app focus:outline-none focus:ring-2 ring-default"
              }
            >
              <option value="all">Все должности</option>
              {positions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="hidden flex-wrap gap-2 sm:flex">
          <Button variant="outline" onClick={onCreateFolder}>
            Создать папку
          </Button>
          <Button variant="outline" onClick={onCreateCard}>
            Создать карточку
          </Button>
          <Button variant="outline" onClick={onCreateTest}>
            Создать тест
          </Button>
        </div>

        <div className="sm:hidden">
          <DropdownMenu trigger={(triggerProps) => <Button variant="outline" {...triggerProps}>Создать</Button>}>
            {({ close }) => (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => {
                    close();
                    onCreateFolder();
                  }}
                >
                  Создать папку
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => {
                    close();
                    onCreateCard();
                  }}
                >
                  Создать карточку
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => {
                    close();
                    onCreateTest();
                  }}
                >
                  Создать тест
                </Button>
              </div>
            )}
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
