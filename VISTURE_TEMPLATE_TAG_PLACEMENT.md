# Visture Proposal Template — Merge Tag Placement

The edited DOCX places the current POC tags in this order:

| Proposal section | Merge tags |
|---|---|
| Cover and project metadata | `{{project_name}}`, `{{site_address}}`, `{{first_name}} {{surname}}`, `{{created_date}}`, `{{owner_first_name}} {{owner_surname}}` |
| Project introduction | `{{proposal_summary}}` |
| Client priorities | `{{client_objectives}}`, `{{client_constraints}}` |
| Scope of work | `{{scope_of_work}}` |
| Client-visible specifications | `{{client_specifications}}` |
| Detailed estimate | `{{estimate_grouping}}`, `{{material_pricing}}`, `{{material_subtotal}}`, `{{labour_pricing}}`, `{{labour_hours}}`, `{{labour_hourly_rate}}`, `{{labour_total}}`, `{{estimate_subtotal}}` |
| Allowances and pending quotations | `{{allowances}}`, `{{quote_pending_items}}` |
| Investment | `{{pricing_summary}}`, `{{proposal_total}}` |
| Commercial terms | `{{assumptions}}`, `{{exclusions}}`, `{{options}}` |
| Internal reference | `{{intake_reference}}` |

The recipient, created-date, and owner tags are Better Proposals built-in tags. All other tags in this table are custom tags used by the POC backend.

The DOCX is a placement guide. Better Proposals native pricing blocks and the Digital Signature block must still be added or verified inside the Better Proposals editor.
