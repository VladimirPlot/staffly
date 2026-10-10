package ru.staffly.member.lifecycle;
import ru.staffly.schedule.dto.AppliedInvitationScheduleEffect;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;
import java.util.List;
import java.util.UUID;
public record AdmissionModuleResult(UUID operationId, List<AppliedInvitationScheduleEffect> scheduleEffects,
                                    List<AppliedCertificationAudienceEffect> certificationEffects) {}
