# Better Proposals POC Test Script

## Test objective

Prove that approved sample content can create a Better Proposals draft, that JG can review it before delivery, and that the final proposal can be sent to and signed by the recipient entered in the intake form.

## Test 1: Connection and discovery

- [ ] Start the POC server in live mode.
- [ ] Open the browser interface.
- [ ] Confirm account discovery runs automatically without displaying Better Proposals configuration fields in the intake form.
- [ ] Confirm that templates are returned.
- [ ] Confirm that document types are returned.
- [ ] Confirm that currencies are returned.
- [ ] Confirm that brands are returned or note an endpoint limitation.
- [ ] Confirm that custom merge tags are returned.
- [ ] Confirm that no API token is visible in browser tools or output.

Pass condition: the server verifies configured template `744153` and required account settings, and the sidebar connection status becomes `Ready`.

## Test 2: Draft creation

- [ ] Enter the intended recipient email, then select `Fill form with dummy data`. Confirm the email is preserved and all required intake and proposal content is populated.
- [ ] Confirm the recipient first name and required last name are correct before creating a draft.
- [ ] Preview the Better Proposals request and confirm every intake and proposal source field is populated; the automated test separately verifies all 23 custom merge-tag values are nonblank.
- [ ] Confirm the dummy material rows show plausible quantities, unit prices, line totals, and a CAD 152,500 material subtotal.
- [ ] Confirm 1,700 dummy labour hours at CAD 75/hour produce a CAD 127,500 labour total and CAD 280,000 combined subtotal.
- [ ] Add, edit, and remove a material row; confirm its line total and subtotal recalculate immediately.
- [ ] Confirm the backend is using template `744153` and the intended server-side settings.
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
- [ ] Confirm the selected estimate organization is shown.
- [ ] Confirm client-visible specifications are clear and persuasive.
- [ ] Confirm material and labour pricing appear separately.
- [ ] Confirm the labour hours, CAD 75 hourly rate, labour total, and combined estimate are correct in the pricing summary.
- [ ] Confirm every material description, quantity, unit, unit price, line total, and subtotal matches the intake form.
- [ ] Confirm allowances and quote-pending items are clearly identified.
- [ ] Confirm pricing and total.
- [ ] Confirm assumptions, exclusions, and options.
- [ ] Confirm there are no visible raw merge tags.
- [ ] Confirm the Digital Signature block exists.
- [ ] Confirm the entered recipient is eligible or required to sign.
- [ ] If a native pricing table is being tested, confirm its source rows, quantities, options, tax, and calculated total match the approved estimate exactly.

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
