import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "../providers/AuthProvider";
import Icon from "./Icon";

type Props = { className?: string };

export default function BackToHome({ className = "" }: Props) {
  const { token, user } = useAuth();
  if (!token || !user?.restaurantId) return null;

  return (
    <Link
      to="/app"
      title="Главная"
      className={
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-2xl " +
        "border border-subtle bg-surface px-2 py-1 text-sm font-medium text-default " +
        "shadow-[var(--staffly-shadow)] transition hover:bg-app focus:outline-none " +
        "focus:ring-2 focus:ring-default " +
        className
      }
    >
      <Icon icon={ArrowLeft} size="xs" decorative className="shrink-0 text-icon" />
      {/* на мобилке короче, чтобы не раздувало */}
      <span className="sm:hidden">Главная</span>
      <span className="hidden sm:inline">На главную</span>
    </Link>
  );
}
