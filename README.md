# Visture Better Proposals Proof of Concept

## Purpose

This package tests the most important workflow in JG's investigation brief:

1. Capture a simple site intake.
2. Prepare test proposal content.
3. Create a branded Better Proposals draft through the API.
4. Hold the document for JG's final review.
5. Let an authorized human send it to the test recipient entered in the intake form.
6. Observe sent, opened, and signed activity for later GoHighLevel updates.

The intake is intentionally limited to:

- Site notes, entered by typing or in-browser voice dictation
- Measurements
- Photographs
- Client objectives
- Client constraints

## Important platform finding

The public Better Proposals API documents proposal creation and proposal-status reads. Its published API does not document actions for requesting approval, approving, or sending a proposal. The current Better Proposals Zapier app also lists `Create a Proposal` as its proposal write action, not a send action.

For that reason, this POC follows a safe and supportable boundary:

- Automated: account discovery, merge-tag mapping, draft creation, and an on-page content preview.
- Recorded in this page: JG's internal review decision and notes, stored in the current browser only.
- Manual in Better Proposals: native request approval, native Manager Approval, and Send Document.
- Automated later: status events back to GoHighLevel using Zapier triggers or polling.

This boundary also satisfies the brief's requirement that no proposal be sent without human approval.

## Better Proposals plan requirement

- Premium: API/Zapier and custom merge tags. This is enough to create the draft, but JG review is a manual operating step.
- Enterprise: everything above plus native Manager Approvals and advanced permissions. Use this when a formal approval block inside Better Proposals is required.

Even with Manager Approvals, Better Proposals' documented flow requires an authorized user to click `Send Document` after approval. Approval does not itself send the proposal.

## Files

- `server.js` - local server and Better Proposals API connector.
- `public/index.html` - simplified intake and guided POC interface.
- `.env.example` - environment-variable template. It contains no real secret.
- `BETTER_PROPOSALS_SETUP_CHECKLIST.md` - exact account items needed.
- `TEMPLATE_MAPPING.md` - custom merge-tag and template design.
- `TEST_SCRIPT.md` - acceptance-test steps for JG and the entered test recipient.
- `sample-create-draft-request.json` - sample payload shape.
- `test.js` - automated mock-mode safety test.

## Run in mock mode

Mock mode proves the local workflow without touching Better Proposals.

```bash
node server.js
```

Open:

```text
http://localhost:8787
```

Then:

1. Select `Fill form with dummy data`.
2. Select `Test connection and discover account`.
3. Choose the mock template.
4. Check the three release confirmations.
5. Select `Create Better Proposals draft`.
6. Review the on-page content preview and record a test JG review decision.

No email or external write occurs in mock mode.

## Run in live mode

Requires Node.js 18 or newer.

1. Copy `.env.example` to `.env`.
2. Set `BP_MODE=live`.
3. Add the Better Proposals API token to `BETTER_PROPOSALS_API_TOKEN`.
4. Start the server with `node server.js`.
5. Open `http://localhost:8787`.
6. Enter and confirm the intended test recipient email.
7. Use `Test connection and discover account` before creating a draft.

Do not paste the API token into ChatGPT, the browser form, source code, screenshots, email, or GoHighLevel fields. Store it only in the server-side `.env` file or a secure secret manager.

## Deploy to Vercel

The repository includes a Vercel Function adapter in `api/index.mjs` and routing in `vercel.json`. The browser interface remains in `public/` and is served as static content.

1. Push this repository to GitHub and import it into Vercel.
2. Keep the Framework Preset set to `Other` and the Root Directory set to the repository root.
3. In Vercel under `Project Settings > Environment Variables`, add:
   - `BP_MODE` = `live`
   - `BETTER_PROPOSALS_API_TOKEN` = the secret token
   - `BP_API_BASE` = `https://api.betterproposals.io`
4. Apply the token to only the Vercel environments that should be allowed to access the live Better Proposals account.
5. Deploy, then use account discovery before creating a draft.

Never commit `.env`. Vercel Functions have ephemeral local storage, so the local duplicate registry is only a best-effort safeguard per running function instance. For production-grade idempotency, replace it with a durable database before allowing multiple operators or automated draft creation.

## Live acceptance test

1. Load the sample intake and proposal.
2. Discover the Better Proposals account.
3. Select the Visture template, brand, document type, CAD, and GST settings.
4. Confirm that every expected custom merge tag exists.
5. Create the draft.
6. Confirm that the returned document appears in Better Proposals as a draft and has not been sent.
7. Confirm which Better Proposals user owns the API-created draft. This determines how native approval permissions apply.
8. On Enterprise, have the creator select `Request Approval`, then have JG approve it under `Documents > Pending`.
9. On Premium, have JG perform the same review manually without the native approval button.
10. After JG approves, have an authorized user click `Send Document`.
11. Confirm delivery to the entered test recipient.
12. The test recipient opens and signs the test proposal.
13. Confirm Better Proposals reports sent, opened, and signed activity.
14. Add Zapier status triggers only after this core path passes.

## Safety controls built into the connector

- The API token never reaches the browser.
- The server validates the recipient email entered in the intake form.
- The connector creates drafts only.
- There is no approve endpoint.
- There is no send endpoint.
- Page-level JG review records are clearly separated from Better Proposals native Manager Approval and never send a document.
- Duplicate create requests are suppressed using an idempotency key.
- Test records are stored locally in `data/drafts.json`.

## Template limitations to test

The published create-proposal endpoint accepts custom merge-tag values, but it does not document dynamic pricing-table rows, dynamic image insertion, or variable page creation. Therefore, phase one maps scope and pricing into multiline merge tags inside a fixed Visture template.

The live POC must answer:

- Does multiline scope retain useful formatting?
- Does the pricing summary render clearly?
- Can a fixed pricing table be populated acceptably, or must it be edited manually?
- Can optional items be represented as text, or must they be added manually to an interactive pricing table?
- Can project photographs or concept visuals be inserted through a supported method?
- Which user owns an API-created draft, and can that user be forced into JG's Manager Approval path?

These are platform-validation questions, not assumptions made by this code.
