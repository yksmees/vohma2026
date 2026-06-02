# Deploy (GitHub + Netlify + Supabase)

## 1) GitHub
Uploadi repo juurika alla:
- frontend/
- netlify/
- sql/
- package.json
- netlify.toml
- README.md
- DEPLOY.md

## 2) Supabase
Project Settings → API:
- Project URL → SUPABASE_URL
- service_role key (või secret key) → SUPABASE_SERVICE_ROLE_KEY

SQL Editor:
- käivita sql/schema.sql
- käivita sql/leaderboard_rpc.sql

## 3) Netlify
Import from GitHub, publish directory `frontend`, build command `npm install`.

Environment variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- JWT_SECRET

Uus deploy käivitub automaatselt commitiga.

## 4) Kontroll
- /.netlify/functions/api/health
- Logi sisse, vaated ilmuvad pärast sisselogimist.
