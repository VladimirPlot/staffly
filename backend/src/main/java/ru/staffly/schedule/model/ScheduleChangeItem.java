package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "schedule_change_item")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleChangeItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "change_id", nullable = false)
    private ScheduleChange change;

    @Column(name = "member_id") private Long memberId;
    @Column(name = "row_id") private Long rowId;
    @Column(name = "member_display_name", nullable = false) private String memberDisplayName;
    @Column(nullable = false) private LocalDate day;
    @Column(name = "old_value", columnDefinition = "text") private String oldValue;
    @Column(name = "new_value", columnDefinition = "text") private String newValue;
    @Enumerated(EnumType.STRING) @Column(name = "old_source") private ScheduleCellSource oldSource;
    @Enumerated(EnumType.STRING) @Column(name = "new_source") private ScheduleCellSource newSource;
}
