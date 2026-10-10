package ru.staffly.task.model;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="task_event") @Getter @Setter @NoArgsConstructor
public class TaskEvent {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="task_id") private Task task;
 private String actorName;
 @Column(columnDefinition="text") private String text;
 private Instant createdAt;
}
