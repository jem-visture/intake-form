# Visture Better Proposals Template Mapping

## Recommended fixed template structure

1. Cover
2. Client and project introduction
3. Executive summary
4. Client objectives and constraints
5. Detailed scope of work
6. Pricing summary
7. Assumptions
8. Exclusions
9. Options
10. Acceptance and Digital Signature

## Merge-tag placement

| Template location | Merge tag | Source |
|---|---|---|
| Cover title | `{{project_name}}` | Project name |
| Cover subtitle | `{{site_address}}` | Site address |
| Introduction | `{{proposal_summary}}` | AI or sample proposal summary |
| Client context | `{{client_objectives}}` | Standard site intake |
| Client context | `{{client_constraints}}` | Standard site intake |
| Scope section | `{{scope_of_work}}` | Approved scope text |
| Pricing section | `{{pricing_summary}}` | Approved pricing text |
| Pricing total | `{{proposal_total}}` | Approved total |
| Commercial section | `{{assumptions}}` | Approved assumptions |
| Commercial section | `{{exclusions}}` | Approved exclusions |
| Options section | `{{options}}` | Approved options |
| Internal reference | `{{intake_reference}}` | Intake ID |

## Recipient values

Recipient name and email should be sent through the Better Proposals `Contacts` fields rather than custom tags. The recipient must be marked eligible to sign, and the template must contain a Digital Signature block.

## Phase-one pricing design

Use `{{pricing_summary}}` as a multiline block for the initial connection test. This proves that the approved estimate can reach the proposal without depending on undocumented dynamic pricing-table behavior.

After that works, test whether Better Proposals can reliably support:

- Variable numbers of pricing rows.
- Material and labour separation inside interactive tables.
- Client-selectable options.
- Multiple pricing tables by room, trade, or phase.
- Automatic totals that match the estimating output.

The public API documentation does not establish that these dynamic table operations are supported.

## Images

The Better Proposals editor supports manually inserted images. The published API does not document dynamic image upload or placement as part of proposal creation. Keep project photos in the intake or Drive for phase one, and test dynamic proposal images separately.
