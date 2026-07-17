# Content verification AI

TrustLens prefers **Perplexity** for web-grounded media-literacy analysis.

## Provider priority

1. **Official API** — `PERPLEXITY_API_KEY` → `api.perplexity.ai` (`sonar-pro`)  
2. **Cookie mode (experimental)** — website session for **local budget testing only**  
3. **Mock** — offline heuristics  

## Official API (recommended)

```env
PERPLEXITY_API_KEY=pplx-...
# PERPLEXITY_MODEL=sonar-pro
```

Key: [console.perplexity.ai](https://console.perplexity.ai)

## Cookie mode (no API budget — testing only)

> Unofficial browser endpoint. Fragile, may break, may violate ToS.  
> **Never commit cookies. Never use in production.**

1. Log in at https://www.perplexity.ai  
2. DevTools → Network → request to `www.perplexity.ai` → copy **Cookie** header  
3. Either:

```env
PERPLEXITY_COOKIES=paste-cookie-header-here
```

or save the cookie string (one line) to:

```
data/perplexity-cookies.txt
```

4. Restart `npm run dev`  
5. Check engine: `GET http://localhost:8080/api/analyze` → `"provider":"perplexity"`  
   (Public responses never expose that a session bridge is used.)

If Cloudflare blocks or cookies expire, refresh the Cookie from the browser.

## Runtime

Browser → `POST /api/analyze` → server → API / cookies / mock

## Files

| File | Role |
|------|------|
| `types.ts` | Shared types |
| `perplexity.ts` | Official Sonar client |
| `perplexity-cookie.ts` | Unofficial web SSE (local testing) |
| `analyze.server.ts` | Provider selection |
| `analyze.ts` | Client helper |
| `analyze-handler.ts` | HTTP `/api/analyze` |
| `mock-analyze.ts` | Offline heuristics |
