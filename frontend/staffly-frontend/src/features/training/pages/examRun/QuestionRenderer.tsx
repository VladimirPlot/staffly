import type { AttemptQuestionSnapshotDto } from "../../api/types";
import { isMatch, isMulti, isSingleLike } from "./answerUtils";
import FillSelectQuestion from "./renderers/FillSelectQuestion";
import MatchQuestion from "./renderers/MatchQuestion";
import MultiChoiceQuestion from "./renderers/MultiChoiceQuestion";
import SingleLikeQuestion from "./renderers/SingleLikeQuestion";
import UnsupportedQuestion from "./renderers/UnsupportedQuestion";

type Props = {
  question: AttemptQuestionSnapshotDto;
  index: number;
  selected?: string;
  isConfirmed: boolean;
  explanation: import("react").ReactNode;
  onSingleChange: (value: string) => void;
  onMultiChange: (value: string, checked: boolean) => void;
  onMatchChange: (left: string, right: string) => void;
  onFillSelectChange: (blankIndex: number, value: string) => void;
};

export default function QuestionRenderer(props: Props) {
  if (isMatch(props.question.type)) {
    return (
      <MatchQuestion
        question={props.question}
        index={props.index}
        selected={props.selected}
        isConfirmed={props.isConfirmed}
        explanation={props.explanation}
        onChange={props.onMatchChange}
      />
    );
  }

  if (isMulti(props.question.type)) {
    return (
      <MultiChoiceQuestion
        question={props.question}
        index={props.index}
        selected={props.selected}
        isConfirmed={props.isConfirmed}
        explanation={props.explanation}
        onChange={props.onMultiChange}
      />
    );
  }

  if (props.question.type === "FILL_SELECT") {
    return (
      <FillSelectQuestion
        question={props.question}
        index={props.index}
        selected={props.selected}
        isConfirmed={props.isConfirmed}
        explanation={props.explanation}
        onChange={props.onFillSelectChange}
      />
    );
  }

  if (isSingleLike(props.question.type)) {
    return (
      <SingleLikeQuestion
        question={props.question}
        index={props.index}
        selected={props.selected}
        isConfirmed={props.isConfirmed}
        explanation={props.explanation}
        onChange={props.onSingleChange}
      />
    );
  }

  return <UnsupportedQuestion question={props.question} index={props.index} />;
}
