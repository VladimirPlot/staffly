import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

import { numericCellInputClassName } from "./tableConstants";

type NumericCellProps<TValue extends number | null> = {
  value: TValue;
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
  formatValue: (value: TValue) => string;
  parseValue: (value: string) => TValue;
  onCommit: (value: TValue) => void;
};

export default function NumericCell<TValue extends number | null>({
  value,
  disabled,
  inputMode,
  placeholder,
  cellId,
  rowIndex,
  colIndex,
  registerCellRef,
  onCellKeyDown,
  formatValue,
  parseValue,
  onCommit,
}: NumericCellProps<TValue>) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(() => formatValue(value));

  useEffect(() => {
    if (!focused) {
      setLocalValue(formatValue(value));
    }
  }, [focused, formatValue, value]);

  const commitValue = () => {
    const parsed = parseValue(localValue);
    setFocused(false);
    setLocalValue(formatValue(parsed));
    onCommit(parsed);
  };

  return (
    <input
      className={numericCellInputClassName}
      type="text"
      inputMode={inputMode}
      value={localValue}
      disabled={disabled}
      placeholder={placeholder}
      ref={registerCellRef(cellId)}
      onFocus={() => setFocused(true)}
      onBlur={commitValue}
      onKeyDown={(event) => onCellKeyDown(event, { rowIndex, colIndex, cellId })}
      onChange={(event) => setLocalValue(event.target.value)}
    />
  );
}
