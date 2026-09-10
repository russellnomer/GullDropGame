---
name: Shared API routing
description: How the Gull Drop web artifact reaches the workspace API service.
---

Use same-origin `/api` requests from Gull Drop even though the API server is registered as a separate artifact.

**Why:** The Replit artifact proxy routes `/api` to the shared API workflow; a live checkout probe confirmed this works while keeping browser code independent of development domains.

**How to apply:** Keep browser API clients generated from the OpenAPI server URL `/api`. Never hardcode a development host or localhost into client code.