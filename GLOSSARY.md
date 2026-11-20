# studyloop

A learner's record of what they study, how it connects, and where they're weak, with job search as the first source of weaknesses. It exists to turn scattered learning into a visible, accountable loop: get tested → find Gaps → study → reflect → re-plan.

## Language

### Learning core

**Learner**:
The person whose learning is being tracked; every record belongs to exactly one Learner.
_Avoid_: Account, profile, owner (in domain contexts)

**Topic**:
A named subject or skill the Learner is learning, at any granularity.
_Avoid_: Tag, skill, subject, category

**Topic Link**:
A directed, typed relationship between two Topics: **prerequisite of**, **part of**, or **related to**.
_Avoid_: Edge, relation, connection

**Daily Entry**:
The Learner's record of what they worked on and learned on a given date; at most one per date.
_Avoid_: Journal, log, note, check-in

**Confidence**:
The Learner's 1–5 self-rating of a Topic, given in a Daily Entry; its history over time shows progress.
_Avoid_: Score, mastery, level

**Active Day**:
A date, in the Learner's own timezone, with a Daily Entry tagging at least one Topic.

**Streak**:
The number of consecutive Active Days ending today (or yesterday, if today isn't active yet).

**Resource**:
An external learning material (video, article, docs, other) identified by its URL, with the Learner's own notes.
_Avoid_: Link, bookmark, material, source

**Struggle Reflection**:
The Learner's account of why a Topic is hard for them: what's confusing, what they've tried, and what format would help.
_Avoid_: Blocker, note, confusion

### Gaps

**Gap**:
A Topic flagged as a weakness by a Gap Source, at a point in time.
_Avoid_: Weakness, weak spot, todo

**Gap Source**:
The event that exposed a Gap; an Interview Round is the only kind today.

**Addressed**:
A Gap is Addressed once the Learner studies its Topic after it was flagged, or dismisses it.

**Stale Gap**:
An un-Addressed Gap whose Topic has had no study for 7 or more days.

**Study Queue**:
The Learner's un-Addressed Gaps, grouped by Topic and ordered by urgency.
_Avoid_: Backlog, todo list

### Planning

**Study Plan**:
A goal the Learner commits to reach by a deadline, given a fixed number of available hours per day.
_Avoid_: Course, curriculum, roadmap

**Study Item**:
One scheduled unit of work in a Study Plan, of kind **read**, **watch**, or **build**, with a time estimate.
_Avoid_: Task, lesson, step

**Capstone**:
The single build Study Item that concludes a Study Plan by applying what was learned.

**Re-plan**:
Rescheduling a Study Plan's remaining Study Items so it fits the time left before the deadline.

### Job search

**Company**:
An organization the Learner has engaged with as a potential employer.
_Avoid_: Employer, org

**Application**:
The Learner's pursuit of one role at one Company, with a status that changes over time.
_Avoid_: Opportunity, job, lead

**Interview Round**:
One interview within an Application, recording its type, the questions asked, the Learner's self-assessment, and the Gaps it exposed.
_Avoid_: Interview, stage, loop

### Study Agent

**Study Agent**:
The assistant that suggests Topic Links, finds Resources for a Struggle Reflection, and drafts or Re-plans Study Plans.
_Avoid_: Bot, AI, assistant

**Proposal**:
A change the Study Agent suggests, which takes effect only when the Learner accepts it.
_Avoid_: Suggestion, recommendation, draft
