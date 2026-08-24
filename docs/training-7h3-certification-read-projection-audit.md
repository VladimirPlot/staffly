# 7H.3 Certification read-projection audit

This document records the pre-change audit and the resulting read contracts. “Current title” below is deliberately a display label; immutable scoring semantics never come from that label's current `TrainingExam` row.

## Pre-change behaviour

| Read | Previous selection / mutable dependency | Classification | Correction |
|---|---|---|---|
| Self result | Active assignment, otherwise `findTopBy...OrderByActiveDescAssignedAtDescIdDesc`; one selected row represented obligation, result, and attempt. It rendered `exam.passPercent`. | CURRENT_OBLIGATION + VALID_RESULT + HISTORICAL (incorrectly collapsed) | Resolve active obligation, latest passed assignment (`passedAt DESC, id DESC`), unfinished resume target, and latest published version independently. Render historical rules from the selected assignment specification. |
| Current certification list | Active assignments were selected correctly, but question/pass/time values came from current `TrainingExam`. | CURRENT_OBLIGATION | Keep the active assignment and render immutable specification rules; expose latest version and cycle/reset provenance separately. |
| Analytics normalization | `findCurrentAnalyticsScopeForUpdate` and both attempt queries required `assignment.examVersionSnapshot = exam.version`. | CURRENT_OBLIGATION (incorrectly LATEST_VERSION) | Lock only active Certification obligations and validate attempts against their assignment version. Inactive unfinished history remains outside normalization. |
| Summary / preview / position breakdown | Post-normalization `findActive...` rows. | CURRENT_OBLIGATION | No version filter; corrected normalization now covers the same active rows. |
| Employee table | Active rows, without version/cycle/reset provenance. | CURRENT_OBLIGATION | Add assignment version, latest published version, nullable cycle provenance, reset generation, and deactivation provenance. |
| Attempt history | All attempts for the user/exam; version only, persisted pass flag. | HISTORICAL | Add nullable assignment cycle/reset/deactivation provenance and the attempt's immutable pass-percent snapshot. Detached attempts remain readable. |
| Attempt details | Attempt question/title/runtime snapshots and `passPercentSnapshot`; already historical and detached-assignment safe. | HISTORICAL | Preserve snapshots and add nullable cycle/reset/deactivation provenance. |
| Practice progress native query | Requires `attempt.exam_version = exam.version`. | LATEST_VERSION (Practice only) | Retained. It is not a Certification obligation/result query. |
| Publication/lifecycle specification lookups (`requireCurrent`) | Resolve the specification matching the published exam version. | LATEST_VERSION / CURRENT_CYCLE | Retained; these are mutation consistency checks, not employee reads. |
| Notification cycle counters | “current” methods required latest version even for non-cycle notifications. | CURRENT_OBLIGATION or CURRENT_CYCLE | Current-obligation counters no longer filter by version; explicit cycle counters remain cycle-id scoped. |

## Authoritative projection rules

* **Latest published version** is `TrainingExam.version` and says nothing about an employee requirement.
* **Current obligation** is the unique active assignment for exam/restaurant/user, regardless of version.
* **Valid result** is the passed assignment with greatest `passedAt`, then greatest assignment id. It remains selectable behind a newer active recertification obligation.
* **Resume target** is the existing unique unfinished attempt across assignment history, ordered by start time and id. Runtime remains authoritative when starting; the read DTO only explains its target.
* **Historical scoring** uses attempt snapshots for attempt rows/details, specification scoring for assignment results, and `attemptsLimitSnapshot` for an existing assignment's allowance. A mismatch with specification attempt limit is logged as legacy V83 diagnostic and is never rewritten.
* **Historical labels** use `attempt.titleSnapshot` for attempt details. Assignment-level/self display uses the current certification title/description and explicitly pairs it with the historical result version; it is not claimed to be a historical title snapshot.
* **Cycles** are nullable. No legacy cycle is synthesized and reset generations are never ordered across cycles.

## State matrices

| Data | Self projection | Current manager analytics |
|---|---|---|
| Active PASSED v1, latest v2, no recertification | Current v1 PASSED; valid v1; certified; latest=2; no pending newer obligation | PASSED |
| Historical PASSED v1, active v2 cycle 5 ASSIGNED | Current v2/cycle 5; valid v1; previous certification remains visible | NOT_STARTED |
| Inactive unfinished v1, active v2 ASSIGNED | Resume v1 plus current v2; `hasPendingNewerObligation=true` | Only v2 NOT_STARTED |
| Historical FAILED v1 superseded, active v2 ASSIGNED | Current v2; historical failure remains separate | Only v2 NOT_STARTED |

An 85% v1 attempt with an 80% snapshot remains passed after v2 raises the current threshold to 90%. Cycle 5/generation 1 history and cycle 6/generation 0 current state retain those exact independent coordinates. A legacy null-cycle PASSED row projects all cycle fields as null.

## Remaining non-blocking debt

The employee manager UI does not yet render previous-passed and previous-unfinished annotations in its compact table. The self-result API and employee certification card expose the separated lifecycle state needed by the existing UI without introducing a universal DTO; a richer cycle-history dashboard remains intentionally out of scope.

## 7H.3.1 self-result presentation boundary

The legacy flat `scorePercent`, `passPercent`, `bestScore`, `passedAt`, attempt timestamps, and `questions` describe the selected result assignment and its completed attempt. `attemptsUsed` and `attemptsAllowed` describe the current active obligation when one exists. They must never be combined into one status line. The frontend therefore renders current obligation status/allowance from `currentAssignment*` plus the allowance fields, and renders a distinct successful-result block from `validResult*`.

| Projection | Before | After |
|---|---|---|
| Active PASSED v1; latest v2 | Certified/result and assignment appeared in one mixed line | One current v1 PASSED block; no duplicate previous block; latest v2 is informational |
| Historical PASSED v1; active v2 ASSIGNED | “Passed” could label the v2 allowance | Current v2 “Not started” plus separate previous v1 PASSED |
| Historical PASSED v1; active v2 FAILED | “Passed / 85% / attempts 1/2” mixed two rows | Current v2 FAILED with attempts 1/2; previous v1 PASSED with 85% and its passed time |
| Historical PASSED v1; no active assignment | Historical remaining allowance could enable retry | Previous v1 remains visible; no action and no inferred v2 requirement |
| Inactive unfinished v1; active v2 | Generic restart label | “Continue previous attempt”; text explains that v2 remains required afterwards |

### Runtime action eligibility

| Read state | Action |
|---|---|
| Previous unfinished attempt (with or without current obligation) | Continue previous attempt; the existing start route resumes it first |
| Current ASSIGNED | Start certification |
| Current IN_PROGRESS | Continue certification |
| Current FAILED with allowance remaining | Retry attempt |
| Current PASSED, EXHAUSTED, ARCHIVED, or no current assignment | No current-obligation action |

The published/result version difference is never an action condition. Historical question review is explicitly labelled with the selected result version and continues to use immutable attempt snapshots.
