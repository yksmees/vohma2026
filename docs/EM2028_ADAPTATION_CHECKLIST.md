# EM 2028 kohandamise kontrollnimekiri

Seda faili kasutada alles siis, kui alustatakse uut ennustusvõistlust.

## 0. Peata enne muudatusi

Ära kustuta, truncate'i ega seed'i üle järgmisi MM 2026 tabeleid enne, kui arhiiv on füüsiliselt eraldatud:

- matches
- predictions
- bonus_questions
- bonus_answers
- running_entries
- running_activity_types
- beer_entries
- app_settings
- leaderboard_rank_snapshots

## 1. Tee MM 2026 varukoopia

- Supabase database backup või SQL dump
- JSON/CSV eksport kõigist turniiritabelitest
- Git tag töötavale deploy'le, näiteks `mm2026-final`
- salvesta lõplik audit

## 2. Külmuta arhiiv

Soovitatud: loo `frontend/archive/mm2026/` JSON-failid ja muuda arhiiv neid lugema.

Kontrolli vähemalt:

- 104 mängu
- 308 väravat koos lisaajaga, penaltid välja jäetud
- kõik mängijad
- kõik ennustused ja punktid
- lõplik edetabel
- Jooksu kõik kirjed
- Beer Counteri kõik kirjed
- lisaküsimused ja vastused
- reeglid

## 3. Tõesta sõltumatus

Ajutises testkeskkonnas:

- blokeeri arhiivi GET päringud Supabase'i;
- veendu, et `Arhiiv → MM 2026` töötab endiselt täielikult staatilistest failidest;
- veendu, et arhiivis puuduvad POST/PUT/PATCH/DELETE toimingud.

## 4. Loo EM 2028 andmed eraldi

Vali üks:

- eraldi Supabase projekt;
- eraldi `euro2028_*` tabelid;
- täielik `tournament_id` migratsioon koos kohustuslike filtritega.

Kõige väiksema riskiga praeguse koodi jaoks: eraldi `euro2028_*` tabelid või eraldi projekt.


## 4A. Kohustuslik uus andmebaas ja uus skoori-API lahendus

Iga järgmine ennustusvõistlus (näiteks EM 2028, MM 2030 või muu turniir) tuleb käsitleda täiesti uue süsteemikihina. **MM 2026 aktiivset andmebaasi, tabelite ridu, mängu-ID-sid ega API-Footballi seadistust ei tohi uue turniiri jaoks taaskasutada ega üle kirjutada.**

Uue turniiri alustamisel tuleb:

- luua uus eraldatud andmebaas või andmebaasiprojekt;
- eelistatult kasutada selleks eraldi Supabase projekti;
- kui selleks ajaks on olemas parem ja sobivam hallatud andmebaasilahendus, hinnata seda eraldi ning dokumenteerida valik;
- luua uued tabelid, migratsioonid, ligipääsuvõtmed, varukoopiaplaan ja keskkonnamuutujad;
- mitte ühendada uut turniiri MM 2026 tabelitega ega kasutada samu production-võtmeid;
- jätta MM 2026 arhiiv staatiliseks ja andmebaasist sõltumatuks.

Samuti tuleb uue turniiri jaoks luua või uuesti seadistada **eraldi skooride ja mängukava integratsioon**:

- kontrollida, milline ametlik või töökindel tulemuste API on sel hetkel parim;
- mitte eeldada, et API-Footballi praegune league ID, season, endpoint'id või väljade struktuur sobivad EM 2028 jaoks;
- luua uued API võtmed ja Railway keskkonnamuutujad;
- kaardistada uue API meeskonna-ID-d ja mängu-ID-d ainult uue turniiri andmetega;
- testida eraldi 90 minuti tulemust, lisaaega, penalteid, mängu staatuseid, edasilükkamisi ja tühistamisi;
- säilitada käsitsi paranduse ja overwrite guard'i võimalus;
- dokumenteerida API teenusepakkuja, pakett, piirangud, endpoint'id, väljade tähendus ja varuplaan juhuks, kui API muutub või lõpetab töö.

Soovitatud põhimõte:

```text
MM 2026 arhiiv = staatilised failid, ainult vaatamiseks
EM 2028 aktiivne võistlus = uus andmebaas + uus skoori-API integratsioon
Järgmine turniir = taas eraldi andmebaas + selle aja parim skoori-API lahendus
```

Andmete eraldatus peab olema kontrollitav ka siis, kui uue turniiri koodis tekib viga: uus rakendus ei tohi omada kirjutamisõigust MM 2026 arhiveeritud andmetele.

## 5. Kohanda turniiri metaandmed

- lehe pealkiri
- logo ja sponsor
- turniiri nimi
- hooaja/aasta tekstid
- API-Football league/season
- meeskonnad
- mängude arv
- grupid ja play-off struktuur
- kickoff'i ajavööndi kuvamine
- lukustumise reegel
- punktireeglid
- lisaküsimused
- reeglite tekst
- Jooksu eesmärk

## 6. Ära eelda MM 2026 struktuuri

EM 2028 võib erineda:

- meeskondade arv;
- gruppide arv;
- parimate kolmandate kohtade süsteem;
- play-off'i paaride arv;
- mängude koguarv;
- API league ID;
- turniiri kuupäevad.

Play-off'i loogika tuleb teha andmepõhiseks, mitte hoida MM 2026 match_no hardcode'i.

## 7. Testid enne avalikku avamist

- registreerimine ja login
- ajad Eesti ajas
- 1 h lukk
- salvestamine ja upsert
- viigi korral edasipääseja
- mitteviigi korral edasipääseja välja peitmine/null
- teiste ennustuste nähtavus
- punktide kõik kombinatsioonid 0–4
- play-off +1
- edetabel
- Jooks
- Beer Counter
- lisaküsimused
- admin sync
- audit
- mobiilivaade
- arhiivi puutumatus

## 8. Avaldamine

- tee staging deploy
- kasuta eraldi testandmeid
- kontrolli Git diff
- tee andmebaasist backup
- deploy productionisse
- smoke test
- jälgi Railway logisid
