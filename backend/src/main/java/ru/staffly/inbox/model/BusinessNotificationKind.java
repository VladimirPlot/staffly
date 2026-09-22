package ru.staffly.inbox.model;

/** Resource-oriented identity used to group new business notifications. */
public enum BusinessNotificationKind {
    SCHEDULE(InboxEventSubtype.SCHEDULE_DECISION),
    CERTIFICATION(InboxEventSubtype.CERTIFICATION),
    INVITATION(InboxEventSubtype.INVITATION);

    private final InboxEventSubtype eventSubtype;

    BusinessNotificationKind(InboxEventSubtype eventSubtype) {
        this.eventSubtype = eventSubtype;
    }

    public InboxEventSubtype eventSubtype() {
        return eventSubtype;
    }
}
