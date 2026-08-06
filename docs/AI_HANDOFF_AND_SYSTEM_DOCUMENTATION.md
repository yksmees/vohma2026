# Võhma Lihakombinaadi ennustusvõistlus – süsteemi täielik dokumentatsioon

**Dokumendi eesmärk:** anda järgmisele arendajale või ChatGPT vestlusele piisav kontekst, et rakendust turvaliselt hooldada ning kohandada tulevaseks turniiriks (näiteks EM 2028), ilma MM 2026 andmeid rikkumata.

**Dokumenteeritud pakett:** `archive_live_views_empty_fix`

**Seisuga:** 2026-08-06

---

## 1. Rakenduse eesmärk

Rakendus on Võhma Lihakombinaadi jalgpalliennustusvõistlus. Praegune andmestik on **FIFA MM 2026** kohta.

Rakenduses on järgmised põhifunktsioonid:

- kasutajate registreerimine ja sisselogimine;
- mängutulemuste ennustamine;
- play-off'i viigi korral edasipääseja valimine;
- punktide automaatne arvestus;
- edetabel;
- teiste mängijate ennustuste vaatamine pärast lukustumist;
- lisaküsimused;
- Jooksu arvestus;
- Beer Counter;
- administraatori tööriistad;
- FIFA/API-Football tulemuste ja ajakava sünkroonimine;
- MM 2026 arhiivivaade.

---

## 2. Praegune kasutajaliidese olek

### 2.1 Aktiivsed põhivaated

Põhimenüü vaated on praegu teadlikult tehtud **tühjadeks ootevaadeteks**:

- Ennustused
- Edetabel
- Jooks
- Beer Counter
- Lisaküsimused
- Teiste ennustused
- Reeglid

Need kuvavad teate, et uus ennustusvõistlus ei ole veel avatud, ning suunavad kasutaja MM 2026 arhiivi.

### 2.2 Arhiiv

Menüüs on uus vaade:

- `Arhiiv`
  - `Jalgpalli MM 2026`

Arhiivis kasutatakse olemasolevaid MM 2026 vaateid:

- Ennustused
- Edetabel
- Jooks
- Beer Counter
- Lisaküsimused
- Teiste ennustused
- Reeglid

Arhiivirežiimis on kasutajaliides ainult vaatamiseks:

- salvestamise nupud on peidetud või blokeeritud;
- sisestusväljad on lukustatud;
- lisamise ja kustutamise toimingud on blokeeritud;
- frontend'i `call()` funktsioon keelab arhiivirežiimis kõik muud meetodid peale `GET`, `HEAD` ja `OPTIONS`.

Olulised frontend'i muutujad ja loogika asuvad failis `frontend/index.html`:

- `archiveMode`
- `ARCHIVE_VIEW_IDS`
- `EMPTY_ACTIVE_TABS`
- `openArchive2026()`
- `closeArchive2026()`
- arhiivi alammenüü `data-archive-tab`

### 2.3 Väga oluline arhitektuuriline piirang

**Praegune Arhiiv ei ole veel andmebaasist füüsiliselt eraldatud.**

Arhiiv kuvab MM 2026 andmeid samade olemasolevate GET API-de kaudu. Aktiivsed põhivaated on tühjad ainult frontend'i tasandil, kuid backend ja Supabase sisaldavad endiselt MM 2026 andmeid.

Seetõttu ei tohi EM 2028 loomisel hakata olemasolevaid MM 2026 tabeleid tühjendama, üle kirjutama ega uusi turniiriandmeid samadesse ridadesse lisama ilma eralduslahenduseta.

Enne EM 2028 arendust tuleb teha üks järgmistest:

1. **Soovitatud:** eksportida MM 2026 täielik lõppseis staatilisse arhiiviandmestikku ning panna arhiiv lugema ainult seda;
2. lisada kogu andmemudelile `tournament_id` ning filtreerida iga API alati turniiri järgi;
3. kasutada EM 2028 jaoks eraldi Supabase projekti või eraldi tabelikomplekti.

Kõige väiksema segunemisriskiga lahendus on staatiline MM 2026 arhiiv + EM 2028 eraldi tabelid või eraldi Supabase projekt.

---

## 3. Tehniline arhitektuur

### 3.1 Stack

- Node.js 20+
- Express 4
- Supabase PostgreSQL
- `@supabase/supabase-js`
- JWT autentimine
- `bcryptjs`
- API-Football / API-Sports
- Railway
- üks suur staatiline frontend: `frontend/index.html`

### 3.2 Käivitamine

`package.json`:

```json
{
  "scripts": {
    "start": "node railway-start.js",
    "dev": "node server.js"
  }
}
```

Railway käivitab:

```bash
npm install
npm start
```

`railway-start.js` käivitab põhirakenduse. Express kasutab `process.env.PORT` väärtust.

### 3.3 Failistruktuur

```text
/
├── frontend/
│   ├── index.html
│   ├── assets/
│   └── data/
├── sql/
├── docs/
├── server.js
├── railway-start.js
├── package.json
├── railway.json
├── nixpacks.toml
├── .env.example
└── README.md
```

---

## 4. Keskkonnamuutujad

Railway Variables all peavad olema:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
API_FOOTBALL_KEY
```

### Turvanõuded

- `SUPABASE_SERVICE_ROLE_KEY` ei tohi kunagi frontend'i sattuda.
- `.env` faili ei tohi GitHubi commit'ida.
- `JWT_SECRET` peab olema pikk juhuslik väärtus.
- Enne Railway keskkonnamuutujate muutmist kontrolli, et `SUPABASE_URL` viitaks õigele projektile.

### Kontroll

```text
GET /api/health
```

Oodatav vastus:

```json
{"ok":true,"time":"..."}
```

---

## 5. Andmebaasi põhitabelid

### `players`

Kasutajakontod ja admini olek.

Olulised väljad sõltuvad `sql/schema.sql` versioonist, kuid rakendus kasutab vähemalt:

- `id`
- `username`
- `display_name`
- `password_hash`
- `is_admin`

### `matches`

Kõik mängud, ajad, tulemused ja play-off'i metaandmed.

Olulised väljad:

- `id`
- `match_no`
- `stage`
- `home`
- `away`
- `kickoff_utc`
- `final_home`
- `final_away`
- `winner`
- `is_finished`
- `went_extra`
- `api_status_short`
- `manual_result_override`
- `goals_home_120`
- `goals_away_120`

**Tähtis:**

- `final_home/final_away` = ennustuspunktide aluseks olev **90 minuti tulemus**;
- `goals_home_120/goals_away_120` = Jooksu väravate kogusumma jaoks **90 min + lisaaeg**;
- penaltiseeria lööke ei lisata väravate kogusummasse;
- `matches.id` ja `match_no` ei tohi kergekäeliselt muuta ega ridu uuesti luua, sest ennustused on seotud `match_id` kaudu.

### `predictions`

Kasutajate ennustused.

Olulised väljad:

- `id`
- `player_id`
- `match_id`
- `pred_home`
- `pred_away`
- `pred_winner`
- `points`

Ühe kasutaja ja mängu kohta peab olema üks kirje. Salvestamine kasutab upsert-loogikat; viimane edukas salvestus enne lukku jääb kehtima.

### `bonus_questions` ja `bonus_answers`

Lisaküsimused ja mängijate vastused.

### `running_entries` ja `running_activity_types`

Jooksu ja muude tegevuste sissekanded ning tegevuste koefitsiendid.

### `beer_entries`

Beer Counteri sissekanded.

### `app_settings`

Reeglid, lisaküsimuste lukk ja muud rakenduse seadistused.

### `leaderboard_rank_snapshots`

Edetabeli positsioonide ajalooline või hetke hetkeseis, kui vastav funktsioon on kasutusel.

---

## 6. Punktisüsteem

### Põhipunktid

- **4 punkti:** täpne skoor;
- **3 punkti:** õige tulemus ning ühe meeskonna väravate arv täpselt õige;
- **2 punkti:** õige tulemus, kuid kumbki väravate arv pole täpselt õige;
- **1 punkt:** tulemus vale, kuid ühe meeskonna väravate arv täpselt õige;
- **0 punkti:** tulemus ja mõlemad väravate arvud valed.

### Play-off'i lisapunkt

Play-off-mängus lisandub **+1 punkt edasipääseja eest ainult juhul**, kui:

1. ametlik 90 minuti tulemus oli viik;
2. kasutaja ennustas 90 minuti viiki;
3. kasutaja valis õige edasipääseja (`pred_winner`).

Kui kasutaja ennustab mitteviigilise skoori, `pred_winner` ei tohi punkte mõjutada ja backend salvestab selle sisuliselt `null` väärtusena.

### Mida punktiarvestuses mitte teha

- ära kasuta lisaajaga lõppskoori `final_home/final_away` väljades;
- ära arvuta kogu turniiri punkte ümber ilma eelkontrollita;
- eelista ühe konkreetse `match_no` ennustuste sihitud ümberarvutust;
- enne muudatust tee SELECT/preview ning pärast audit.

---

## 7. Ennustuste lukustumine

Ennustus lukustub **1 tund enne mängu algust**.

Aegu hoitakse UTC-s (`kickoff_utc`) ja kuvatakse kasutajale Eesti ajas.

Lukustuse kontroll toimub serveris; ainult frontend'i disabled-olekut ei tohi turvamehhanismina usaldada.

Teiste ennustused peavad nähtavaks muutuma vastavalt lukustumise loogikale, mitte enne.

---

## 8. Jooksu vaate väravate kogusumma

Jooksu eesmärk kasutab turniiri väravate kogusummat:

- tavaväravad + lisaaja väravad;
- penaltiseeria löögid välja jäetud.

Serveri `running/summary` marsruut eelistab:

```text
goals_home_120 + goals_away_120
```

ja kasutab fallback'ina:

```text
final_home + final_away
```

MM 2026 kontrollitud lõppsumma on:

```text
308 väravat
```

Oluline parandatud näide:

```text
#86 Argentina – Cape Verde
90 min: 1:1
120 min: 3:2
manual_result_override: true
```

Selle mängu puhul:

```text
final_home = 1
final_away = 1
goals_home_120 = 3
goals_away_120 = 2
winner = home
went_extra = true
manual_result_override = true
```

---

## 9. Tuntud MM 2026 terviklikkuse kontrollid

Viimati kontrollitud audit näitas:

```json
{
  "ok": true,
  "matches_checked": 104,
  "trusted_matches_visible": 94,
  "duplicate_match_no": [],
  "group_result_mismatches": [],
  "r32_team_mismatches": [],
  "future_result_rows": [],
  "hidden_trusted_rows_with_stored_result": [],
  "unlocked_finished_results": [],
  "unlocked_finished_result_count": 0,
  "prediction_point_mismatch_count": 0,
  "prediction_point_mismatches": []
}
```

Audit endpoint:

```text
GET /api/admin/audit/worldcup-integrity
```

Enne suuri muudatusi või uut turniiri salvesta:

- mängude arv;
- ennustuste arv;
- mängijate arv;
- punktide lõppseis;
- Jooksu sissekannete arv ja kogusummad;
- Beer Counteri sissekannete arv ja kogusummad;
- bonus-vastuste arv;
- väravate kogusumma.

---

## 10. Olulisemad API marsruudid

Autentimine ja konto:

```text
POST /api/setup/admin
POST /api/login
POST /api/register
GET  /api/me
POST /api/password
```

Mängud ja ennustused:

```text
GET  /api/matches
GET  /api/predictions
POST /api/predictions
GET  /api/predictions/public
GET  /api/predictions/matrix
GET  /api/leaderboard
```

Lisaküsimused:

```text
GET  /api/bonus/questions
POST /api/bonus/answers
```

Jooks:

```text
GET  /api/running/summary
POST /api/running/entries
```

Beer Counter:

```text
GET  /api/beer/summary
POST /api/beer/entries
```

Reeglid:

```text
GET  /api/rules
POST /api/admin/rules
```

Admin ja sünkroonimine:

```text
POST /api/admin/results/import
POST /api/admin/sync/results
POST /api/admin/sync/schedule
POST /api/admin/recalc-points
POST /api/admin/matches
GET  /api/admin/schedule/check
POST /api/admin/schedule/fix
GET  /api/admin/audit/worldcup-integrity
```

Täielik tõde on alati `server.js` marsruutides.

---

## 11. API-Football sünkroonimise kaitsed

Rakenduses on kaitsed, mis takistavad lõpetatud ja käsitsi lukustatud mängude tulemuste soovimatut ülekirjutamist.

Oluline väli:

```text
manual_result_override = true
```

Seda kasutatakse mängudel, mille korrektne tulemus või 90/120 minuti eristus on käsitsi kinnitatud.

Enne sünkroonimist:

1. tee audit;
2. kontrolli lõpetatud mängude käsitsi lukke;
3. ära kasuta laia UPDATE-i;
4. pärast sync'i kontrolli `blocked_result_overwrites` infot ja auditit.

---

## 12. Frontend'i ülesehitus

Kogu frontend on peamiselt ühes failis:

```text
frontend/index.html
```

See sisaldab:

- HTML-i;
- CSS-i;
- JavaScripti;
- API-kutseid;
- vaadete renderdamist;
- mobiilivaate stiile.

### Ennustuste mobiilivärvid

Lõppenud mängude kaardid kasutavad punktide loogikat:

- 4+ p – roheline;
- 3 p – sinine;
- 2 p – kollane;
- 1 p – oranž;
- 0 p – punane.

Mobiilivaate CSS ei tohi neid klasse ühe üldise taustavärviga üle kirjutada.

### Lõppenud mängude nupp

„Näita/peida lõppenud mänge” peab muutma lõppenud mängude nähtavust, mitte neid andmetest eemaldama.

---

## 13. Railway ja GitHub töövoog

Soovitatud töövoog:

1. tee olemasolevast töötavast seisust tagavarakoopia;
2. muuda ainult vajalikke faile;
3. vaata Git diff üle;
4. commit'i kirjeldava nimega;
5. push GitHubi;
6. Railway deploy'ib automaatselt;
7. testi `/api/health`;
8. testi login, vaated ja audit.

Kui viimane commit oli vigane:

- GitHub Desktop → History;
- vali vigane commit;
- `Revert Changes in Commit`;
- `Push origin`.

Revert loob uue commit'i, mis võtab valitud commit'i muudatused tagasi. See ei kustuta ajalugu.

---

## 14. EM 2028 kohandamise kriitiline juhis

**Ära alusta EM 2028 loomist lihtsalt MM 2026 mängude kustutamise või samade tabelite täitmisega.**

Praeguse paketi arhiiv loeb samu API-sid ja sama andmebaasi. Kui olemasolevad tabelid tühjendada, kaob ka arhiivi sisu.

Enne EM 2028 tööd tee MM 2026 külmutamine.

### Soovitatud variant A: staatiline arhiiv

1. Ekspordi MM 2026 kõik vajalikud andmed ühte või mitmesse JSON-faili.
2. Salvesta need näiteks:

```text
frontend/archive/mm2026/
├── matches.json
├── predictions.json
├── leaderboard.json
├── running.json
├── beer.json
├── bonus.json
├── players.json
└── metadata.json
```

3. Muuda `Arhiiv → MM 2026` lugema ainult neid faile.
4. Kontrolli, et arhiiv töötab ka siis, kui Supabase'i MM 2026 tabelitele ligipääs eemaldada.
5. Alles seejärel loo EM 2028 aktiivsed tabelid.

### Soovitatud variant B: eraldi EM 2028 tabelid

Näiteks:

```text
euro2028_matches
euro2028_predictions
euro2028_bonus_questions
euro2028_bonus_answers
euro2028_running_entries
euro2028_beer_entries
```

Mängijakontod võivad jääda ühisesse `players` tabelisse.

### Variant C: eraldi Supabase projekt

Kõige tugevam füüsiline eraldus, kuid rohkem haldust ja uusi keskkonnamuutujaid.

### Mitte soovitatud enne refaktorit

Lisada EM 2028 kirjed otse samadesse tabelitesse ilma `tournament_id` filtrita. See võib segada:

- edetabelit;
- mängude päringuid;
- ennustuste maatriksit;
- Jooksu ja Beer Counteri kogusummasid;
- lisaküsimusi;
- arhiivi.

---

## 15. MM 2026 staatilise arhiivi eksporditav minimaalne andmestik

Ekspordis peab olema vähemalt:

```text
metadata
players
matches
predictions
leaderboard
bonus_questions
bonus_answers
running_activity_types
running_entries
beer_entries
rules
```

`metadata.json` soovituslik sisu:

```json
{
  "slug": "mm2026",
  "name": "Jalgpalli MM 2026",
  "archived_at": "2026-08-06T00:00:00Z",
  "read_only": true,
  "match_count": 104,
  "goal_total_90_and_extra_time": 308,
  "penalty_kicks_excluded": true,
  "scoring_version": "mm2026-v1"
}
```

Eksporditud ennustuste puhul säilita alati:

- algne `match_id`;
- `match_no`;
- kasutaja identifikaator ja kuvatav nimi;
- ennustatud skoor;
- `pred_winner`;
- lõplikud punktid.

---

## 16. Muudatuste kontrollnimekiri

Enne deploy'd:

- [ ] ZIP lahti pakitud ja failid kontrollitud;
- [ ] ainult soovitud failid muutunud;
- [ ] `server.js` süntaks korras;
- [ ] frontend avaneb ilma Console error'iteta;
- [ ] `.env` ega võtmeid ZIP-is pole;
- [ ] MM 2026 mängu-ID-sid pole muudetud;
- [ ] ennustusi ega mängijaid pole kustutatud;
- [ ] `final_*` ja `goals_*_120` tähendus säilib;
- [ ] punktiarvestust pole kogemata muudetud;
- [ ] arhiivis muutvad toimingud blokeeritud.

Pärast deploy'd:

- [ ] `/api/health` töötab;
- [ ] login töötab;
- [ ] aktiivsed vaated on tühjad ootevaated;
- [ ] `Arhiiv → MM 2026` avaneb;
- [ ] arhiivi kõik alavaated laadivad;
- [ ] arhiivis ei saa midagi salvestada;
- [ ] Jooks näitab 308 väravat;
- [ ] ennustuste punktivärvid on õiged;
- [ ] lõppenud mängude näitamise nupp töötab;
- [ ] admin audit on korras.

---

## 17. Tõrkeotsing

### Arhiiv kuvab tühje vaateid

Kontrolli:

- kas `archiveMode` lülitub `true`;
- kas `openArchive2026()` avab õige alavaate;
- kas GET API-kutsed ei ole arhiivirežiimis blokeeritud;
- kas kasutaja on sisse logitud;
- kas backend loeb õiget Supabase projekti.

### Supabase SQL näitab üht, veebileht teist

Kontrolli Railway:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Seejärel tee GET päring `nocache` parameetriga ja `cache: 'no-store'`.

### Jooksu väravate summa vale

Kontrolli:

```sql
select
  match_no,
  home,
  away,
  final_home,
  final_away,
  goals_home_120,
  goals_away_120,
  went_extra,
  manual_result_override
from public.matches
where is_finished = true
order by match_no;
```

Ära muuda `final_*` välju lisaajaga skooriks.

### Sync kirjutab käsitsi paranduse tagasi

Sea õigel mängul:

```text
manual_result_override = true
```

ning kontrolli, et kasutusel oleks tulemuste overwrite guard'iga `server.js` versioon.

---

## 18. Edaspidine refaktori soovitus

Praegune ühe suure `frontend/index.html` lahendus töötab, kuid kasvades muutub riskantseks. Enne või pärast EM 2028 võiks jagada frontend'i:

```text
frontend/
├── index.html
├── css/
│   ├── base.css
│   ├── predictions.css
│   ├── archive.css
│   └── mobile.css
└── js/
    ├── api.js
    ├── auth.js
    ├── predictions.js
    ├── leaderboard.js
    ├── running.js
    ├── beer.js
    ├── archive.js
    └── app.js
```

Seda ei tohiks teha samaaegselt andmemudeli või turniiri migratsiooniga. Tee esmalt arhiiv täielikult sõltumatuks, siis refaktor eraldi etapina.

---

## 19. Kokkuvõte järgmisele arendajale või ChatGPT-le

Praegu on kasutajale nähtav loogika:

```text
Aktiivsed võistlusvaated = tühjad ootevaated
Arhiiv → MM 2026 = vana MM 2026 leht ainult vaatamiseks
```

Kuid tehniliselt:

```text
Arhiiv → MM 2026 = endiselt olemasolev Supabase MM 2026 andmestik
```

Seetõttu on järgmine kohustuslik suur etapp enne EM 2028:

```text
MM 2026 andmete staatiline külmutamine või turniiride füüsiline eraldamine
```

Ära kustuta ega kirjuta üle praeguseid MM 2026 tabeleid enne, kui arhiiv on sõltumatult eksporditud, kontrollitud ja taastatav.


---

## 20. Kohustuslik arhitektuur järgmiste turniiride jaoks

Järgmise ennustusvõistluse loomisel ei tohi MM 2026 production-andmebaasi ega tulemuste API seadistust ümber kasutada. See nõue kehtib EM 2028, MM 2030 ja kõigi hilisemate turniiride kohta.

### 20.1 Uus andmebaas

- Loo uue turniiri jaoks uus, füüsiliselt eraldatud andmebaas või hallatud andmebaasiprojekt.
- Supabase on praegune eelistatud variant, kuid enne uut projekti tuleb hinnata, kas selleks ajaks on olemas parem sobiv lahendus.
- Ära seed'i, truncate'i, nimeta ümber ega taaskasuta MM 2026 production-tabeleid.
- Ära kasuta samu production API võtmeid ega service role key'd.
- Hoia uue turniiri Railway keskkonnamuutujad eraldi.
- MM 2026 arhiiv peab jääma staatiliseks ega tohi uue andmebaasiga ühendust võtta.

### 20.2 Uus tulemuste ja mängukava API integratsioon

- Vali uue turniiri ajal parim usaldusväärne skooride ja mängukava allikas.
- API-Footballit võib kasutada ainult pärast uue turniiri toe, league ID, season'i, hinnastuse ja andmemudeli kontrollimist.
- Vajadusel kasuta teist teenusepakkujat või ametlikku andmeallikat.
- Loo uued API võtmed, endpoint'ide konfiguratsioon ja meeskondade/mängude ID-kaardistus.
- Ära kanna MM 2026 API mängu-ID-sid üle järgmisse turniiri.
- Testi 90 minuti tulemus, lisaaeg, penaltiseeria, mängu staatus, edasilükkamine, katkestamine ja käsitsi override.
- Säilita overwrite guard, audit endpoint ja käsitsi tulemuse lukustamise võimalus.
- Dokumenteeri kasutatav API, väljade kaardistus, rate limit, maksepakett ja varuplaan.

### 20.3 Absoluutne eraldatuse reegel

```text
MM 2026 = staatiline, külmutatud ja ainult vaatamiseks
Uus turniir = uus andmebaas + uus tulemuste API konfiguratsioon
```

Uue turniiri koodil ei tohi olla võimalust MM 2026 arhiivi andmeid muuta. Kui järgmisele ChatGPT-le või arendajale antakse see dokumentatsioon, peab ta alustama uue andmebaasi ja uue API integratsiooni kavandamisest, mitte olemasoleva MM 2026 andmestiku ümbertegemisest.
