import React from "react";
import { Navigate } from "react-router-dom";

import BackToHome from "../../../shared/ui/BackToHome";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import SelectField from "../../../shared/ui/SelectField";
import Modal from "../../../shared/ui/Modal";
import ContentText from "../../../shared/ui/ContentText";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import { getErrorMessage } from "../../../shared/utils/errors";
import {
  createAnonymousLetter,
  getAnonymousLetter,
  listAnonymousLetters,
  type AnonymousLetterDto,
  type AnonymousLetterRequest,
  type AnonymousLetterSummaryDto,
} from "../api";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

const MAX_SUBJECT_LENGTH = 50;

type FormState = {
  subject: string;
  content: string;
  recipientMemberId: number | null;
};

export default function AnonymousLettersPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);
  const [loadingRole, setLoadingRole] = React.useState(true);

  const [letters, setLetters] = React.useState<AnonymousLetterSummaryDto[]>([]);
  const [lettersError, setLettersError] = React.useState<string | null>(null);
  const [lettersLoading, setLettersLoading] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [details, setDetails] = React.useState<Record<number, AnonymousLetterDto>>({});
  const [loadingDetailsId, setLoadingDetailsId] = React.useState<number | null>(null);

  const [recipients, setRecipients] = React.useState<MemberDto[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formState, setFormState] = React.useState<FormState>({
    subject: "",
    content: "",
    recipientMemberId: null,
  });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setMyRole(null);
      setLoadingRole(false);
      return () => {
        alive = false;
      };
    }

    setLoadingRole(true);
    (async () => {
      try {
        const role = await fetchMyRoleIn(restaurantId);
        if (!alive) return;
        setMyRole(role);
        setLoadingRole(false);
      } catch {
        if (!alive) return;
        setMyRole(null);
        setLoadingRole(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const access = React.useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole],
  );

  const isAdmin = access.normalizedRestaurantRole === "ADMIN";
  const canCreate = access.normalizedRestaurantRole === "STAFF" || access.normalizedRestaurantRole === "MANAGER";

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setLetters([]);
      setLettersError(null);
      return () => {
        alive = false;
      };
    }

    setLettersLoading(true);
    setLettersError(null);
    (async () => {
      try {
        const list = await listAnonymousLetters(restaurantId);
        if (!alive) return;
        setLetters(list);
        setLettersLoading(false);
      } catch (error: any) {
        if (!alive) return;
        setLetters([]);
        setLettersError(error?.friendlyMessage || getErrorMessage(error, "Не удалось загрузить письма"));
        setLettersLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId || !canCreate) {
      setRecipients([]);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const members = await listMembers(restaurantId);
        if (!alive) return;
        setRecipients(members.filter((m) => m.role === "ADMIN"));
      } catch {
        if (!alive) return;
        setRecipients([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId, canCreate]);

  const handleToggle = React.useCallback(
    async (letterId: number) => {
      if (!restaurantId) return;
      if (expandedId === letterId) {
        setExpandedId(null);
        return;
      }

      if (details[letterId]) {
        setExpandedId(letterId);
        return;
      }

      setLoadingDetailsId(letterId);
      try {
        const detail = await getAnonymousLetter(restaurantId, letterId);
        setDetails((prev) => ({ ...prev, [letterId]: detail }));
        setLetters((prev) =>
          prev.map((item) =>
            item.id === letterId ? { ...item, readAt: detail.readAt ?? item.readAt } : item,
          ),
        );
        setExpandedId(letterId);
      } catch (error: any) {
        setLettersError(error?.friendlyMessage || getErrorMessage(error, "Не удалось открыть письмо"));
      } finally {
        setLoadingDetailsId(null);
      }
    },
    [restaurantId, expandedId, details],
  );

  const resetForm = React.useCallback(() => {
    setFormState({ subject: "", content: "", recipientMemberId: null });
    setFormError(null);
  }, []);

  const handleSubmit = React.useCallback(async () => {
    if (!restaurantId) return;
    const subject = formState.subject.trim();
    const content = formState.content.trim();
    const recipientId = formState.recipientMemberId;

    if (!subject) {
      setFormError("Введите тему письма");
      return;
    }
    if (subject.length > MAX_SUBJECT_LENGTH) {
      setFormError(`Тема должна быть не длиннее ${MAX_SUBJECT_LENGTH} символов`);
      return;
    }
    if (!recipientId) {
      setFormError("Выберите получателя");
      return;
    }
    if (!content) {
      setFormError("Напишите письмо");
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createAnonymousLetter(restaurantId, {
        subject,
        content,
        recipientMemberId: recipientId,
      } satisfies AnonymousLetterRequest);
      setLetters((prev) => [{ ...created }, ...prev]);
      setDetails((prev) => ({ ...prev, [created.id]: created }));
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      setFormError(error?.friendlyMessage || getErrorMessage(error, "Не удалось отправить письмо"));
    } finally {
      setSubmitting(false);
    }
  }, [restaurantId, formState, resetForm]);

  if (!restaurantId) return null;
  if (!loadingRole && !access.normalizedRestaurantRole) {
    return <Navigate to="/app" replace />;
  }
  if (loadingRole) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        <BackToHome />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Анонимное письмо</h2>
          <p className="text-sm text-muted">
            Отправляйте сообщения руководителю ресторана. Получатель не увидит имя отправителя.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>Создать письмо</Button>
        )}
      </div>

      {lettersLoading && <div className="mt-4 text-sm text-muted">Загружаем список писем…</div>}
      {lettersError && !lettersLoading && (
        <div className="mt-4 text-sm text-red-600">{lettersError}</div>
      )}

      {!lettersLoading && (
        <div className="mt-4 space-y-3">
          {letters.length === 0 ? (
            <Card>
              <div className="text-sm text-muted">
                {isAdmin
                  ? "Новых писем пока нет."
                  : "Вы ещё не отправляли анонимных писем."}
              </div>
            </Card>
          ) : (
            letters.map((letter) => {
              const detail = details[letter.id];
              const isExpanded = expandedId === letter.id;
              const opening = loadingDetailsId === letter.id;
              return (
                <Card key={letter.id} className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs uppercase tracking-wide text-muted">
                        Дата письма: {formatDate(letter.createdAt)}
                      </div>
                      <ContentText className="text-lg font-semibold text-strong">
                        {letter.subject || "Без темы"}
                      </ContentText>
                      {!isAdmin && (
                        <div className="text-sm text-muted">
                          <span className="font-medium">Получатель:</span>{" "}
                          {letter.recipientPosition || letter.recipientName || "Администратор"}
                        </div>
                      )}
                      {isAdmin && !letter.readAt && (
                        <div className="text-xs text-emerald-700">Новое письмо</div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => void handleToggle(letter.id)}
                      disabled={opening}
                    >
                      {opening ? "Открываем…" : isExpanded ? "Скрыть" : "Открыть"}
                    </Button>
                  </div>

                  {isExpanded && (
                    <ContentText className="rounded-2xl bg-app p-3 text-sm text-default">
                      {detail ? detail.content : "Загружаем письмо…"}
                    </ContentText>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      <Modal
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          resetForm();
        }}
        title="Новое письмо"
        description="Сообщение увидят только выбранные администраторы ресторана."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={submitting}
            >
              Отменить
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? "Отправляем…" : "Отправить"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Тема письма"
            value={formState.subject}
            maxLength={MAX_SUBJECT_LENGTH}
            onChange={(e) => setFormState((prev) => ({ ...prev, subject: e.target.value }))}
            disabled={submitting}
            placeholder="Кратко опишите тему"
          />

          <SelectField
            label="Получатель"
            value={formState.recipientMemberId ?? ""}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, recipientMemberId: Number(e.target.value) || null }))
            }
            disabled={submitting || recipients.length === 0}
          >
            <option value="">Выберите администратора</option>
            {recipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {(() => {
                  const name =
                    recipient.fullName?.trim() ||
                    [recipient.firstName, recipient.lastName].filter(Boolean).join(" ").trim();
                  const position = recipient.positionName?.trim();

                  if (name && position) return `${name} (${position})`;
                  if (name) return name;
                  if (position) return `${position} #${recipient.id}`;
                  return `Администратор #${recipient.id}`;
                })()}
              </option>
            ))}
          </SelectField>
          {recipients.length === 0 && (
            <span className="mt-1 block text-xs text-muted">
              В ресторане пока нет участников с ролью ADMIN.
            </span>
          )}

          <Textarea
            label="Наполнение"
            value={formState.content}
            onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
            rows={8}
            disabled={submitting}
            placeholder="Опишите проблему или предложение"
          />

          {formError && <div className="text-sm text-red-600">{formError}</div>}
        </div>
      </Modal>
    </div>
  );
}
