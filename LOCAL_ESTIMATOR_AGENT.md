# Local Estimator Agent Contract

The intake form can send Sections 1–2 directly from the browser to an estimator agent running on the same Mac or through an HTTPS tunnel. The local agent fills Section 3 only. It must never create, approve, or send a Better Proposals document.

## Included Ollama service

This repository now includes a working local service in `local-agent/server.mjs`. It calls Ollama's local structured-output API, validates the response, applies the approved CAD 75 hourly labour rate, and returns Section 3 to the browser. It contains no Better Proposals token and has no create, approve, or send capability.

For the lightweight connectivity test, use `gemma3:1b` with `LOCAL_AGENT_CONNECTIVITY_MODE=true`. Ollama is still called, but if that tiny model returns malformed estimating data, the service substitutes a clearly labelled fictional CAD 115,000 Section 3 so the browser connection can still be proven. On the Mac Studio, use a stronger model and set connectivity mode to `false` so malformed estimates fail validation.

### First-time setup

1. Install and start [Ollama for macOS](https://docs.ollama.com/macos).
2. Pull the connectivity model: `ollama pull gemma3:1b`.
3. Copy `local-agent/.env.example` to `local-agent/.env`.
4. Add the exact Vercel origin to `LOCAL_AGENT_ALLOWED_ORIGINS`. The current deployment is `https://intake-form-chi-dun.vercel.app`.
5. Start the estimator from the repository root: `npm run start:local-agent`.
6. Check `http://127.0.0.1:8788/health`. `ollamaReady` should be `true`.

Run the isolated contract test with `npm run test:local-agent`.

## Browser workflow

1. Select `Local agent (dummy Sections 1–2 only)` under `Estimate test source`.
2. Enter the local endpoint, defaulting to `http://127.0.0.1:8788/estimate`.
3. Select `Fill Sections 1–2 with dummy data`. This fills Sections 1–2 and clears Section 3.
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

The included service responds to private-network preflights and only permits origins listed in `LOCAL_AGENT_ALLOWED_ORIGINS`. Keep it bound to `127.0.0.1` unless a tunnel or secured network design specifically requires otherwise.

## Mac Studio transition

Copy the repository to the Mac Studio, install Ollama, pull the chosen stronger model, and copy `local-agent/.env.example` to `local-agent/.env`. Recommended production-test changes are:

- Set `OLLAMA_MODEL` to the model installed on the Mac Studio.
- Set `LOCAL_AGENT_CONNECTIVITY_MODE=false`.
- Keep the exact Vercel origin in `LOCAL_AGENT_ALLOWED_ORIGINS`.
- Keep `LOCAL_AGENT_HOST=127.0.0.1` when using a local HTTPS tunnel.

Do not paste an SSH password into chat, source files, or `.env`. Enter it only into the interactive SSH password prompt, then configure SSH keys for repeatable access.
