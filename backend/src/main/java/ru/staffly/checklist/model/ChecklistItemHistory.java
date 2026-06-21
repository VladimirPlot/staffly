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
@Table(name = "checklist_item_history",
        indexes = {
                @Index(name = "idx_checklist_item_history_history_order", columnList = "history_id, item_order"),
                @Index(name = "idx_checklist_item_history_source_item", columnList = "source_item_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChecklistItemHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "history_id", nullable = false)
    private ChecklistHistory history;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_item_id")
    private ChecklistItem sourceItem;

    @Column(name = "item_order", nullable = false)
    private Integer itemOrder;

    @Column(name = "text", nullable = false, columnDefinition = "TEXT")
    private String text;

    @Column(name = "done", nullable = false)
    private boolean done;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "done_by_member_id")
    private RestaurantMember doneBy;

    @Column(name = "done_by_name", length = 255)
    private String doneByName;

    @Column(name = "done_at")
    private Instant doneAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reserved_by_member_id")
    private RestaurantMember reservedBy;

    @Column(name = "reserved_by_name", length = 255)
    private String reservedByName;

    @Column(name = "reserved_at")
    private Instant reservedAt;

    @Column(name = "completion_photo_required", nullable = false)
    private boolean completionPhotoRequired;

    @Column(name = "example_photo_url", columnDefinition = "TEXT")
    private String examplePhotoUrl;

    @Column(name = "completion_photo_url", columnDefinition = "TEXT")
    private String completionPhotoUrl;
}
