package ru.staffly.task.model;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import ru.staffly.member.model.RestaurantMember;
@Entity @Table(name="task_participant", uniqueConstraints=@UniqueConstraint(columnNames={"task_id","member_id"}))
@Getter @Setter @NoArgsConstructor
public class TaskParticipant {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="task_id") private Task task;
 @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="member_id") private RestaurantMember member;
 private boolean active;
 private Instant completedAt;
 private Instant joinedAt;
 private Instant leftAt;
}
