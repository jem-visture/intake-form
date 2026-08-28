# Visture Better Proposals Template Mapping

## Recommended fixed template structure

1. Cover
2. Client and project introduction
3. Executive summary
4. Client objectives and constraints
5. Detailed scope of work
6. Client-visible specifications
7. Estimate organization and detailed pricing
8. Allowances and quote-pending items
9. Pricing summary
10. Assumptions, exclusions, and options
11. Acceptance and Digital Signature

## Merge-tag placement

| Template location | Merge tag | Source |
|---|---|---|
| Cover title | `{{project_name}}` | Project name |
| Cover subtitle | `{{site_address}}` | Site address |
| Introduction | `{{proposal_summary}}` | AI or sample proposal summary |
| Client context | `{{client_objectives}}` | Standard site intake |
| Client context | `{{client_constraints}}` | Standard site intake |
| Scope section | `{{scope_of_work}}` | Approved scope text |
| Estimate heading | `{{estimate_grouping}}` | Room, trade, phase, or apartment grouping |
| Specifications section | `{{client_specifications}}` | Client-visible finishes and performance details |
| Detailed pricing | `{{material_pricing}}` | Approved material quantities and pricing |
| Detailed pricing total | `{{material_subtotal}}` | Server-calculated material subtotal |
| Detailed pricing | `{{labour_pricing}}` | Approved labour hours, rates, and pricing |
| Labour detail | `{{labour_hours}}` | Estimated total labour hours |
| Labour detail | `{{labour_hourly_rate}}` | Approved hourly labour rate |
| Labour total | `{{labour_total}}` | Server-calculated labour total |
| Estimate total | `{{estimate_subtotal}}` | Server-calculated materials-plus-labour subtotal |
| Commercial section | `{{allowances}}` | Approved selection allowances |
| Commercial section | `{{quote_pending_items}}` | Trade or supplier quotes still required |
| Pricing section | `{{pricing_summary}}` | Approved pricing text |
| Pricing total | `{{proposal_total}}` | Approved total |
| Commercial section | `{{assumptions}}` | Approved assumptions |
| Commercial section | `{{exclusions}}` | Approved exclusions |
| Options section | `{{options}}` | Approved options |
| Internal reference | `{{intake_reference}}` | Intake ID |

## Recipient values

Recipient name and email should be sent through the Better Proposals `Contacts` fields rather than custom tags. The recipient must be marked eligible to sign, and the template must contain a Digital Signature block.

## Phase-one pricing design

The intake form stores each material as a structured row containing area, item name, quantity, unit, unit price, and calculated total. Labour is estimated as total hours multiplied by an hourly rate pre-filled at CAD 75. The server validates and recalculates every material row, the labour total, and the combined estimate rather than trusting browser totals.

Use `{{material_pricing}}` for the generated multiline itemization and `{{material_subtotal}}` for its calculated total. Use `{{labour_pricing}}`, `{{labour_hours}}`, `{{labour_hourly_rate}}`, `{{labour_total}}`, and `{{estimate_subtotal}}` for calculated labour and combined totals. `{{pricing_summary}}` includes those calculated values plus any additional pricing notes. This proves that the approved estimate categories can reach the proposal without depending on undocumented dynamic pricing-table behavior.

After that works, test whether Better Proposals can reliably support:

- Variable numbers of pricing rows.
- Material and labour separation inside interactive tables.
- Client-selectable options.
- Multiple pricing tables by room, trade, or phase.
- Automatic totals that match the estimating output.

The public API documentation does not establish that these dynamic table operations are supported.

### Native pricing-table validation

Better Proposals templates can contain native pricing tables, including multiple tables, quantities, options, and calculated totals. However, the published create endpoint documents template selection and merge-tag values—not pricing-table row creation or updates.

Use this controlled test before relying on native table automation:

1. Add a small native pricing table to a disposable copy of the Visture template.
2. Test whether merge tags are accepted in the supported description, quantity, and price cells.
3. Create one draft with known fictional values and compare every displayed line, tax calculation, option, and total with the source payload.
4. Test a second estimate with a different number of rows. If the template cannot grow or shrink through a documented mechanism, keep the detailed estimate in multiline content and use the native table only for fixed headline totals or manual JG editing.
5. Do not describe dynamic pricing-table mapping as supported until both tests pass without manual correction.

## Images

The Better Proposals editor supports manually inserted images. The published API does not document dynamic image upload or placement as part of proposal creation. Keep project photos in the intake or Drive for phase one, and test dynamic proposal images separately.
