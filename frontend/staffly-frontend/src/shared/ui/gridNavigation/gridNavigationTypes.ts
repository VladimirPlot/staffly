import type React from "react";

export type GridNavigationCell = {
  rowIndex: number;
  colIndex: number;
  cellId: string;
};

export type GridNavigationCellContext<Row, Col> = GridNavigationCell & {
  row: Row;
  col: Col;
};

export type GridNavigationOptions<Row, Col> = {
  rows: Row[];
  cols: Col[];
  getCellId?: (row: Row, col: Col, rowIndex: number, colIndex: number) => string;
  isCellEditable?: (cell: GridNavigationCellContext<Row, Col>) => boolean;
  wrapTab?: boolean;
  onFocusCell?: (cell: GridNavigationCellContext<Row, Col>) => void;
};

export type GridNavigationHandlers = {
  registerCellRef: (cellId: string) => (el: HTMLElement | null) => void;
  onCellKeyDown: (
    event: React.KeyboardEvent<HTMLElement>,
    cell: GridNavigationCell
  ) => void;
  focusCellById: (cellId: string) => void;
  focusCell: (rowIndex: number, colIndex: number) => void;
};
