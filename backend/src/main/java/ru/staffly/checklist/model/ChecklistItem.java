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

    @Column(name = "example_photo_url", columnDefinition = "TEXT")
    private String examplePhotoUrl;

    @Column(name = "completion_photo_url", columnDefinition = "TEXT")
    private String completionPhotoUrl;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "completion_photo_mode", nullable = false, length = 20)
    private ChecklistPhotoMode completionPhotoMode = ChecklistPhotoMode.NONE;

    @Builder.Default
    @Column(name = "completion_photo_required", nullable = false)
    private boolean completionPhotoRequired = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "completion_photo_uploaded_by_member_id")
    private RestaurantMember completionPhotoUploadedBy;

    @Column(name = "completion_photo_uploaded_at")
    private Instant completionPhotoUploadedAt;
}
