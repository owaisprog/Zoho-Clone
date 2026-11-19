# Contributing to Zoho Clone (internal synthetic-only)

The roadmap of record is the owner's 225-page Express.js PDF, P0-P17.
Use the 14 **original** P3 IDs from its pages 24-29. Older PR labels
P3.01–P3.22 were engineering work batches, not official roadmap gates.

1. Create an issue and a feature branch. Do not commit directly to main.
2. Make the smallest reviewable change; reference original phase + test evidence.
3. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
4. Keep fictional `example.com` records only. No API keys, customer/merchant
   identities, account, card, banking or employee records.
5. Use PR review, check the test logs, document all known gate failures.
6. The owner approves merges, providers, cloud accounts and any staging spend.

Require GitHub branch protection manually: require PR and required status checks
for the main branch, disallow force pushes and bypasses. CODEOWNERS alone
does not configure branch protection.

P3 preview URLs and health endpoints are NOT an authorization or production
readiness certificate. The 727 mapped P1 cases remain future release gates.
