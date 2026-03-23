import type { ChangeEvent } from "react";
import Input from "../../../../../shared/ui/Input";

type Props = {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
};

export default function ExamBasicsSection({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-default">Основная информация</div>

      <Input label="Название теста" value={title} onChange={(event: ChangeEvent<HTMLInputElement>) => onTitleChange(event.target.value)} required />

      <Input label="Описание" value={description} onChange={(event: ChangeEvent<HTMLInputElement>) => onDescriptionChange(event.target.value)} />
    </section>
  );
}
