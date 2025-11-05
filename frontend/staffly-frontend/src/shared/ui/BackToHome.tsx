import { Link } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

type Props = { className?: string };

/**
 * Показывает ссылку "← Дом ресторана" ТОЛЬКО если:
 * - есть токен (пользователь залогинен)
 * - и выбран ресторан (user.restaurantId != null)
 */
export default function BackToHome({ className = "" }: Props) {
  const { token, user } = useAuth();

  if (!token || !user?.restaurantId) return null;

  return (
    <Link
      to="/app"
      title="Дом ресторана"
      className={`inline-flex items-center text-sm text-zinc-700 hover:underline ${className}`}
    >
      ← Дом ресторана
    </Link>
  );
}
