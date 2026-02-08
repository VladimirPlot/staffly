import React from "react";
import type {
  GridNavigationCell,
  GridNavigationHandlers,
  GridNavigationOptions,
} from "./gridNavigationTypes";
import { focusElement, isArrowKey, isEditableElement, shouldHandleHorizontalArrow } from "./utils";

const DEFAULT_GET_CELL_ID = (rowIndex: number, colIndex: number) => `${rowIndex}:${colIndex}`;

type Direction = { rowDelta: number; colDelta: number };

const directionByKey: Record<string, Direction> = {
  ArrowLeft: { rowDelta: 0, colDelta: -1 },
  ArrowRight: { rowDelta: 0, colDelta: 1 },
  ArrowUp: { rowDelta: -1, colDelta: 0 },
  ArrowDown: { rowDelta: 1, colDelta: 0 },
};

function getCellId<Row, Col>(
  row: Row,
  col: Col,
  rowIndex: number,
  colIndex: number,
  getCellIdFn?: (row: Row, col: Col, rowIndex: number, colIndex: number) => string
) {
  if (getCellIdFn) {
    return getCellIdFn(row, col, rowIndex, colIndex);
  }
  return DEFAULT_GET_CELL_ID(rowIndex, colIndex);
}

export function useGridNavigation<Row, Col>(
  options: GridNavigationOptions<Row, Col>
): GridNavigationHandlers {
  const { rows, cols, getCellId: getCellIdFn, isCellEditable, wrapTab, onFocusCell } = options;
  const rowCount = rows.length;
  const colCount = cols.length;
  const refs = React.useRef<Map<string, HTMLElement>>(new Map());

  const registerCellRef = React.useCallback(
    (cellId: string) => (el: HTMLElement | null) => {
      if (!el) {
        refs.current.delete(cellId);
        return;
      }
      refs.current.set(cellId, el);
    },
    []
  );

  const focusCellById = React.useCallback((cellId: string) => {
    const element = refs.current.get(cellId);
    if (element) {
      focusElement(element);
    }
  }, []);

  const focusCell = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      if (rowIndex < 0 || colIndex < 0) return;
      if (rowIndex >= rowCount || colIndex >= colCount) return;
      const cellId = getCellId(rows[rowIndex], cols[colIndex], rowIndex, colIndex, getCellIdFn);
      focusCellById(cellId);
    },
    [cols, colCount, focusCellById, getCellIdFn, rowCount, rows]
  );

  const tryFocusCell = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      if (rowIndex < 0 || colIndex < 0) return false;
      if (rowIndex >= rowCount || colIndex >= colCount) return false;
      const row = rows[rowIndex];
      const col = cols[colIndex];
      const cellId = getCellId(row, col, rowIndex, colIndex, getCellIdFn);
      const element = refs.current.get(cellId);
      if (!element || !isEditableElement(element)) return false;
      const isEditable = isCellEditable ? isCellEditable({ row, col, rowIndex, colIndex, cellId }) : true;
      if (!isEditable) return false;
      focusElement(element);
      onFocusCell?.({ row, col, rowIndex, colIndex, cellId });
      return true;
    },
    [cols, colCount, getCellIdFn, isCellEditable, onFocusCell, rowCount, rows]
  );

  const moveFocus = React.useCallback(
    (cell: GridNavigationCell, direction: Direction, shouldWrap: boolean) => {
      let nextRow = cell.rowIndex + direction.rowDelta;
      let nextCol = cell.colIndex + direction.colDelta;

      while (nextRow >= 0 && nextRow < rowCount && nextCol >= 0 && nextCol < colCount) {
        if (tryFocusCell(nextRow, nextCol)) return true;
        nextRow += direction.rowDelta;
        nextCol += direction.colDelta;
      }

      if (!shouldWrap || direction.rowDelta !== 0) return false;

      const wrappedRow = cell.rowIndex + (direction.colDelta > 0 ? 1 : -1);
      if (wrappedRow < 0 || wrappedRow >= rowCount) return false;
      const wrappedCol = direction.colDelta > 0 ? 0 : colCount - 1;

      let wrapRow = wrappedRow;
      let wrapCol = wrappedCol;

      while (wrapRow >= 0 && wrapRow < rowCount && wrapCol >= 0 && wrapCol < colCount) {
        if (tryFocusCell(wrapRow, wrapCol)) return true;
        wrapCol += direction.colDelta;
        if (wrapCol < 0 || wrapCol >= colCount) {
          wrapRow += direction.colDelta > 0 ? 1 : -1;
          wrapCol = direction.colDelta > 0 ? 0 : colCount - 1;
        }
      }

      return false;
    },
    [colCount, rowCount, tryFocusCell]
  );

  const onCellKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>, cell: GridNavigationCell) => {
      const { key } = event;

      if (key === "Tab") {
        const direction = event.shiftKey ? { rowDelta: 0, colDelta: -1 } : { rowDelta: 0, colDelta: 1 };
        const moved = moveFocus(cell, direction, Boolean(wrapTab));
        if (wrapTab || moved) {
          // Preserve native tabbing when we hit the grid boundary.
          event.preventDefault();
        }
        return;
      }

      if (key === "Enter") {
        event.preventDefault();
        const direction = event.shiftKey ? { rowDelta: -1, colDelta: 0 } : { rowDelta: 1, colDelta: 0 };
        moveFocus(cell, direction, false);
        return;
      }

      if (!isArrowKey(key)) return;

      if (key === "ArrowLeft" || key === "ArrowRight") {
        const shouldNavigate = shouldHandleHorizontalArrow({
          key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          currentTarget: event.currentTarget,
        });
        if (!shouldNavigate) return;
      }

      event.preventDefault();
      const direction = directionByKey[key];
      moveFocus(cell, direction, false);
    },
    [moveFocus, wrapTab]
  );

  return { registerCellRef, onCellKeyDown, focusCellById, focusCell };
}
