export function getErrorMessage(error: any, defaultMessage: string): string {
  const resp = error?.response;

  // Специальный кейс: nginx 413 (слишком большой файл)
  if (resp?.status === 413) {
    return "Файл слишком большой. Максимальный размер — 20 МБ.";
  }

  const data = resp?.data;

  if (data) {
    // Если backend вернул JSON-объект
    if (typeof data === "object") {
      if (typeof data.message === "string" && data.message.trim().length > 0) {
        return data.message;
      }
      if (typeof data.error === "string" && data.error.trim().length > 0) {
        return data.error;
      }
      if (typeof data.errorMessage === "string" && data.errorMessage.trim().length > 0) {
        return data.errorMessage;
      }
    }

    // Если сервер вернул строку (например, текстом)
    if (typeof data === "string" && data.trim().length > 0) {
      return data;
    }
  }

  // Фолбэк: сообщение axios или дефолтное
  if (typeof error?.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  return defaultMessage;
}
