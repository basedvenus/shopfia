# Service drafting connection

Create an AI Gateway API key in the ShopFia Vercel team. Set a small spending limit on the key before testing. Add AI_GATEWAY_API_KEY to the server-only local .env.development.local file and to Vercel environment variables when ready to deploy. Never use NEXT_PUBLIC_ for this key or paste it into chat. Restart the local server after setting it.

Optional SERVICE_DRAFT_AI_MODEL overrides the default openai/gpt-4.1-mini Gateway model.

Try: “I rent portable poles. Four hours is $100, one day is $175. Delivery is quoted separately.” Review the draft, apply it to the form, finish missing fields, and save explicitly. AI never saves or publishes.

No live provider call has been made without a credential. Tests mock the provider. The endpoint uses existing account/IP rate limiting (10 requests per user/hour, 20 per IP/hour); this app limiter is process-local, so a key-level budget is also recommended before public rollout.
