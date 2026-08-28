# AI-Driven Estimating and Proposal Workflow — POC Alignment

This audit maps the current Better Proposals proof of concept to the investigation brief supplied by Visture. It distinguishes implemented behavior from simulated content and future production work.

## Current phase-one coverage

| Brief requirement | Current POC status | Evidence or limitation |
|---|---|---|
| Standard site intake | Partial | Captures typed or browser-dictated notes, measurements, photographs, client objectives, and constraints. Per the current UI decision, photographs are the only uploaded files; other source information is entered as text. |
| Flag missing information | Implemented for required POC fields | Draft validation blocks incomplete project, recipient, intake, proposal, template, discovery, and review-confirmation fields. Production estimating will need more detailed completeness rules by project type. |
| AI estimate using approved Visture rules | Not implemented | Phase one uses clearly labelled fictional estimate and scope content. Approved labour rates, markups, pricing rules, historical costs, and the Project Estimator GPT configuration are not yet available in this repository. |
| Detailed estimate by apartment, room, trade, or phase | Partial | The POC captures the selected organization and maps multiline estimate content. It does not yet generate structured variable-length rows or quantities with AI. |
| Separate material and labour | Partial | Separate multiline material and labour inputs and merge tags are implemented. Approved rates, quantities, and AI validation are not. |
| Allowances, options, exclusions, quote-pending items | Partial | Each category is captured separately and mapped to the proposal, but the values remain manually entered test content. |
| Client-visible specifications | Partial | A dedicated specifications field and merge tag are implemented. AI authoring and project-specific validation are not. |
| JG commercial review before progress | Partial | Pre-draft confirmations and a page-level review record exist. The page-level record is stored in the current browser and is not an authenticated production approval. |
| Branded proposal assembly | Implemented for fixed merge-tag content | Uses Better Proposals template, brand, cover, document type, currency, tax, contacts, and custom merge tags. |
| Optional AI concept visuals | Not implemented | Photograph selection is local metadata only. No image generation, upload, or Better Proposals placement workflow exists. |
| Better Proposals draft only | Implemented | The connector exposes draft creation and status reads, with no send endpoint. |
| Final JG review and native approval | Partial | The POC links back to the created document. Better Proposals native Manager Approval remains a manual account action because it is not exposed by the published API. |
| Electronic signature | Template dependency | The Better Proposals template must include an Acceptance/Digital Signature block. The POC does not send the document. |
| Proposal events back to GoHighLevel | Not implemented | Sent, opened, signed, and completed event mapping still requires API/Zapier/webhook verification. |
| Signed PDF archive in Google Drive | Not implemented | Requires a post-signature event, Drive destination rules, and durable project identifiers. |
| CoConstruct handoff after sale | Not implemented | Intentionally outside this connection POC. |
| Learning loop from quotes, changes, and actual costs | Not implemented | Requires durable structured estimate data and governance for updating estimating rules. |
| Hermes orchestration | Not implemented | This POC is the ChatGPT/Better Proposals validation step that should inform a later Hermes design. |

## Required Better Proposals validation

Before recommending rollout, test the following with two controlled client proposals:

1. Account discovery returns the intended Visture template, document type, CAD currency, brand, and every required custom merge tag.
2. Multiline scope, specifications, material and labour pricing, allowances, quote-pending items, assumptions, exclusions, and options render cleanly in the actual Better Proposals document.
3. The API-created document remains unsent and is owned by the expected Better Proposals user.
4. JG can complete the intended native Manager Approval workflow, or the Premium manual-review fallback is documented.
5. The selected recipient, signature block, tax settings, and final total are correct.
6. Duplicate and revised-draft behavior is acceptable with durable idempotency added before production.
7. Variable pricing tables, variable-length scope, and dynamic images are either proven or explicitly assigned to manual editing.
8. Sent, opened, signed, and completed events can update the correct GoHighLevel opportunity without duplicate actions.

## Next implementation gate: estimating

Do not describe the current sample proposal content as an AI-generated estimate. The next build phase requires:

- The approved Visture estimating instructions and representative examples from the Project Estimator GPT.
- Labour rates, material pricing sources, markup and margin rules, tax treatment, allowances, contingency, and rounding rules.
- A structured estimate schema supporting apartment, room, trade, and phase groupings.
- Explicit fields for material, labour, allowances, options, exclusions, quote-pending items, specifications, confidence, and source evidence.
- Evaluation against at least two completed estimates before connecting estimate generation to live draft creation.

## Safety boundary

- Creating a draft must remain a deliberate user action after successful account discovery.
- Page-level review is not a substitute for authenticated Better Proposals Manager Approval.
- No page or API route in this POC may automatically approve or send a proposal.
- Signed-document archival and CoConstruct handoff must occur only after verified completion events.
