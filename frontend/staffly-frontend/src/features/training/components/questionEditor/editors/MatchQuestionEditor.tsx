import { Trash2 } from "lucide-react";
import Button from "../../../../../shared/ui/Button";
import IconButton from "../../../../../shared/ui/IconButton";
import Input from "../../../../../shared/ui/Input";
import type { QuestionPairDraft } from "../shared/questionEditorTypes";

type Props = {
  pairs: QuestionPairDraft[];
  duplicates: Set<string>;
  onPairsChange: (updater: (prev: QuestionPairDraft[]) => QuestionPairDraft[]) => void;
};

export default function MatchQuestionEditor({ pairs, duplicates, onPairsChange }: Props) {
  return (
    <div className="space-y-2">
      {pairs.map((pair, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <Input
            label="Левая часть"
            value={pair.leftText}
            onChange={(e) =>
              onPairsChange((prev) =>
                prev.map((item, idx) => (idx === index ? { ...item, leftText: e.target.value } : item)),
              )
            }
            error={duplicates.has(`pair-${index}`) ? "Дубликат пары" : undefined}
          />
          <Input
            label="Правая часть"
            value={pair.rightText}
            onChange={(e) =>
              onPairsChange((prev) =>
                prev.map((item, idx) => (idx === index ? { ...item, rightText: e.target.value } : item)),
              )
            }
            error={duplicates.has(`pair-${index}`) ? "Дубликат пары" : undefined}
          />
          <div className="flex items-end justify-end">
            <IconButton onClick={() => onPairsChange((prev) => prev.filter((_, idx) => idx !== index))}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => onPairsChange((prev) => [...prev, { leftText: "", rightText: "" }])}
      >
        Добавить пару
      </Button>
    </div>
  );
}
