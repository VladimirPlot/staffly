package ru.staffly.inbox.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.member.model.RestaurantMember;

import java.time.Instant;

@Entity
@Table(name = "inbox_recipients",
        uniqueConstraints = @UniqueConstraint(name = "uq_inbox_recipient", columnNames = {"message_id", "member_id"}),
        indexes = {
                @Index(name = "idx_inbox_recipients_member", columnList = "member_id"),
                @Index(name = "idx_inbox_recipients_message", columnList = "message_id"),
                @Index(name = "idx_inbox_recipients_member_message", columnList = "member_id,message_id"),
                @Index(name = "idx_inbox_recipients_member_archived", columnList = "member_id,archived_at"),
                @Index(name = "idx_inbox_recipients_member_read_archived", columnList = "member_id,read_at,archived_at")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InboxRecipient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false)
    private InboxMessage message;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private RestaurantMember member;

    @Column(name = "delivered_at", nullable = false)
    private Instant deliveredAt;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "archived_at")
    private Instant archivedAt;
}