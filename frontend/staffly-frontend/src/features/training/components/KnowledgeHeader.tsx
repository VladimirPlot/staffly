import { useRef } from "react";
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
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  if (!canManage) return null;

  return (
    <div className="border-subtle bg-surface space-y-3 rounded-2xl border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Switch
          label="Скрытые элементы"
          checked={includeInactive}
          onChange={(e) => onToggleIncludeInactive(e.target.checked)}
        />

        <DropdownMenu
          trigger={(triggerProps) => (
            <Button variant="outline" {...triggerProps}>
              Фильтр по должности: {positions.find((p) => p.id === positionFilter)?.name ?? "Все должности"}
            </Button>
          )}
          menuClassName="w-72"
        >
          {({ close }) => (
            <>
              <button
                type="button"
                role="menuitem"
                className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                onClick={() => {
                  onChangePositionFilter(null);
                  close();
                }}
              >
                Все должности
              </button>

              {positions.map((position) => (
                <button
                  key={position.id}
                  type="button"
                  role="menuitem"
                  className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                  onClick={() => {
                    onChangePositionFilter(position.id);
                    close();
                  }}
                >
                  {position.name}
                </button>
              ))}
            </>
          )}
        </DropdownMenu>

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

        <div ref={createMenuRef} className="sm:hidden">
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
