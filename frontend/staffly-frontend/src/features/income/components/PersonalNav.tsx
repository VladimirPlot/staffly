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
        <div className="flex gap-2 rounded-lg bg-white p-1 shadow-sm">
          {tabs.map((tab) => {
            const active = location.pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
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
