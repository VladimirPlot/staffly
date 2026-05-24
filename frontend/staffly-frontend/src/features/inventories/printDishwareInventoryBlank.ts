const printWindowFeatures = "popup=yes,width=1120,height=780";

export function openDishwareInventoryPrintWindow(): Window {
  const printWindow = window.open("", "_blank", printWindowFeatures);
  if (!printWindow) {
    throw new Error("Браузер заблокировал окно печати");
  }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8" /><title>Печать</title></head><body>Готовим бланк...</body></html>`);
  printWindow.document.close();
  return printWindow;
}

export function printDishwareInventoryBlank(printWindow: Window, html: string): void {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}
