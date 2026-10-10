# Catch-up planning contract

The product promise is: after missed study, show the next useful lesson and a calendar the learner can actually follow. A scheduling change must not imply mastery or erase learning evidence.

## Three independent layers

1. Requirements: stable lesson IDs, source material, required problems, prerequisites, breaks, mock-exam duration and explicitly authored reserve.
2. Progress: completion, remaining-time estimates, notes, attempts, question outcomes, learned flags, cards and practice records.
3. Placement: date, optional start, planned duration, date lock, reserve consumed and an explicit unscheduled flag.

An unscheduled lesson retains its last date for history, but does not occupy calendar capacity, host new reviews, or appear as a dated next lesson. It remains visible in the backlog and can be planned again. Completion and learning/mastery are separate records.

## Rules in the first release

- Replan all committed unfinished lessons together, including simulations unless the learner locks their date. Keep completed learning records intact.
- Keep the exam date fixed. Preserve existing prerequisite spacing: an unfinished prerequisite must finish on an earlier day. This release does not invent same-day teaching order.
- Move whole lessons. Do not split proofs or simulation attempts. Splitting requires separately authored stopping points and is outside this release.
- Respect daily capacity, known time windows, fixed starts and existing review/mixed-practice allocations. Daily capacity includes completed sessions on that day; those minutes are deducted before allocating remaining work.
- Use the explicit remaining-time estimate when present. Never subtract elapsed minutes as a proxy for learning. Protect breaks, existing practice reservations and complete simulation blocks.
- Reserve is already included in lesson duration. Only an explicit reserve choice may reduce it. Track cumulative reserve consumption; do not consume it again on a subsequent replan or deduct it from an explicit remaining-time estimate.
- Required material is never silently deleted or shortened. Explicit deferral leaves that lesson and any dependent work unplaced. Partial plans require acknowledgement of the complete uncovered list; they never claim full exam coverage.
- A lesson with a planned linked review must be scheduled before a partial plan can be saved. Review history and allocations must not become orphaned.
- Draft progress and availability changes do not persist when navigating or cancelling. Applying a proposal saves the complete reviewed change through the existing revision-checked storage transaction.

## Search and independent validation

The pure catch-up engine reads a snapshot, constructs a dependency graph, propagates date bounds and searches deterministic alternatives, preferring original dates. Total capacity and long-block count checks explain necessary constraints. Search has a node budget so the interface remains responsive; exhausting it reports “not yet found”, not impossibility.

If full search cannot place everything, a dependency-closed partial proposal records every committed unfinished lesson as scheduled or unplaced. It does not leave unplaced work occupying its previous calendar date. The partial fallback is not claimed to be globally optimal.

A separate validator rebuilds the candidate calendar and checks coverage, identity, revision/snapshot consistency, allowed duration and reserve changes, locks, capacity, known clock windows, overlaps and prerequisite order. Save checks it again and rejects dates/start times that have elapsed. Input progress changes cannot mark material learned or mark questions solved.

Additional-window suggestions are verified proposals on currently zero-capacity days, not access to the learner's external calendar. They are editable and require review. The search attempts to remove or shorten unnecessary additions; it does not claim minimum extra time.

## Workflow and recovery

1. **Where to continue:** confirm missed/partial work and return date. Other unfinished lessons are available in a disclosure.
2. **Adjust time:** only needed when the original proposal does not fit. Compare the remaining budget with available capacity; edit reserve, daily availability, locks and explicit deferrals in one place.
3. **Review:** next lesson, coming week, reserve use, uncovered material and an expandable full change list. The action bar stays outside the scrollable body. A fitting unchanged plan returns directly to study.

Version-2 changes are stored separately from the existing plan history so old exports remain readable. New fields are validated on import. Safe undo restores planning and availability without undoing progress, and rejects later planning edits, invalid capacity/order, elapsed original dates or changed linked reviews. When reversal is unsafe, the user is directed to replan from today. The existing storage backups provide a further recovery copy.

## Acceptance gates

- Reproduce the public October 10 failure with all 28 sessions incomplete. A partial proposal must have no overloaded days or scheduled lessons with unplaced prerequisites.
- Show the 360-minute budget shortfall; using reserve must expose the remaining long-block constraint instead of promising that totals guarantee feasibility.
- Offer additional windows yielding a complete validated plan.
- Cover fitting plans, partial completion, locked mocks, explicit deferrals, missing/cyclic dependencies, exhausted search, clock windows, linked reviews, stale proposals, cancellation, safe/unsafe undo and round-tripped exports.
- Exercise real wizard event handlers against the planner and storage validator. These tests do not replace visual checks in desktop and mobile browsers.

Run `npm test` (Node 20+). No runtime package installation or build step is required for GitHub Pages.
