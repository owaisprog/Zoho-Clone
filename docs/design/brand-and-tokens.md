# P2.01 — Original Brand Direction and Design Tokens

**Project:** Zoho Clone (internal repository working name only)  
**Version:** 0.1 — P2.01 owner-review design DRAFT · 2026-11-13  
**Source:** Master Roadmap P2.01 Brand and Design Tokens, P1.03 NFR, P1.04 personas/journeys, P1.05 releases and P1.06 permission matrix.  
**GitHub issue:** [P2.01 #24](https://github.com/owaisprog/Zoho-Clone/issues/24) · [P2 phase plan](p2-phase-plan.md)  
**Current approval:** **P2 started, NOT P2.01 visual signoff.** Colors, typography, product logo, naming, layout density and dark theme are *proposed options for product-owner review*, not final public branding or verified usable software.

## 1. Visual strategy: functional, original, enterprise-grade

**Concept name:** *Workspace OS* is a **descriptive design placeholder**, not an approved company, app name or domain; repository continues to use "Zoho Clone" internally. Before public launch choose a distinct legal/trademark-safe brand and independently designed logo. **Do not copy Zoho's commercial logo, icon family, trade dress, layouts, illustrations or proprietary visual assets.**

**Visual direction:** Calm navy workspace navigation, neutral off-white content canvas, crisp white panels, deep indigo primary controls, semantic green/amber/red/blue status **only where meaningful**, restrained borders and meaningful hierarchy. B2B operators should read dense merchant queues, CRM tables and tasks quickly; visual styling must not distract from ownership, status, next action, permissions and errors.

**Default:** Light content canvas with a darker, clearly structured application sidebar. An optional full dark theme is specified for implementation later. Do not introduce flashy gradients, animated decorative backgrounds, arbitrary dashboard graphs or fake product screenshots. Prefer real table/data density and explicit labels.

**Primary user focus:** ISO operations, sales/agent managers, onboarding staff and owner/admin functions from P1.04—**provisional personas only**, not user-validated. Design for heavy desktop workflows and responsive mobile follow-ups.

## 2. Proposed palette and rationale

| Semantic usage | Light mode value | Dark mode value | Notes |
|---|---|---|---|
| Content canvas | `#F8FAFC` | `#101B2B` | Neutral canvas, not brand color flood |
| Main surface | `#FFFFFF` | `#17263B` | Cards, tables, modals |
| Main text | `#182739` | `#EFF4FC` | High contrast primary data |
| Secondary text | `#526174` | `#BFCBDD` | Labels/meta; visible not washed out |
| Sidebar | `#142337` | `#0B1422` | Consistent global product shell |
| Action background | `#3655A5` | `#A7BEFF` | Indigo active controls |
| Action text | `#FFFFFF` | `#142337` | Explicit accessible pairing |
| Input border | `#70809B` | `#758AA6` | High-visibility essential control outline |
| Focus indicator | `#3655A5` | `#A7BEFF` | 2px outline plus offset and not color alone |
| Success label | `#166447` | `#7FE3B5` | With label/icon and safe status text |
| Warning label | `#795000` | `#FFD280` | Restrained status, not decoration |
| Error label | `#AD2921` | `#FFB0A7` | Icon + message; never only a red outline |
| Information label | `#2A568A` | `#A4C6FF` | External/demo source warnings clearly labeled |

**Optional accent rules:** The only prominent branded accent is the indigo action; status colors are not used for decoration. Marketing pages in P2.03 may propose a related public palette but cannot claim customer counts, traction, processor connectivity, prices or live product visuals.

## 3. Design token source and format

[Machine-readable design_tokens.json](design_tokens.json) contains **154 proposed tokens**, including **36 primitive colors**, **24 light semantic colors**, **24 dark semantic colors**, and typography, spacing, breakpoints, motion, density, radius, sizing, borders, opacity and layering. All **semantic alias references are resolvable within the file** as a structural consistency check.

Proposed structure follows W3C Design Tokens Community Group [2025.10 Format Module](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/) naming (`$value`, `$type`, group hierarchy and `{alias}`) as a *portable design proposal*. **No official token-schema conformance validator or Tailwind build was run.** A future P3 transformer should verify exact format compatibility and compile the tokens into CSS variables and shadcn/Tailwind mappings.

**Future transformer concept (not implemented):**

```text
docs/design/design_tokens.json     // owner-approved source after P2.01 signoff
  -> token resolver/validator       // NOT IMPLEMENTED
  -> shared CSS custom properties   // NOT IMPLEMENTED
  -> Tailwind/shadcn color/type      // NOT IMPLEMENTED
  -> Next.js app shell theme         // NOT IMPLEMENTED
```

No browser runtime or live application consumes this JSON today. These are **design contracts only**, not CSS currently built into the repo.

## 4. Typography and density

- **UI family:** Inter → Arial → system sans-serif. Local availability/use of font needs future approved licensing/asset source review. Do not ship font binaries or claim font loaded.
- **Monospace:** IBM Plex Mono → Consolas → monospace, reserved for code, IDs and safe token previews.
- **Core scale:** 12px captions (with strong text contrast), **14px operational tables and base body**, 16px readable long description, 18px section titles, 24px page headings, 32px public display headlines. Typical line heights 1.3 dense, 1.5 body, 1.2 heading.
- **Weights:** 400 normal, 500 medium, 600 semibold, 700 bold. Do not achieve hierarchy only through color.
- **Density modes:** **Comfortable default** = 44px table row / 44px controls; **Compact** = 36px rows / 36px controls for desktop-heavy CRM and merchant queues. Changing density must not shrink minimum functional keyboard/pointer hit targets below WCAG requirements.
- **Spacing:** 0/2/4/8/12/16/20/24/32/40/48/64px. Main content gutter 16px small screen and 24px desktop. Max content width 1600px; wide reporting pages may use more horizontal space, but never clip controls.
- **Shapes:** Minimal 4/6/10/14/18px corners; 999px pill reserved for bounded semantic chips, never for all containers. Border widths 1px layout and 2px focus/selected states.

## 5. Contrast calculation review (NOT end-to-end compliance)

[27 checked token pairs](color-contrast-review.csv) use the standard relative luminance formula to compare foreground/background RGB pairs. **All 27 sample combinations satisfy their relevant numeric threshold** (text ≥4.5:1 or visually required UI boundary/focus ≥3:1). The lowest sampled result is **4.00:1**, for the light control border against the white surface (UI, not text).

Reference: [WCAG 2.2, SC 1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum) and [SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast). These are **formula-level checks of isolated proposed token pairs**, NOT a statement that the UI meets WCAG, that all possible component/state pairings pass, or that real assistive technologies/browser interactions have been tested.

**Additional real UI requirements:**
- All visible text/background combinations, hover, disabled state, icons, charts, borders and overlays must be checked in browser with actual fonts/anti-aliasing.
- Meaningful icons, field outlines and focus indicators should be ≥3:1 against their actual adjacent colors; focus must be visible around buttons, including indigo buttons.
- Color must not convey status alone. Use readable "Internal — awaiting action", "Unverified demo", "Blocked", and explicit source/date labels with an icon/text.
- Keyboard-only, screen reader, reduced motion, 320px narrow screens, zoom/text spacing and screen orientation must be tested later. P2.16 produces detailed cases; actual automated/manual testing requires runnable UI in P3+.
- Prefer min 24×24px actionable target per WCAG 2.2 target-size minimum, and 40–44px buttons/inputs where space allows. Data-row height is not itself a guarantee that inline icons have accessible hit areas.

## 6. Semantic component and privacy rules

**Navigation:** Dark, stable sidebar with section labels and active state plus text; disabled modules should be explicitly marked "Coming later", not appear selectable. Organization switcher surfaces only organizations from verified active memberships.

**Tables:** On desktop, show merchant/application, internal stage, owner, next action and "last updated" as pinned context; sortable headers with actual accessible state, row selection not color-only, clear counts and permission-safe empty/error states. Mobile shifts to manageable stacked row details or horizontal table with sticky labels—do not hide essential actions.

**Forms:** Primary and secondary actions distinct; label above input; required/optional text; inline error + summary; show field permission/validation errors without exposing hidden data. No raw bank, PAN/CVV, government ID/KYC attachments or processor credential fields in initial merchant CRM screens.

**Status:** Badges carry a label and icon. `active_internal` and `DEMO_ONLY_ACTIVE` **never** display as "Processor approved", "Payments live" or "Charges enabled". Mock billing shows a prominent "Demo plan / no charges" label.

**Buttons:** One primary per view region; danger actions require explicit confirmation and safe recovery. Form-loading states preserve input; concurrent changes show retry/refresh instead of silent overwrite.

**Dark theme:** Same components and navigation; use semantic tokens (not hard-coded hex scattered in JSX); reduced motion and system theme preferences only when implemented and user-selectable.

## 7. Responsive and interaction contract

- **320–639px:** Narrow viewport, mobile navigation rail/drawer, one-column form, horizontally scrolling dense data with sticky context or accessible record list. Do not place entire CRM table in a 320px fixed width.
- **640–1023px:** Two-column/detail drawer layout where feasible, sidebar compact.
- **1024px and wider:** Stable full sidebar, table-first main content, side inspector up to 420px, clear breadcrumb and record actions.
- **1440px and wider:** Constrain forms, use wide canvas for reports/tables; no needlessly stretched body copy.
- **Focus:** Visible 2px ring with 2–3px offset, keyboard-operable tabs/menus/dialogs.
- **Motion:** 120/180/260ms minimal state transitions; reduced-motion preference disables non-essential movement when code exists. No 3D-heavy dashboards or decorative parallax.

## 8. First review examples

See [component-examples.md](component-examples.md) and [static token-preview.html](token-preview.html). The example uses invented merchant/CRM labels and neutral sample numbers, clearly marked **SYNTHETIC DEMO**; no actual user/merchant details or functioning backend. A static preview is **not** a tested Next.js component or deployed prototype.

## 9. Brand and token owner signoff required

- [x] Proposed original light/dark B2B token structure and product typography hierarchy documented.
- [x] 154 token definitions and alias resolution verified by a programmatic local check.
- [x] 27 proposed token pairs computed against WCAG-related formulas; all formula PASS for stated specific pair.
- [x] Dense-table/navigation/status/form sample guidance written.
- [x] Provisional brand identity separated from public legal brand name/domain.
- [ ] **Product owner approves or revises** visual direction, palette, typography, density, light/dark semantics and original brand positioning as a P2.01 design baseline.
- [ ] Owner approval then closes P2.01 #24 and opens **P2.02 Information Architecture**. Any actual UI usability/browser a11y evidence remains pending.

**P2.01 state: IN PROGRESS, owner approval pending. No runtime UI, test pass or external/customer data use is claimed.**
