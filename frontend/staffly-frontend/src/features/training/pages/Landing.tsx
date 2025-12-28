import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import BackToHome from "../../../shared/ui/BackToHome";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { TRAINING_MODULES } from "../config";

export default function TrainingLandingPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <Breadcrumbs
          home={<BackToHome className="text-sm" />}
          items={[{ label: "Тренинг" }]}
        />
      </div>

      <h2 className="mb-4 text-2xl font-semibold">Тренинг</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {TRAINING_MODULES.map((module) => (
          <Link key={module.slug} to={`/training/${module.slug}`} className="block">
            <Card className="h-full transition hover:translate-y-[-2px] hover:shadow-md">
              <div className="text-lg font-semibold">{module.title}</div>
              <div className="mt-2 text-sm text-zinc-600">{module.description}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
