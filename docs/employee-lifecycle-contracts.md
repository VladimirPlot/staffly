# Employee Lifecycle contracts

Recorded 2026-10-09 against the [milestone baseline](employee-lifecycle.md).
DTO definitions in source are authoritative for full fields and validation.
Paths below are HTTP paths; JSON property names follow the Java DTO components.

## Entry points

| Operation | Route | Request source |
|---|---|---|
| Invitation impact | POST `/api/restaurants/{restaurantId}/invitations/impact` | `invite/dto/InvitationImpactRequest.java`: phone, positionId |
| Save invitation | POST `/api/restaurants/{restaurantId}/members/invite` | `invite/dto/InviteRequest.java`: phone, positionId, scheduleIntents |
| Cancel invitation | DELETE `/api/restaurants/{restaurantId}/invitations/{token}` | Token path parameter |
| List own invitations | GET `/api/invitations/my` | Authenticated contact identity |
| Accept / decline | POST `/api/invitations/{token}/accept` or `/decline` | Token path parameter; no request body required |
| Position impact | POST `/api/restaurants/{restaurantId}/members/{memberId}/position-change-impact` | `member/dto/PositionChangeImpactRequest.java`: targetPositionId |
| Position Apply | POST `/api/restaurants/{restaurantId}/members/{memberId}/position-change` | `member/dto/ApplyPositionChangeRequest.java` |
| Removal impact / Apply | POST `/api/restaurants/{restaurantId}/members/{memberId}/removal-impact` or `/remove` | Apply: `member/dto/ApplyEmployeeRemovalRequest.java`; self leave uses these same lifecycle routes |
| Assign orphan Task | PATCH `/api/tasks/{taskId}/assignee` | `task/dto/TaskAssignRequest.java`: memberId, expectedVersion |

All DTO paths are relative to `backend/src/main/java/ru/staffly/`. The obsolete
`/employees/invite` client was removed; use the invitation impact/save flow.

## Optimistic state and mandatory decisions

Invitation Schedule intents carry the selected action, requested deadline, expected
Schedule version/status, collection cycle, preference deadline and collection mode.
The server saves the Position snapshot. Acceptance revalidates saved conditions;
showing the current live Position name does not change the saved offer.

Position Apply sends targetPositionId, expectedCurrentPositionId,
expectedMemberCreatedAt, both Position definition snapshots, Schedule tokens,
expected Schedule/Certification ownership state and required handoff decisions.
Schedule tokens include version/status/cycle/deadline, participation ID and preference
submission ID/revision. Optional transfer lists normalize to empty; missing required
decisions are still rejected by authoritative validation.

Removal Apply sends expectedMemberCreatedAt, expectedCurrentPositionId, Schedule
tokens, Schedule/Certification ownership transfers and Task assignee/setter decisions.
Ownership transfers use resource ID, expected version/owner User and new owner User.
Task transfers use task ID, expected version/member ID and replacement member ID
where applicable. User IDs and employment member IDs are not interchangeable.

Preview flags describe actual effects. In particular `participationWillBeRemoved`
reflects existing participation, including PUBLISHED removal; Apply reports the
matching effect. `ScheduleTerminationConsistencyTest` compares preview and Apply.
Historical row presence alone does not imply operational participation.

| Conflict code | Client response |
|---|---|
| `INVITATION_IMPACT_PLAN_STALE` | Recompute invitation impact before saving |
| `INVITATION_INVALIDATED` | Display invalidated offer; obtain a fresh invitation |
| `POSITION_CHANGE_PLAN_STALE` | Refresh impact and require decisions against the fresh plan |
| `EMPLOYEE_REMOVAL_PLAN_STALE` | Refresh removal impact and decisions |
| `TASK_ASSIGNMENT_STALE` | Refresh task/version and current eligible employees |

Stale Position/Removal Apply and duplicate submission must not partially perform a
second transition. These Apply routes reject stale state rather than promise a universal
idempotent-success response. Acceptance separately returns the already accepted member
when the same intended User retries the accepted invitation; it does not create a new period.
The server remains authoritative even when the UI disables an action.

## UI and authority obligations

- Invitation cards display the saved Position snapshot. A changed definition can
  invalidate acceptance even if the label looks familiar.
- Reopening invitation collection requires a deadline later than the current
  collection deadline, with the applicable future-time validation. Position Change
  uses its own state-specific actions; do not infer allowed actions from invitation enums.
- Historical Schedule rows are read-only and visibly historical. The explanation
  applies to the row: a member can also have a separate active row.
- Detached personal Reminder means MEMBER with missing targetMember. Display that
  the employee left and the reminder is disabled. Saving requires an explicit valid
  recipient selection; never silently reinterpret the missing member as everyone.
- Orphan Task assignment requires a currently employed MANAGER/ADMIN actor and an
  active replacement member of the same restaurant. An active, uncompleted,
  unassigned task with matching version is required. Ending, completing, assigning
  or changing it invalidates the stale attempt. Return the persisted new version.
- Orphan assignment changes assignee and compatibility assignedUser only; preserves
  setter/author and task history. Notification deduplication uses
  `task-assignment:<taskId>:<persistedVersion>`, separately from creation events.
- CREATOR global Training administration does not create a membership or expose
  employee self-service automatically. Lifecycle replacement eligibility remains
  based on actual active employment and required capabilities.
