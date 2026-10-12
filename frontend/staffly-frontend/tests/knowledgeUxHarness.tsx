// Isolated fixture: real knowledge page; no API, authentication or S3 writes.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import apiClient from "../src/shared/api/apiClient";
import { AuthContext } from "../src/shared/providers/AuthProvider";
import KnowledgePageBase from "../src/features/training/pages/KnowledgePageBase";
import { prepareKnowledgeImages } from "../src/features/training/utils/knowledgeImages";
import "../src/index.css";

const photo = `${location.origin}/tests/knowledge-photo.svg`;
const folders = [
  {
    id: 1,
    restaurantId: 1,
    parentId: null,
    name: "Меню",
    type: "KNOWLEDGE",
    active: true,
    sortOrder: 0,
    visibilityPositionIds: [],
    manageable: true,
  },
  {
    id: 2,
    restaurantId: 1,
    parentId: 1,
    name: "Напитки",
    type: "KNOWLEDGE",
    active: true,
    sortOrder: 0,
    visibilityPositionIds: [],
    manageable: true,
  },
];
const items = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  restaurantId: 1,
  folderId: 1,
  title: `Учебный материал ${i + 1}`,
  description: "Большой материал для изучения.\n".repeat(22),
  composition: "Пример состава",
  allergens: "Молоко",
  imageUrl: photo,
  originalImageUrl: i === 5 ? null : photo,
  active: true,
  sortOrder: i,
}));
apiClient.defaults.adapter = async (config) => {
  const url = config.url ?? "";
  let data: unknown = [];
  if (url.endsWith("/folders")) data = folders;
  if (url.endsWith("/knowledge-items")) data = items;
  if (url.endsWith("/knowledge-exams"))
    data = [
      {
        id: 1,
        restaurantId: 1,
        folderId: 1,
        title: "Самопроверка",
        mode: "PRACTICE",
        status: "PUBLISHED",
        active: true,
        questionCount: 2,
        passPercent: 70,
        version: 1,
        sortOrder: 0,
      },
    ];
  return { data, status: 200, statusText: "OK", headers: {}, config };
};

function Harness() {
  const [manager, setManager] = useState(true);
  const [report, setReport] = useState("");
  async function compress() {
    setReport("Подготовка фото…");
    // High entropy input exercises the byte budget, not just a tiny flat illustration.
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const ctx = canvas.getContext("2d")!;
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    let seed = 1;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      pixels.data[i] = seed & 255;
      pixels.data[i + 1] = (seed >>> 8) & 255;
      pixels.data[i + 2] = (seed >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const input = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 1));
    const source = URL.createObjectURL(input);
    try {
      const { file, originalFile, previewUrl } = await prepareKnowledgeImages({
        imageSrc: source,
        crop: { x: 0, y: 250, width: 4000, height: 2500 },
        mimeType: "image/webp",
      });
      const full = new Image();
      const fullUrl = URL.createObjectURL(originalFile);
      full.src = fullUrl;
      await full.decode();
      setReport(
        `Вход: ${input.size} байт; полное: ${originalFile.size} байт, ${full.naturalWidth}×${full.naturalHeight}; превью: ${file.size} байт. ${originalFile.size <= 1048576 && file.size <= 262144 && full.naturalWidth <= 2048 ? "PASS" : "FAIL"}`,
      );
      URL.revokeObjectURL(fullUrl);
      URL.revokeObjectURL(previewUrl);
    } catch (error) {
      setReport(String(error));
    } finally {
      URL.revokeObjectURL(source);
    }
  }
  return (
    <AuthContext.Provider
      value={{
        token: null,
        user: { id: 1, phone: "", name: "Тест", restaurantId: 1, roles: manager ? ["CREATOR"] : [] },
        loading: false,
        loginWithToken: async () => {},
        logout: () => {},
        refreshMe: async () => {},
      }}
    >
      <div className="bg-app text-default min-h-screen p-4">
        <div className="mx-auto mb-6 max-w-5xl space-y-2">
          <button onClick={() => setManager(!manager)} className="border p-2">
            Роль: {manager ? "руководитель" : "сотрудник"}
          </button>
          <button onClick={() => void compress()} className="ml-3 border p-2">
            Проверить сжатие большого фото
          </button>
          <p role="status">{report}</p>
        </div>
        <KnowledgePageBase currentFolderId={1} />
      </div>
    </AuthContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Harness />
  </BrowserRouter>,
);
