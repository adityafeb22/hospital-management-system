# Security Policy

## Secret Management

This project uses environment variables for all sensitive configuration.
**No secrets are stored in the repository.**

### Environment variables required (never commit these)

| Variable | Where to set it | Description |
|----------|----------------|-------------|
| `JWT_SECRET` | Railway dashboard → Variables | Min 32 chars, random string |
| `SUPABASE_URL` | Railway dashboard → Variables | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Railway dashboard → Variables | Service role key (server-side only) |

### Local development

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Edit .env with your actual values — this file is gitignored
```

`.env` is listed in `.gitignore` and will never be committed.

### Protections in place

- `.gitignore` blocks `.env`, `.env.local`, `*.env` and all variants
- Pre-commit hook detects and blocks accidental secret commits
- GitHub secret scanning + push protection enabled on this repository
- Supabase service key is only used server-side (never exposed to the browser)
- The frontend (`docs/index.html`) only talks to the backend API — no DB credentials in the browser

### Reporting a vulnerability

If you discover a security issue, please do not open a public issue.
Contact the maintainer directly.
