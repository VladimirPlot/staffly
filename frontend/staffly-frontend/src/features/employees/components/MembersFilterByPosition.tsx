import Button from "../../../shared/ui/Button";

type Option = { key: string; label: string };

type MembersFilterByPositionProps = {
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  onReset: () => void;
};

export default function MembersFilterByPosition({ options, value, onChange, onReset }: MembersFilterByPositionProps) {
  if (options.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2 text-default">
        <span>Фильтр по должности:</span>
        <select
          className="rounded-2xl border border-subtle bg-surface px-3 py-2 text-base text-default outline-none transition focus:ring-2 ring-default"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Все должности</option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {value && (
        <Button variant="ghost" className="text-sm" onClick={onReset}>
          Сбросить фильтр
        </Button>
      )}
    </div>
  );
}
