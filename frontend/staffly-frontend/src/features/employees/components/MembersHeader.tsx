import Button from "../../../shared/ui/Button";
import LinkButton from "../../../shared/ui/LinkButton";

type MembersHeaderProps = {
  canInvite: boolean;
  inviteOpen: boolean;
  onToggleInvite: () => void;
};

export default function MembersHeader({ canInvite, inviteOpen, onToggleInvite }: MembersHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-semibold">Сотрудники</h2>
      {canInvite && (
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton to="/dictionaries/positions" variant="outline">
            Должности
          </LinkButton>
          <Button variant="outline" onClick={onToggleInvite}>
            {inviteOpen ? "Скрыть приглашение" : "Пригласить сотрудника"}
          </Button>
        </div>
      )}
    </div>
  );
}
