import type { ChecklistDto } from "../api";

export function createChecklistExportNode(checklist: ChecklistDto): HTMLDivElement {
  const node = document.createElement("div");
  Object.assign(node.style, {
    width: "900px",
    padding: "36px",
    boxSizing: "border-box",
    background: "#fff",
    color: "#111827",
    fontFamily: "Arial, sans-serif",
    fontSize: "18px",
    lineHeight: "1.5",
    overflowWrap: "anywhere",
  });
  const text = (parent: HTMLElement, tag: string, value: string) => {
    const element = document.createElement(tag);
    element.textContent = value;
    element.style.whiteSpace = "pre-wrap";
    parent.append(element);
    return element;
  };
  text(node, "h1", checklist.name);
  if (checklist.periodLabel) text(node, "p", checklist.periodLabel);
  if (checklist.positions.length) text(node, "p", checklist.positions.map((position) => position.name).join(", "));
  if (checklist.content) text(node, "p", checklist.content);
  checklist.items.forEach((item, index) => {
    const section = document.createElement("div");
    Object.assign(section.style, { borderTop: "1px solid #d1d5db", padding: "20px 0" });
    text(section, "p", `${index + 1}. ${item.text}`);
    text(
      section,
      "p",
      item.done
        ? `Выполнено${item.doneBy?.name ? ` · ${item.doneBy.name}` : ""}`
        : item.reservedBy
          ? `В работе · ${item.reservedBy.name}`
          : "Не выполнено",
    );
    const photos: Array<[string, string | null | undefined]> = [
      ["Эталон", item.examplePhotoUrl],
      ["Фото выполнения", item.completionPhotoUrl],
    ];
    for (const [label, url] of photos) {
      if (!url) continue;
      text(section, "p", label);
      const image = document.createElement("img");
      image.crossOrigin = "anonymous";
      image.src = url;
      image.alt = label;
      Object.assign(image.style, { display: "block", maxWidth: "100%", maxHeight: "350px", objectFit: "contain" });
      section.append(image);
    }
    node.append(section);
  });
  return node;
}
