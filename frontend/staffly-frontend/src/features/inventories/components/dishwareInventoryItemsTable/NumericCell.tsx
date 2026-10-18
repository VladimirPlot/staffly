import type { KeyboardEvent } from "react";

import { numericCellInputClassName } from "./tableConstants";

type NumericCellProps = {
  value: number | string | null;
  disabled: boolean;
  inputMode: "numeric" | "decimal";
  placeholder?: string;
  cellId: string;
  rowIndex: number;
  colIndex: number;
  registerCellRef: (cellId: string) => (el: HTMLElement | null) => void;
  onCellKeyDown: (
    event: KeyboardEvent<HTMLElement>,
    cell: { rowIndex: number; colIndex: number; cellId: string },
  ) => void;
  parseValue: (value: string) => number | null;
  onCommit: (value: string) => void;
};

export default function NumericCell({
  value,
  disabled,
  inputMode,
  placeholder,
  cellId,
  rowIndex,
  colIndex,
  registerCellRef,
  onCellKeyDown,
  parseValue,
  onCommit,
}: NumericCellProps) {
  const text = String(value ?? "");
  let error: string | null = null;
  try {
    parseValue(text);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div>
      <input
        className={numericCellInputClassName}
        type="text"
        inputMode={inputMode}
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        ref={registerCellRef(cellId)}
        aria-label={`${colIndex === 4 ? "Цена" : ["", "Было", "Приход", "Стало"][colIndex]}, позиция ${rowIndex + 1}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${cellId}-error` : undefined}
        onKeyDown={(event) => onCellKeyDown(event, { rowIndex, colIndex, cellId })}
        onChange={(event) => onCommit(event.target.value)}
      />
      {error ? (
        <p id={`${cellId}-error`} className="px-2 pb-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
