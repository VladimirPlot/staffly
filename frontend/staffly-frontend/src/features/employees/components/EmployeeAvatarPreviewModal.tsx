import React from "react";
import { Copy } from "lucide-react";
import type { MemberDto } from "../api";
import { displayNameOf, formatBirthday, ROLE_LABEL } from "../utils/memberUtils";
import Toast from "../../home/components/Toast";
import Modal from "../../../shared/ui/Modal";

type EmployeeAvatarPreviewModalProps = {
  open: boolean;
  member: MemberDto | null;
  onClose: () => void;
};

export default function EmployeeAvatarPreviewModal({
  open,
  member,
  onClose,
}: EmployeeAvatarPreviewModalProps) {
  const fallbackCopyText = React.useCallback((value: string): boolean => {
    if (typeof document === "undefined") return false;

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }, []);

  const handleClose = React.useCallback(() => {
    onClose();
  }, [onClose]);

  const displayName = member ? displayNameOf(member) : "";
  const roleLabel = member ? member.positionName || ROLE_LABEL[member.role] : "";
  const phoneHref = member?.phone ? `tel:${member.phone.replace(/\s+/g, "")}` : null;
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const initials = React.useMemo(() => {
    return (
      displayName
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U"
    );
  }, [displayName]);

  const handleCopyPhone = React.useCallback(async () => {
    if (!member?.phone) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(member.phone);
      } else if (!fallbackCopyText(member.phone)) {
        throw new Error("Clipboard API unavailable");
      }
      setToastMessage("Номер скопирован");
    } catch {
      if (fallbackCopyText(member.phone)) {
        setToastMessage("Номер скопирован");
      } else {
        setToastMessage("Не удалось скопировать номер");
      }
    }
  }, [fallbackCopyText, member?.phone]);

  return (
    <Modal
      open={open && Boolean(member)}
      onClose={handleClose}
      ariaLabel="Просмотр аватара сотрудника"
      className="max-w-xl"
      overlayCloseButton
      overlayCloseLabel="Закрыть просмотр аватара"
    >
      {member ? (
        <div className="border-subtle relative mx-auto w-full overflow-hidden rounded-[24px] border bg-[linear-gradient(180deg,var(--staffly-control),var(--staffly-surface))] shadow-[0_16px_44px_rgba(15,23,42,0.10)] sm:rounded-[32px] sm:shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
          <div className="pointer-events-none absolute inset-x-4 top-4 h-20 rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.14),transparent_70%)] blur-2xl sm:inset-x-8 sm:top-6 sm:h-28" />
          <div className="relative">
            <div className="relative h-60 w-full overflow-hidden rounded-b-[18px] bg-[linear-gradient(180deg,#f8fafc,#eef2f7)] sm:h-[22rem] sm:rounded-b-[22px]">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="bg-app text-default flex h-full w-full items-center justify-center text-5xl font-semibold select-none sm:text-6xl">
                  {initials}
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,rgba(248,250,252,0.82)_68%,rgba(248,250,252,0.96))] sm:h-24" />
            </div>

            <div className="relative -mt-3 px-3 pb-4 sm:-mt-5 sm:px-5 sm:pb-6">
              <div className="rounded-[22px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.90))] px-3 pt-3 pb-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.94)] backdrop-blur-md sm:rounded-[28px] sm:px-5 sm:pt-5 sm:pb-6 sm:shadow-[0_18px_40px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]">
                <div className="text-strong text-[1.05rem] font-medium sm:text-lg">
                  {displayName}
                </div>

                <div className="text-muted mt-3 flex flex-wrap justify-center gap-2 text-xs sm:mt-4 sm:text-sm">
                  {roleLabel && (
                    <span className="border-subtle rounded-full border px-3 py-1">{roleLabel}</span>
                  )}
                  {member.phone && phoneHref && (
                    <span className="border-subtle inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1">
                      Тел:{" "}
                      <a
                        href={phoneHref}
                        className="[WebkitTapHighlightColor:transparent] max-w-[11rem] truncate bg-transparent font-medium text-sky-700 underline decoration-sky-400 underline-offset-2 transition-colors hover:text-sky-800 focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--staffly-surface)] sm:max-w-none"
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        {member.phone}
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleCopyPhone()}
                        aria-label="Скопировать номер"
                        title="Скопировать номер"
                        className="text-muted hover:text-strong inline-flex h-5 w-5 items-center justify-center rounded-sm bg-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  {member.birthDate && (
                    <span className="border-subtle rounded-full border px-3 py-1">
                      ДР: {formatBirthday(member.birthDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} durationMs={2200} />
    </Modal>
  );
}
