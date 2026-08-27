# Better Proposals POC Test Script

## Test objective

Prove that approved sample content can create a Better Proposals draft, that JG can review it before delivery, and that the final proposal can be sent to and signed by the recipient entered in the intake form.

## Test 1: Connection and discovery

- [ ] Start the POC server in live mode.
- [ ] Open the browser interface.
- [ ] Select `Test connection and discover account`.
- [ ] Confirm that templates are returned.
- [ ] Confirm that document types are returned.
- [ ] Confirm that currencies are returned.
- [ ] Confirm that brands are returned or note an endpoint limitation.
- [ ] Confirm that custom merge tags are returned.
- [ ] Confirm that no API token is visible in browser tools or output.

Pass condition: the Visture template and required account settings can be selected without manually hard-coding every ID.

## Test 2: Draft creation

- [ ] Select `Fill form with dummy data` and confirm all required intake and proposal content is populated.
- [ ] Select the Visture template and settings.
- [ ] Confirm the entered test recipient email is correct.
- [ ] Check all three release confirmations.
- [ ] Create the draft.
- [ ] Confirm that the API returns success.
- [ ] Confirm the proposal appears in Better Proposals.
- [ ] Confirm the proposal has not been sent.
- [ ] Run the same create action again.
- [ ] Confirm the POC returns the existing draft instead of creating a duplicate.

Pass condition: exactly one unsent Better Proposals draft exists for the test revision.

## Test 3: Template rendering

- [ ] Review the on-page content preview returned after draft creation.
- [ ] Open the Better Proposals review link and compare it with the on-page content preview.
- [ ] Open the created draft.
- [ ] Confirm the Visture brand and cover.
- [ ] Confirm the project name and address.
- [ ] Confirm the proposal summary.
- [ ] Confirm objectives and constraints.
- [ ] Confirm the full scope.
- [ ] Confirm pricing and total.
- [ ] Confirm assumptions, exclusions, and options.
- [ ] Confirm there are no visible raw merge tags.
- [ ] Confirm the Digital Signature block exists.
- [ ] Confirm the entered recipient is eligible or required to sign.

Pass condition: the draft is client-presentable after normal JG review and minor edits.

## Test 4: JG approval control

- [ ] Record JG's page-level approval or request-for-changes decision.
- [ ] Confirm the page states that this decision does not perform Better Proposals native approval.

### Enterprise

- [ ] Confirm the API-created draft is owned by a user who requires JG approval.
- [ ] Creator selects `Request Approval`.
- [ ] JG receives the approval notice.
- [ ] JG can approve or deny under `Documents > Pending`.
- [ ] Confirm the document cannot be sent while denied or awaiting approval.
- [ ] JG approves the final version.

### Premium fallback

- [ ] JG reviews the draft manually.
- [ ] Confirm the POC and integration have no send endpoint.
- [ ] Confirm only an authorized Better Proposals user can perform the send.

Pass condition: the intended workflow cannot send the proposal without JG's review.

## Test 5: Delivery and signature

- [ ] Authorized user clicks `Send Document` after approval.
- [ ] The entered recipient receives the email.
- [ ] The entered recipient opens the proposal.
- [ ] Better Proposals records the open event.
- [ ] The entered recipient signs the proposal.
- [ ] Better Proposals records the signed event.
- [ ] Confirm the signed document is locked as expected.

Pass condition: the full customer-facing send, open, and signature path succeeds.

## Test 6: Status events for GoHighLevel

- [ ] Create Zapier triggers for Proposal Sent, Proposal Opened, and Proposal Signed.
- [ ] Send test data to a safe test endpoint or test GoHighLevel record.
- [ ] Confirm the Better Proposals document ID and status can be stored.
- [ ] Confirm duplicate events do not create duplicate tasks or records.

Pass condition: the events needed for GoHighLevel follow-up are available and reliable.
