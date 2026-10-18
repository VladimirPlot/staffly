export type DishwarePendingPhoto = { token: string; name: string; type: string; size: number };
export const DISHWARE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const types = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function validateDishwarePhoto(file: File): Promise<void> {
  if (!types.has(file.type)) throw new Error("Выберите фото JPEG, PNG или WebP");
  if (file.size > DISHWARE_PHOTO_MAX_BYTES) throw new Error("Фото не должно превышать 2 МБ");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp =
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80;
  if (bytes.length < 12 || !(jpeg || png || webp))
    throw new Error("Файл не является корректным фото JPEG, PNG или WebP");
}

function openPhotoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    try {
      const request = indexedDB.open("staffly-dishware-photos", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("photos");
      request.onsuccess = () => {
        if (blocked) request.result.close();
        else resolve(request.result);
      };
      request.onerror = () => reject(new Error("Не удалось открыть локальное хранилище фото"));
      request.onblocked = () => {
        blocked = true;
        reject(new Error("Локальное хранилище фото занято. Закройте другие вкладки и повторите попытку."));
      };
    } catch {
      reject(new Error("Не удалось открыть локальное хранилище фото. Проверьте настройки браузера."));
    }
  });
}

async function photoTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openPhotoDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction("photos", mode);
      const request = action(tx.objectStore("photos"));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () =>
        reject(new Error("Не удалось сохранить фото на устройстве. Освободите место и повторите попытку."));
    });
  } finally {
    database.close();
  }
}

export async function storeDishwarePhoto(scope: string, file: File): Promise<DishwarePendingPhoto> {
  await validateDishwarePhoto(file);
  const token = `${scope}:${crypto.randomUUID()}`;
  await photoTransaction("readwrite", (store) => store.put(file, token));
  return { token, name: file.name, type: file.type, size: file.size };
}

export async function readDishwarePhoto(photo: DishwarePendingPhoto): Promise<File> {
  const blob = await photoTransaction<Blob | undefined>("readonly", (store) => store.get(photo.token));
  if (!(blob instanceof Blob))
    throw new Error("Фото не найдено на устройстве. Выберите файл повторно или удалите его из позиции.");
  return new File([blob], photo.name, { type: photo.type });
}

export async function deleteDishwarePhoto(token: string): Promise<void> {
  await photoTransaction("readwrite", (store) => store.delete(token));
}

export function isDishwarePendingPhoto(value: unknown): value is DishwarePendingPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as DishwarePendingPhoto;
  return (
    typeof photo.token === "string" &&
    typeof photo.name === "string" &&
    types.has(photo.type) &&
    Number.isSafeInteger(photo.size) &&
    photo.size > 0 &&
    photo.size <= DISHWARE_PHOTO_MAX_BYTES
  );
}
