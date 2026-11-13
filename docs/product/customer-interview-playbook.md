# P0.04 — Customer Interview Playbook

**Project:** Zoho Clone
**Date:** 2026-11-13
**Status:** DRAFT — phase active; awaiting product-owner review and authorization to begin outreach.
**Prior phase:** P0.03 Competitive Capability Matrix, approved 2026-11-13.
**Tracking issue:** https://github.com/owaisprog/Zoho-Clone/issues/6
**Audience:** ISO / merchant services companies (priority 1); POS providers/resellers (priority 2); PayFac/software-led payments (priority 3).

## 1. Purpose and decisions this research must support

We need evidence about **current work**, **costly problems**, **buyers**, **switching constraints**, and **the minimum paid product** — not opinions about a feature wishlist. The research must allow the conclusion that our current first-product hypothesis is wrong.

Questions this work should answer:
1. Is merchant onboarding visibility a recurrent, costly problem?
2. Is generic CRM plus agent/merchant records enough for a paid first version?
3. Are processor API boarding, residual calculations, or equipment installation genuinely unavoidable before payment?
4. Are prospects satisfied with incumbent software such as NMI Merchant Central, ISOhub, or processor-provided portals?
5. Is there a reachable budget owner, a clear buying trigger, and a viable pilot path?
6. Which segment should receive product development attention first?

P0.04 creates a **reproducible interview protocol and research kit**. **Interview completion and conclusions are separate evidence-generating work**, not a claim that the playbook alone validates product-market fit.

## 2. Owners and capabilities

| Activity | ChatGPT | Product owner / human |
| --- | --- | --- |
| Plan segments, scripts, scoring and templates | Create and revise | Approve |
| Identify potential organizations from permitted public data | Assist when requested | Select/verify appropriateness |
| Contact prospects, send invitations, arrange calls | Draft messages; act only through expressly connected tools with authorization | Approve outreach and manage external accounts/consent |
| Conduct live qualitative interviews | Supply prompts, assist with transcripts/notes the owner supplies | Conduct/participate in calls and obtain consent |
| Process notes | Extract anonymized patterns and contradictory evidence | Do not share unconsented private/personal data |
| Set commercial and product priorities | Recommend from evidence | Approve P0 decision gates |
| Interview recordings, confidential exports, credentials | Never place in the public repository | Use access-controlled storage and follow applicable consent/law |

**Repository warning:** `owaisprog/Zoho-Clone` is a PUBLIC GitHub repository. Only research templates, abstract findings and sanitized, authorized examples belong here. Do **not** upload lead lists, interviewee names, private emails, recordings, verbatim identifiable quotes, contracts, merchant underwriting data, credentials or raw merchant files.

## 3. Research design and quotas

Target **15–25 distinct companies/decision stakeholders** across the initial set, subject to actual access; these are *targets*, not interviews already booked:

| Segment | Target interviews | Buyers to prioritize | Operators to include |
| --- | ---: | --- | --- |
| ISO / merchant services | 8–12 | CEO, COO, VP Operations | Onboarding lead, Sales/Agent Manager |
| POS reseller / provider | 4–7 | Founder, GM, COO | Deployment/activation lead |
| PayFac / software-led provider | 3–6 | COO, VP Product/Payments | Product operations, integration/security |
| **Total target** | **15–25** | | |

Aim to speak to **both** an economic buyer and a daily operator where possible. Distinguish 20 people at one company from 20 independent companies. Track unique-company evidence in private records.

Sampling: Include a mix of incumbents, spreadsheet-heavy teams, recent migrations, growing and stable operations, and some prospects who **do not** see the problem. Avoid recruiting only people already asking for new software.

## 4. Screener (5 minutes; used before booking)

1. Which best describes the company: ISO/merchant services; POS provider/reseller; PayFac/embedded payments; other?
2. What is your role and which merchant/agent/sales processes do you influence?
3. Do you participate in selecting, administering, or using business software?
4. How many active people work in lead, merchant, agent and onboarding workflows (rough range)?
5. Is merchant onboarding performed internally, outsourced to processors, or mixed?
6. Which systems are already used? (Do not request credentials or private customer details.)
7. Are you willing to discuss one recent workflow using **redacted or synthetic** examples?
8. May we contact you about a follow-up concept review? (Separate permission.)

Exclude vendor employees posing as buyers, end merchants who are not buying our B2B platform, and prospects whose needs require native card-data handling or payout processing before security review.

## 5. Interview session plan (35–45 minutes)

| Minutes | Section | Goal |
| ---: | --- | --- |
| 0–3 | Context and consent | Set scope, privacy and recording rules |
| 3–8 | Company/role overview | Understand actual work and software stack |
| 8–20 | Recent concrete process | Walk through last completed or delayed merchant onboarding |
| 20–30 | Current pain and attempted workarounds | Frequency, impact, costs, existing tools and gaps |
| 30–37 | Buying/validation constraints | Budget holder, switching, security, must-have integrations |
| 37–42 | Optional concept test after unbiased discovery | Evaluate a bounded CRM + tracking prototype |
| 42–45 | Summary, follow-up consent and next step | Confirm facts and potential paid pilot fit |

For a 30-minute call, shorten role/context and avoid racing through discovery. If time runs out, prioritize real recent workflows over our feature pitch.

## 6. Neutral opening statement

"Thanks for speaking with us. We're researching how companies manage leads, agents and merchant onboarding. This is a product discovery interview, not a sales presentation. You can skip any question. Please avoid sharing customer names, sensitive payment or identity information, credentials or confidential processor materials. We will take notes; we will only record if you separately agree. Is it okay to proceed?"

If recording is intended, request explicit permission in a separate question and comply with applicable laws/organizational rules. If declined, do not record and continue with permitted notes.

## 7. Interview method and anti-bias rules

- Ask about a **specific recent event**, not hypotheticals like "Would automation help?"
- Never lead with "our all-in-one platform will save you time".
- Ask what works well in existing software; seek counterexamples to our assumptions.
- Let respondents describe their tools before suggesting alternatives.
- Differentiate individual frustration from an actual approved organizational buying need.
- Ask for frequency and measurable consequences; do not invent savings or monthly merchant volumes.
- Record **direct factual statement**, **anonymized quote if consented**, and **our interpretation** in separate fields.
- Use "why", "when last", "what happened next", "who resolved it", "how long" as probes.
- Present the concept **after** the experience/pain section so it does not contaminate answers.
- Never promise a product feature, certification, processor integration or delivery date.

## 8. Core interview guide

Use the detailed [question bank](interview-question-bank.md), selecting 10–16 questions per interview rather than asking every question. Follow the respondent's experience.

**Workflow prompts**
- "Can you walk me through the last merchant application your team handled, from lead to activation?"
- "Which systems did you open at each step, and who updated the status?"
- "What happened the most recent time an application stalled?"

**Impact prompts**
- "How often did that happen in the past month or quarter?"
- "What was the cost in staff time, rework, escalations or lost business? If unknown, that's okay."
- "What have you already tried to change, and why did it or didn't it work?"

**Incumbent and tradeoff prompts**
- "What do you like about your current CRM/processor portals?"
- "What would be lost if you switched? What cannot change?"
- "Which of these capabilities are mandatory to pay for a new product?"

**Economic buyer prompts**
- "Who approves a paid tool? How does procurement/security review work?"
- "What budget or actual spend can you share, if any?"
- "What would need to be true for you to approve a small paid pilot?"

## 9. Concept-test procedure (last, optional)

After discovery, present **one** short, neutral proposition:

"A system where staff track leads, agents, merchants and onboarding steps, assign owners and reminders, and see statuses in one view. The first version would not directly board merchants with processors or calculate/pay residuals."

Ask:
1. What is missing for this to fit your actual work?
2. What parts would duplicate your existing system?
3. How would you compare the current workflow with this?
4. Would a limited tracking product have stand-alone value without processor integration? Why or why not?
5. What would you need to test before considering payment? Who approves?

Record negative answers and must-have features. Do not equate polite interest with purchase intent.

## 10. Evidence fields and rigor

For each interview, use [interview-note-template.md](interview-note-template.md) in a **private location**, not in this public repo. The public repo may contain only the blank template and anonymized aggregates.

Minimum private record fields: anonymous interview ID, segment, job role (general), buyer/champion status, date and consent status, stack, recent workflow, pain episode, frequency, consequence, current workaround, competitor strengths, missing capabilities, switching barrier, must-have integration, decision process, pilot fit, evidence strength, and follow-up permission.

For every hypothesis store:
- **SUPPORTED:** Concrete recent incident and repeated/potentially material impact.
- **CONTRADICTED:** Current tools solve the issue, buyer uninterested, or a mandatory feature is excluded from MVP.
- **UNKNOWN:** Speculation, no quantification, or no decision-maker evidence.

A competitor's product page **never** counts as a customer interview.

## 11. Preliminary evidence strength rubric

- **0 — Assertion:** Vague preference; no example, role authority or event.
- **1 — Example:** First-hand incident described but frequency/cost unverified.
- **2 — Repeated pattern:** Multiple recent instances and identifiable impact or workaround.
- **3 — Strong evidence:** Repeated incidents, measured impact, appropriate buyer, and concrete paid pilot/procurement action.

This is an analytical aid, not a statistically validated model. Score negative and positive evidence using the same standards.

## 12. Pilot-readiness criteria

Potential pilot requires:
- A named organizational sponsor or buyer who can authorize spend.
- An identified champion and at least one actual user workflow.
- Agreement on 2–3 measurable success criteria and evaluation period.
- Scope and data boundaries compatible with our initial MVP.
- Agreement not to place cardholder account data or identity documents into an unreviewed demo.
- Written next steps and clear procurement/security blockers.
- **Evidence of payment intent:** actual contract process, an approved budget, or a specific paid pilot proposal — not "sounds interesting."

## 13. Product hypothesis failure conditions

Reconsider ISO-first if repeated qualified interviews show:
- Existing tools fully solve the identified problem, and switching has no clear payoff.
- Direct processor boarding/residual processing is mandatory for nearly all willing buyers.
- No credible buyer will pay for tracking-only MVP.
- The integration/security cost is inconsistent with our single-AI-led build strategy.
- POS or PayFac interviews show materially stronger and more feasible demand.

Do not force the interviews to confirm our current decision; a justified pivot is valid progress.

## 14. P0.04 acceptance criteria and exit gate

- [x] ISO, POS and PayFac recruiting and screener rules written.
- [x] Opening consent and privacy controls written.
- [x] Neutral interview agenda and question bank.
- [x] Outreach and post-interview templates.
- [x] Private evidence capture format, score rubric and validation workflow.
- [x] AI versus owner responsibilities documented.
- [ ] Product owner reviews/approves the interview protocol and outreach copy.
- [ ] Product owner selects initial organization types / prospective contacts for outreach.
- [ ] Interview execution is scheduled and tracked truthfully; actual results not fabricated.

**Status:** IN PROGRESS. Approval of the playbook, rather than completing all 15–25 interviews, is the documentation gate for P0.04. Customer discovery/validation continues under subsequent P0 sub-phases; actual evidence is essential before commercial launch commitments.
