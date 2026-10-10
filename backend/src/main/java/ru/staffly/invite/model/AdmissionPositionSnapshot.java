package ru.staffly.invite.model;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.dto.PositionChangeImpactPlan.PositionSnapshot;
public record AdmissionPositionSnapshot(Long positionId, PositionSnapshot definition) {
    public static AdmissionPositionSnapshot of(Position position) {
        return new AdmissionPositionSnapshot(position.getId(), PositionSnapshot.of(position));
    }
}
