import { Trash2 } from "lucide-react";

import type { PositionDto } from "../../dictionaries/api";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Icon from "../../../shared/ui/Icon";

type Props = {
  canManage: boolean;
  onOpenArchive: () => void;
  positions: PositionDto[];
  positionFilter: number | null;
  onChangePositionFilter: (id: number | null) => void;
  onCreateFolder: () => void;
  onCreateCard: () => void;
  onCreateTest: () => void;
};

export default function KnowledgeHeader({
  canManage,
  onOpenArchive,
  positions,
  positionFilter,
  onChangePositionFilter,
  onCreateFolder,
  onCreateCard,
  onCreateTest,
}: Props) {
  if (!canManage) return null;

  const selectValue = positionFilter == null ? "all" : String(positionFilter);

  const handleSelectChange = (value: string) => {
    onChangePositionFilter(value === "all" ? null : Number(value));
  };

  return (
    <div className="border-subtle bg-surface rounded-2xl border p-2 sm:p-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <DropdownMenu
            trigger={(triggerProps) => (
              <Button variant="outline" {...triggerProps}>
                Создать
              </Button>
            )}
          >
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

          <Button
            variant="outline"
            size="icon"
            className="text-muted hover:text-red-600"
            title="Корзина"
            aria-label="Открыть корзину базы знаний"
            leftIcon={<Icon icon={Trash2} size="sm" decorative />}
            onClick={onOpenArchive}
          />
        </div>

        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Должность</span>
            <DropdownSelect
              aria-label="Должность"
              value={selectValue}
              onChange={(e) => handleSelectChange(e.target.value)}
              className={
                "h-9 rounded-2xl px-3 text-sm shadow-[var(--staffly-shadow)] " +
                "transition hover:bg-app focus:outline-none focus:ring-2 ring-default"
              }
            >
              <option value="all">Все должности</option>
              {positions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </DropdownSelect>
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Button variant="outline" className="h-9" onClick={onCreateFolder}>
            Создать папку
          </Button>
          <Button variant="outline" className="h-9" onClick={onCreateCard}>
            Создать карточку
          </Button>
          <Button variant="outline" className="h-9" onClick={onCreateTest}>
            Создать тест
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="ml-1 h-9 w-9 text-muted hover:text-red-600"
            title="Корзина"
            aria-label="Открыть корзину базы знаний"
            leftIcon={<Icon icon={Trash2} size="sm" decorative />}
            onClick={onOpenArchive}
          />
        </div>
      </div>

      <div className="sm:hidden">
        <div className="block">
          <div className="mb-1 text-sm text-muted">Должность</div>
          <DropdownSelect
            aria-label="Должность"
            value={selectValue}
            onChange={(e) => handleSelectChange(e.target.value)}
            className={
              "h-10 w-full rounded-2xl px-3 text-sm shadow-[var(--staffly-shadow)] " +
              "transition hover:bg-app focus:outline-none focus:ring-2 ring-default"
            }
          >
            <option value="all">Все должности</option>
            {positions.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </DropdownSelect>
        </div>
      </div>
    </div>
  );
}
