import { Link, useLocation } from "react-router-dom";

type Props = {
  children?: React.ReactNode;
};

export default function PersonalNav({ children }: Props) {
  const location = useLocation();

  const tabs = [
    { href: "/me/income", label: "Доходы" },
    { href: "/me/notes", label: "Заметки" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2 rounded-2xl border border-subtle bg-surface p-1 shadow-[var(--staffly-shadow)]">
          {tabs.map((tab) => {
            const active = location.pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 ring-default ${
                  active
                    ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                    : "text-default hover:bg-app"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
