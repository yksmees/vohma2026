# Railway deploy juhend

See pakett on tehtud Railway jaoks. Supabase andmebaas jääb samaks.

## 1. GitHub

Lae selle ZIP-i sisu oma GitHub reposse.

Repo juurikas peab sisaldama:
- `frontend/`
- `sql/`
- `server.js`
- `package.json`
- `railway.json`
- `nixpacks.toml`
- `.env.example`
- `RAILWAY_DEPLOY.md`

## 2. Railway import

1. Mine Railway lehele
2. Vajuta **New Project**
3. Vali **Deploy from GitHub repo**
4. Vali see repo
5. Railway tuvastab Node.js rakenduse automaatselt
6. Build command: `npm install`
7. Start command: `npm start`

Kui Railway küsib builderit, vali **Nixpacks**.

## 3. Environment variables Railways

Railway projektis mine:
**Variables** → **New Variable**

Lisa need:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
API_FOOTBALL_KEY
```

### SUPABASE_URL
Supabase → Project Settings → API → Project URL

Peab olema kujul:

```txt
https://xxxx.supabase.co
```

Ilma `/rest/v1/` lõputa.

### SUPABASE_SERVICE_ROLE_KEY
Supabase → Project Settings → API → service_role key

### JWT_SECRET
Pane pikk juhuslik tekst, näiteks:

```txt
muuda-see-pikk-random-secret-2026
```

### API_FOOTBALL_KEY
API-Football / API-Sports dashboardist tasuta API võti.

## 4. Supabase SQL

Kui andmebaas on juba olemas ja töötab, ära kustuta midagi.

Kui sul on juba vanem tabel olemas, käivita Supabase SQL Editoris vajadusel need failid:
- `sql/fix_location_column.sql`
- `sql/api_football_result_sync_migration.sql`

Kui alustad täiesti tühjalt:
- `sql/schema.sql`
- `sql/leaderboard_rpc.sql`
- `sql/fix_location_column.sql`
- `sql/api_football_result_sync_migration.sql`

## 5. Deploy

Kui muutujad on lisatud:
1. Railway teeb deploy automaatselt
2. Kui vaja, vajuta **Redeploy**
3. Ava Railway antud domeen

Test:

```txt
https://SINU-RAILWAY-DOMEEN.up.railway.app/api/health
```

Õige vastus on umbes:

```json
{"ok":true,"time":"..."}
```

## 6. Custom domain Zone.ee domeeniga

Soovitus: kasuta alamdomeeni, näiteks:

```txt
ennustus.sinudomeen.ee
```

Railway:
1. Ava service
2. Settings → Networking
3. Custom Domain
4. Lisa `ennustus.sinudomeen.ee`
5. Railway annab DNS kirjed

Zone.ee:
1. Mine DNS haldusesse
2. Lisa Railway antud CNAME kirje
3. Lisa Railway antud TXT kirje, kui Railway seda küsib
4. Oota DNS valideerimist
5. Railway teeb HTTPS sertifikaadi automaatselt

## 7. Oluline

Railway kasutab `process.env.PORT` porti. `server.js` juba kasutab seda, seega lisamuudatust pole vaja.

Rakenduse loogikat ei ole Railway jaoks muudetud:
- logimine jääb samaks
- admin jääb samaks
- Supabase jääb samaks
- API-Football sync jääb samaks
- Teiste ennustused vaade jääb samaks


## Kui Railway ütleb "Missing env var: SUPABASE_URL"

Selles paketis on Supabase URL fallbackina server.js failis sees, sest URL ei ole salajane võti.

Kontrollimiseks ava:
`/api/debug/env`

Vastus peab näitama:
```json
{
  "supabase_url": "OK",
  "supabase_key": "OK",
  "jwt_secret": "OK"
}
```

Kui `supabase_key` on `MISSING`, kontrolli Railway Variables all:
- `SUPABASE_SERVICE_ROLE_KEY`
või
- `SUPABASE_SERVICE_ROLE`


## Railway Node 20 WebSocket fix

Railway kasutab Node 20 ning Supabase Realtime võib selles keskkonnas vajada `ws` paketti.
Selles paketis on:
- lisatud dependency `ws`
- lisatud `import WebSocket from "ws"`
- seadistatud Supabase `realtime.transport`

Kui varem tuli error:
`Node.js 20 detected without native WebSocket support`
siis see pakett parandab selle.


## Viimased UI muudatused
- Edetabelis on positsiooni muutuse nooled, esimesel kohal kroon ja viimasel kohal konn.
- Teiste ennustused vaates eemaldati Alagrupp / etapp ja Asukoht ja aeg read.
- Teiste ennustused värvid arvutatakse nüüd mängu tegeliku lõpptulemuse ja kasutaja ennustuse järgi.
- Õige tulemus rida on erksam ja bold.


## Admin vaate muudatused
- Lisatud mängu kustutamine dropdown-listist.
- Kustutamisel eemaldatakse ka selle mängu ennustused.
- Uue mängu lisamisel pole enam etapi välja. Etapiks pannakse automaatselt `Lisatud mäng`.
- Admini kuupäevaväljad kasutavad formaati `DD:MM:YY` ja kellaaeg `HH:MM`.
- Lisatud admin juhend.


## Viimased kasutajate ja edetabeli muudatused
- Login annab vale parooli korral selge teate.
- Admin vaates mängija lisamisel kasutatakse ainult username välja, nimi eemaldatud.
- Admin kasutajaid ei arvestata edetabelis ega teiste ennustuste vaates.
- Edetabelis on koha numbrid.
- Teiste ennustused vaates on kasutajad tähestiku järjekorras.


## Admin screenshot vaade
Admin vaates on eraldi plokk `Teiste ennustused screenshotiks`.
See näitab ühte valitud lõppenud mängu, õiget tulemust ja mitte-admin kasutajate ennustusi tähestiku järjekorras.
Vaikimisi valitakse uusim lõppenud mäng.


## Admin screenshot vaade mitme mänguga
Admin screenshot plokis saab nüüd valida ühe mängu või märkida `mitu mängu kõrvuti`.
Mitme mängu vaates kuvatakse valitud arv viimaseid lõppenud mänge kõrvuti, vanem vasakul ja uuem paremal.
