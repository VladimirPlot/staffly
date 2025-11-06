package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedule_row",
        indexes = {
                @Index(name = "idx_schedule_row_schedule", columnList = "schedule_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    @Column(name = "member_id")
    private Long memberId;

    @Column(name = "display_name", nullable = false, length = 255)
    private String displayName;

    @Column(name = "position_id")
    private Long positionId;

    @Column(name = "position_name", length = 150)
    private String positionName;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @OneToMany(mappedBy = "row", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 128)
    @Builder.Default
    private List<ScheduleCell> cells = new ArrayList<>();
}