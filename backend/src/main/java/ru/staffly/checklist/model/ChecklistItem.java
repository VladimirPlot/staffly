package ru.staffly.checklist.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.staffly.member.model.RestaurantMember;

import java.time.Instant;

@Entity
@Table(name = "checklist_item")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChecklistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "checklist_id", nullable = false)
    private Checklist checklist;

    @Column(name = "item_order", nullable = false)
    private Integer itemOrder;

    @Column(name = "text", nullable = false, columnDefinition = "TEXT")
    private String text;

    @Column(name = "done", nullable = false)
    private boolean done;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "done_by_member_id")
    private RestaurantMember doneBy;

    @Column(name = "done_at")
    private Instant doneAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reserved_by_member_id")
    private RestaurantMember reservedBy;

    @Column(name = "reserved_at")
    private Instant reservedAt;
}