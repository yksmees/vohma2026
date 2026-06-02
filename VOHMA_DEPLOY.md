# Võhma Lihakombinaadi ennustusvõistlus, MM 2026

See on eraldi puhas Railway deploy pakett uue lehe jaoks.

## Mis on muudetud
- Veebilehe nimi: `Võhma Lihakombinaadi ennustusvõistlus, MM 2026`
- Logimise aknasse lisatud uus Võhma Lihakombinaadi logo
- Rakenduse loogikat ei muudetud
- Lisatud SQL fail mitte-admin kasutajate kustutamiseks

## Railway env variables

Lisa uuele Railway teenusele:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
API_FOOTBALL_KEY
```

## Kui kasutad täiesti uut Supabase andmebaasi

Käivita Supabase SQL Editoris järjest:

```txt
sql/schema.sql
sql/leaderboard_rpc.sql
sql/fix_location_column.sql
sql/api_football_result_sync_migration.sql
```

Seejärel loo admin konto `/api/setup/admin` kaudu.

## Kui kasutad olemasolevat andmebaasi ja tahad jätta ainult admini alles

Käivita Supabase SQL Editoris:

```txt
sql/cleanup_keep_admin_only.sql
```

See kustutab:
- kõik mitte-admin kasutajate ennustused
- kõik mitte-admin kasutajad

Alles jäävad:
- admin kasutajad
- mängud
- admin konto

## Domeen

Tee Railway jaoks uus service ja lisa custom domain. Zone.ee puhul soovitan alamdomeeni, näiteks:

```txt
vohma.sinudomeen.ee
```

Railway annab DNS kirjed, mis tuleb lisada Zone.ee DNS haldusesse.
