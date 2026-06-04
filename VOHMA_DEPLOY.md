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


## Kui adminiga sisse ei saa

Kui login annab teate `Kasutajat ei leitud`, siis selles Supabase andmebaasis ei ole admin kasutajat olemas.

Ava lehel logimise aknas:
`Esmane admini loomine`

Sisesta admin kasutajanimi ja parool ning vajuta `Loo admin`.

See töötab ainult siis, kui andmebaasis pole veel ühtegi admin kasutajat. Kui admin on juba olemas, siis server tagastab teate `Admin on juba olemas`.


## UEFA U17 testmängud

Lisatud on kolm U17 testmängu, mida saab admin vaates nupuga `Lisa U17 testmängud` andmebaasi lisada:
- U17-1: Belgium U17 vs France U17, 04.06.2026 14:30 Eesti aeg, Kadriorg Stadium
- U17-2: Italy U17 vs Spain U17, 04.06.2026 20:00 Eesti aeg, Lilleküla Stadium
- U17-F: Belgium/France U17 vs Italy/Spain U17, 07.06.2026 20:00 Eesti aeg, Lilleküla Stadium

Need kasutavad `stage = 'UEFA U17 TEST'` ja negatiivseid `match_no` väärtuseid, et ilmuda ennustusvaate alguses. Hiljem saab need eemaldada admin nupuga `Eemalda U17 testmängud` või SQL failiga `sql/remove_u17_test_games.sql`.

Kui soovid API-Footballi tulemuste sünkroniseerimist ka U17 mängudele, lisa Railway env muutuja:

```txt
API_FOOTBALL_EXTRA_LEAGUES=LEAGUE_ID:2026
```

`LEAGUE_ID` tuleb võtta API-Footballi leagues otsingust UEFA European Under-17 Championshipi jaoks. Kui seda pole lisatud, saab U17 tulemusi jätkuvalt adminis käsitsi sisestada.

# Lisaküsimused

Lisaküsimused on eraldi vaates `Lisaküsimused`.

Lisaküsimused annavad punkte ainult play-off edetabelisse:
- iga õigeks märgitud vastus annab 3 punkti
- vale vastus annab 0 punkti

Vastused lukustuvad 1 tund enne esimese MM mängu algust. Lukustus kontrollitakse nii brauseris kui serveris.

Admin saab:
- muuta küsimuse teksti
- lisada ametliku õige vastuse
- märkida iga kasutaja vastuse õigeks või valeks
- kasutada eraldi `Lisaküsimused screenshotiks` plokki screenshotide jaoks

## Vajalik SQL

Käivita Supabase SQL Editoris:

`sql/bonus_questions_migration.sql`

Kui kasutaja vaates küsimused ei ilmu, käivita `sql/bonus_questions_migration.sql`. Admin vaates saab lisaks vajutada `Lisa vaikimisi lisaküsimused`.

Admin saab lisaküsimuste vaates uusi küsimusi juurde lisada ning olemasolevaid küsimusi, õigeid vastuseid ja punkte muuta.

Admin vaates saab tulemusi sisestada ka korraga plokina: iga rida kujul `mängu_nr skoor`, näiteks `-3 1:2`. Play-off viigi puhul lisa `home` või `away`, näiteks `-2 0:0 home`.
