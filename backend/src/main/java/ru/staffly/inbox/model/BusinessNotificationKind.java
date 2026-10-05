package ru.staffly.inbox.model;

/** Resource-oriented identity used to group new business notifications. */
public enum BusinessNotificationKind {
    SCHEDULE(InboxEventSubtype.SCHEDULE_DECISION),
    CERTIFICATION(InboxEventSubtype.CERTIFICATION),
    POSITION_CHANGE(InboxEventSubtype.POSITION_CHANGE),
    POSITION_CHANGE_PREFERENCES(InboxEventSubtype.SCHEDULE_PREFERENCES),
    POSITION_CHANGE_SHIFTS(InboxEventSubtype.SCHEDULE_PUBLISHED_CHANGED),
    INVITATION(InboxEventSubtype.INVITATION),
    TASK_ASSIGNMENT(InboxEventSubtype.TASK),
    TASK_RESPONSIBILITY(InboxEventSubtype.TASK),
    TASK_ORPHANED(InboxEventSubtype.TASK);

    private final InboxEventSubtype eventSubtype;

    BusinessNotificationKind(InboxEventSubtype eventSubtype) {
        this.eventSubtype = eventSubtype;
    }

    public InboxEventSubtype eventSubtype() {
        return eventSubtype;
    }
}
