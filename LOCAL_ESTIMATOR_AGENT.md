# Local Estimator Agent Contract

The intake form can send Sections 1–2 directly from the browser to an estimator agent running on the same Mac or through an HTTPS tunnel. The local agent fills Section 3 only. It must never create, approve, or send a Better Proposals document.

## Browser workflow

1. Select `Local estimator agent` under `Estimate test source`.
2. Enter the local endpoint, defaulting to `http://127.0.0.1:8788/estimate`.
3. Select `Fill intake with dummy data`. This fills Sections 1–2 and clears Section 3.
4. Select `Generate Section 3 with local agent`.
5. Review the generated estimate before releasing a Better Proposals draft for JG review.

The browser saves both intake and generated values locally. A connection failure does not clear the form, and the agent request can be retried.

## Request

The endpoint receives `POST multipart/form-data` with:

- `request`: JSON text containing the project, intake, and estimating rules.
- `photographs`: zero or more uploaded photograph files.

Example `request` value:

```json
{
  "schemaVersion": "1.0",
  "project": {
    "intakeId": "VST-BP-POC-DUMMY-001",
    "revision": "1",
    "name": "TEST ONLY - Harbour View Condo Renovation",
    "siteAddress": "123 Sample Street, Vancouver, BC"
  },
  "intake": {
    "siteNotes": "...",
    "measurements": "...",
    "photoNotes": "...",
    "photographs": [{ "name": "kitchen.jpg", "size": 123456, "type": "image/jpeg" }],
    "clientObjectives": "...",
    "clientConstraints": "..."
  },
  "estimatingRules": {
    "currency": "CAD",
    "laborHourlyRate": 75,
    "targetProjectValue": "over 50000 CAD",
    "requireHumanReview": true
  }
}
```

## Successful response

Return `application/json` with this structure:

```json
{
  "proposal": {
    "summary": "Client-facing proposal summary.",
    "scope": "Detailed scope of work.",
    "estimateGrouping": "room",
    "specifications": "Client-visible specifications.",
    "materialLineItems": [
      {
        "area": "Kitchen",
        "name": "Kitchen cabinetry",
        "quantity": 1,
        "unit": "lump sum",
        "unitPrice": 58000
      }
    ],
    "laborEstimate": { "hours": 420 },
    "allowances": "Included allowances.",
    "quotePending": "Items requiring supplier or trade quotations.",
    "pricingNotes": "Commercial pricing notes.",
    "total": "CAD $89,500 before GST",
    "assumptions": "Estimate assumptions.",
    "exclusions": "Estimate exclusions.",
    "options": "Optional upgrades."
  },
  "warnings": [],
  "missingInformation": []
}
```

`estimateGrouping` must be `room`, `trade`, `phase`, or `apartment`. Material units must be `each`, `sq ft`, `linear ft`, `allowance`, or `lump sum`. The form always applies the approved CAD 75 hourly labour rate; the agent supplies labour hours.

For an error, return an appropriate HTTP status with JSON such as:

```json
{ "message": "Measurements are insufficient to estimate flooring." }
```

## Browser connectivity

The local service must allow the deployed Vercel origin through CORS and accept multipart requests. Depending on browser private-network and mixed-content policies, an HTTPS Vercel page may not be allowed to call a plain HTTP LAN endpoint. If localhost is blocked, expose the agent through a narrowly scoped HTTPS tunnel and restrict it to the Vercel origin. Do not place the Better Proposals API token in the browser or local-agent response.

