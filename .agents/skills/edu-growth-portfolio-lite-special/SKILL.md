---
name: edu-growth-portfolio-lite-special
description: Govern scope, architecture decisions, reviews, and implementation work for EDU_SOP Growth Portfolio Lite V1. Use when planning, changing, or assessing the Growth Portfolio product; do not use to expand the legacy EDU ERP scope.
metadata:
  display-name: EDU_Growth_Portfolio_Lite_Special
  version: V1.0
---

# EDU Growth Portfolio Lite Special

## Authority and target

- Formal product: **Growth Portfolio Lite V1**
- Production target: **no later than 2026-09-30**
- Intended launch population: existing 300+ student families
- Mission: deliver a lightweight child growth portfolio that is ready for real family use.

Apply this governance before proposing, reviewing, or implementing product work. Loading this skill never authorizes code changes, database mutations, cloud changes, commits, pushes, or deployments by itself.

## Product mission

Every V1 capability must directly support at least one of these outcomes:

1. **RECORD** — record child growth experiences at low input cost.
2. **PRESENT** — present growth in a high-quality, visually compelling form.
3. **PRESERVE** — preserve selected memories and supporting evidence over time.
4. **EXPORT** — generate Web, PPT, and PDF growth portfolios without requiring parents to edit or redesign them.

The commercial outcome is increased institutional value, parent-perceived value, retention, and long-term renewal relationships.

## Scope boundary

Growth Portfolio Lite V1 is not an ERP, CRM, academic administration system, scheduling system, finance system, family cloud album, child social platform, admissions scoring system, or AI child-ability prediction system.

Do not add a capability to V1 unless it clearly supports the formal product chain:

```text
Institution / parent provides growth material
  -> Growth Record
  -> automatic classification and presentation
  -> child Growth Portfolio
  -> PPT / PDF / Web sharing
```

If the relationship to this chain is unclear, classify the proposal as out of V1 and report it rather than implementing it.

## Active product principles

Treat all of the following as release-governing requirements:

- `VISUAL_FIRST`
- `LOW_INPUT_COST`
- `LIGHTWEIGHT_FIRST`
- `EVIDENCE_BASED`
- `EXPORT_READY`
- `COST_GOVERNANCE`
- `PRIVACY_BY_DEFAULT`
- `HUMAN_REVIEW`

Reject these approaches:

- `BIG_BANG_REWRITE`
- `ERP_SCOPE_EXPANSION`
- `COMPLEX_ONTOLOGY`
- `AI_CHILD_SCORING`
- `ADMISSION_PREDICTION`
- `UNLIMITED_MEDIA_STORAGE`
- `UNCONTROLLED_SAAS_EXPANSION`

Prefer incremental reuse of existing tables, APIs, content, and export logic when that is safe. Do not create parallel complex modules merely to match frontend sections.

## Parent-facing information architecture

Keep the V1 parent experience to six visual regions:

1. **Hero / 我的成长主页**
2. **Growth Timeline / 成长轨迹**
3. **Projects & Works / 作品与项目**
4. **Skills & Achievements / 技能与荣誉**
5. **Interests & Growth / 兴趣与成长**
6. **Growth Report Export / 成长报告**

Existing data tables may continue to supply these regions. Do not turn the six regions into six independent, complex business systems.

## Growth Record governance

Use one lightweight Growth Record as the V1 content-entry concept.

The ordinary institution or parent flow should require no more than:

1. type
2. date
3. title or one-sentence description

Optional inputs may include:

- supplementary description
- image
- certificate
- work artifact
- tags
- featured status

The system should record automatically:

- child reference
- source
- status
- creation timestamp

Recognize at least these sources:

- `INSTITUTION_RECORD`
- `PARENT_PROVIDED`

Reserve `CHILD_SELF_REPORTED` for a future extension; it is not required for V1.

Do not require teachers or parents to maintain a complex data model. Target completion time is at most 60 seconds for an ordinary teacher record and at most 90 seconds for an ordinary parent contribution.

## Decision gate

For each proposed V1 change, state:

1. which step of the formal product chain it serves;
2. which parent-facing region it affects;
3. whether it reduces or increases input cost;
4. what evidence it records or presents;
5. privacy and human-review implications;
6. export impact for Web, PPT, and PDF;
7. storage, service, and operating-cost impact;
8. whether existing assets can be reused incrementally.

If a proposal violates a prohibited approach or cannot pass this gate, stop and report the conflict. Do not silently broaden the scope.

## Delivery discipline

- Protect the 2026-09-30 Production V1 date from nonessential scope.
- Prioritize a complete, secure record-to-portfolio-to-export path over feature count.
- Keep the parent experience visual, simple, mobile-friendly, and suitable across childhood age ranges.
- Keep factual growth claims tied to supplied records or evidence; do not infer scores, diagnoses, admissions outcomes, or future ability.
- Require human review where automated classification, generated wording, or parent-provided material could become part of the formal portfolio.
- Treat minor data and family media as private by default.
- Make storage limits and paid SaaS additions explicit before implementation.

## Continuous autonomous execution amendment

`CONTINUOUS_AUTONOMOUS_EXECUTION` and `STAGE_LEVEL_CONTINUOUS_AUTONOMY` are active. They replace any earlier project rule requiring human approval after every file, test, unit, commit, or push.

This authority applies only inside a **Formal Development Stage explicitly approved by the user**. It does not start a stage, approve work outside that stage, or override tool, platform, security, privacy, cost, or external-service approval requirements.

At the start of an approved stage, report before implementation:

- planned unit identifiers and names;
- total unit count;
- expected files;
- verification boundaries;
- the stage scope boundary.

After this stage plan is stated, execute its approved units serially without asking for approval between ordinary units.

### Serial unit execution

`SERIAL_UNIT_EXECUTION` is active. For each unit:

```text
define exact unit boundary
  -> implement
  -> verify
  -> fix within the same unit if needed
  -> verification PASS
  -> close the unit in Git
  -> synchronize remotes
  -> begin the next approved unit
```

Keep these invariants:

- one functional unit at a time;
- prefer one-file units when practical;
- keep an individual implementation file at or below 600 lines unless an existing file already exceeds that boundary and splitting it would increase risk;
- do not develop unrelated pages or functions in parallel;
- do not batch-generate multiple business files before verification;
- do not cross the approved Formal Stage;
- independently verify every unit;
- do not begin the next unit until the current unit passes verification.

Continuous autonomy never means generating or rewriting the entire system in one pass.

### Autonomous repair boundary

When a unit test, typecheck, static check, page check, or regression check fails, diagnose and repair autonomously inside the current unit. This includes local code, tests, types, layout, and regressions belonging to that unit.

Do not use repair authority to refactor the whole project, change unrelated modules, make a major core database change, or expand product scope.

### Git closure and exact staging

`GIT_AUTONOMOUS_CLOSURE` is active for a unit only after it reaches `VERIFIED / FULLY_CLOSED` inside an approved stage. At that point, exact-scope staging, commit, Gitee push, and GitHub push do not require a separate project-level confirmation.

Before every commit:

1. inspect branch, HEAD, working tree, staged files, and remotes;
2. stage only files belonging to the current unit;
3. verify the staged diff contains no unrelated or pre-existing user work;
4. stop for diagnosis if the working tree is abnormal or scope ownership is uncertain.

Never force-push, rewrite or reset published history, rebase published commits, submit unrelated files, or commit across repositories.

Tool or environment approval prompts still apply. Never expose, print, or persist credentials.

### Dual-remote synchronization

Use `SYNC_AFTER_EACH_FULLY_CLOSED_UNIT` for the Growth Portfolio Lite Gitee and GitHub remotes. Confirm the configured remote names and URLs before the first synchronization in each stage; do not infer them from labels alone.

After a closed unit:

1. commit locally;
2. push Gitee;
3. push GitHub;
4. compare the intended commit with each corresponding remote HEAD.

Record each result truthfully:

- `GITEE_SYNC = SYNCED | PENDING`
- `GITHUB_SYNC = SYNCED | PENDING`

If one remote fails because of network conditions, do not report success. Work may continue to the next approved unit only when verification passed, local Git is safe, and at least one formal remote contains the closed unit. Keep the other remote as explicit sync debt and retry safely during the stage. Recheck both remotes before stage closure.

If either remote remains pending at stage end, the stage may be `FUNCTIONALLY_CLOSED_REMOTE_SYNC_PENDING` but not `FULLY_CLOSED_REMOTE_SYNCED`.

This development-stage synchronization policy does not reactivate or alter any separately paused recurring backup automation.

## Human gates

Do not request human confirmation for ordinary UI implementation details, CSS adjustments, local component choices, existing-page refactoring inside scope, test repair, or other reversible implementation decisions within an approved stage.

Stop and require a Human Gate for:

1. product scope expansion;
2. a new paid service or recurring cost;
3. a major core database schema change;
4. deletion or migration of real business data;
5. a major RLS or minor-privacy model change;
6. long-term video storage;
7. a new third-party commercial service;
8. SaaS or multi-tenant commercialization;
9. billing or subscription implementation;
10. a proposed full rewrite;
11. conflict with the Growth Portfolio Lite V1 scope freeze;
12. a business decision that real data cannot resolve;
13. a feature outside the approved stage.

Human responsibility is the formal stage-start authorization, true Human Gate decisions, final visual acceptance, and final functional acceptance.

## Visual-stage acceptance

Within an approved visual stage, autonomously complete the first implementation, local checks, responsive checks, obvious visual corrections, functional verification, and the stage report. Then provide the real or demo page for `FINAL_VISUAL_ACCEPTANCE` and `FINAL_FUNCTIONAL_ACCEPTANCE`.

If the user returns `REVISION_REQUIRED`, treat the requested revisions as a new Visual Revision Stage rather than silently extending the closed stage.

## Cost and future SaaS boundary

Continuous execution never overrides `COST_GOVERNANCE`. Storage, APIs, AI models, third-party services, video, database expansion, or deployment plans that may introduce recurring cost require a Human Gate. Do not activate a paid service autonomously.

Freeze these operating boundaries:

- `V1_OPERATION_MODE = SINGLE_ORGANIZATION`
- `FUTURE_MULTI_ORGANIZATION_READY = YES`
- `SAAS_IMPLEMENTATION = FORBIDDEN_IN_V1`

Do not autonomously introduce tenant management, billing, subscriptions, or external-organization onboarding.

## Formal stage completion report

Do not repeatedly ask the user to continue between approved units. At stage end, provide one **Growth Portfolio Lite Formal Stage Completion Report** containing:

1. Formal Stage
2. Starting HEAD
3. Final HEAD
4. Completed Units
5. Modified Files
6. Verification
7. Functional Result
8. Visual Result
9. Cost Impact
10. Storage Impact
11. Gitee Sync
12. GitHub Sync
13. Working Tree
14. Remaining Issues
15. Human Gate Encountered
16. Final Status

Use exactly one final status that reflects reality:

- `FULLY_CLOSED`
- `FUNCTIONALLY_CLOSED_REMOTE_SYNC_PENDING`
- `NEEDS_INPUT`
- `HUMAN_GATE_REQUIRED`
- `FAILED`

After the entire stage ends, wait for final visual and functional acceptance.

## Unresolved governance input

The approved source request received on 2026-08-31 ended at the heading `九、Evidence 原...`. Do not invent or claim approval for the missing clauses. When the user supplies the remainder, update this skill narrowly, preserve the established scope boundary, and increment the version only if the user authorizes a version change.
