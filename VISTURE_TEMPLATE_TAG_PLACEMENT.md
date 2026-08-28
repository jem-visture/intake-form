# Visture Proposal Template — Merge Tag Placement

The edited DOCX places the current POC tags in this order:

| Proposal section | Merge tags |
|---|---|
| Cover and project metadata | `{{project_name}}`, `{{site_address}}`, `{{first_name}} {{surname}}`, `{{created_date}}`, `{{owner_first_name}} {{owner_surname}}` |
| Project introduction | `{{proposal_summary}}` |
| Client priorities | `{{client_objectives}}`, `{{client_constraints}}` |
| Scope of work | `{{scope_of_work}}` |
| Client-visible specifications | `{{client_specifications}}` |
| Detailed estimate | `{{estimate_grouping}}`, `{{material_pricing}}`, `{{labour_pricing}}`, `{{estimate_subtotal}}` |
| Allowances and pending quotations | `{{allowances}}`, `{{quote_pending_items}}` |
| Investment | `{{pricing_summary}}`, `{{proposal_total}}` |
| Commercial terms | `{{assumptions}}`, `{{exclusions}}`, `{{options}}` |
| Internal reference | `{{intake_reference}}` |

The recipient, created-date, and owner tags are Better Proposals built-in tags. All other tags in this table are custom tags used by the POC backend.

In the Detailed Estimate section, use this compact structure so totals are not repeated:

```text
ITEMIZED MATERIALS
{{material_pricing}}

LABOUR BREAKDOWN
{{labour_pricing}}

MATERIALS + LABOUR SUBTOTAL
{{estimate_subtotal}}
```

The backend still calculates `material_subtotal`, `labour_hours`, `labour_hourly_rate`, and `labour_total`, but those granular tags do not need separate visible rows because the material table and `labour_pricing` already contain the same information.

The DOCX is a placement guide. Better Proposals native pricing blocks and the Digital Signature block must still be added or verified inside the Better Proposals editor.

## Corrections from live draft 2993110

Make these edits directly in template `744153` before the full dummy-data test:

1. Replace `{{owner_first_name {{owner_surname}}` with `{{owner_first_name}} {{owner_surname}}`.
2. Replace the Detailed Estimate pricing block with the compact structure above. This removes the malformed `{{labour_hourly_rate}` tag as well as duplicate subtotal rows.
3. Replace `{{intake_reference}` with `{{intake_reference}}`.
4. Remove the native placeholder pricing table containing “Service Name” rows, or configure it manually. The HTML `material_pricing` table does not populate native Better Proposals pricing-table rows or dashboard totals.
5. Change “Excludes HST” to “Excludes GST” while the backend remains configured for GST at 5%, or intentionally change both the backend and template together if HST is required.
6. Place `{{project_name}}`, `{{site_address}}`, and `{{proposal_summary}}` visibly in the Introduction page; draft 2993110 had an empty cover subtitle and an empty Project Introduction body because those values were not part of the isolated HTML-only payload.
