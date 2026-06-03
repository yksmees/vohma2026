# Play-off ennustus ja uus punktisüsteem

## Punktisüsteem

Ennustusvõistlus koosneb kahest osast: alagrupiturniirist ja play-off mängudest.

Iga mängu puhul annab ennustus punkte järgmiselt:
- õige võitja või õige viik annab 2 punkti
- õige kodutiimi väravate arv annab 1 punkti
- õige võõrsiltiimi väravate arv annab 1 punkti

Täpne skoor annab kokku 4 punkti.

## Play-off mängud

Play-off mängudes ennustatakse 90 minuti skoori.

Kui play-off mängu 90 minuti tulemus jääb viiki, peab viigilist skoori ennustanud mängija lisaks märkima, kumb võistkond pääseb edasi.

Õige edasipääseja annab lisaks 1 punkti.

Näide: kui 90 minuti tulemus on 1:1, edasipääseja on France, ennustus oli 1:1 ja edasipääsejaks valiti France, saab ennustaja 5 punkti.

## Vajalik SQL

Enne deployd või kohe pärast deployd käivita Supabase SQL Editoris:

`sql/playoff_prediction_migration.sql`

Pärast deployd vajuta admin vaates `Arvuta punktid ümber`, et olemasolevad ennustused saaksid uue punktisüsteemi järgi arvutatud.


## Kliendipoolne lukustuse kontroll

Brauser kontrollib iga 30 sekundi järel juba laetud mängude `kickoff_utc` põhjal, kas mäng on jõudnud lukku.

See kontroll:
- ei tee API-Footballi päringuid
- ei tee Supabase päringuid
- muudab lukustunud mängu väljad ja nupu kasutaja vaates halliks

Serveripoolne lukustuse kontroll jääb alles ja on lõplik kontroll salvestamisel.


## U17 testmängud

U17 testmängud kasutavad samuti play-off edasipääseja valiku loogikat, et saaks testida viigilise 90 minuti ennustust.

Kui U17 testmängul sisestatakse ennustuseks viik, ilmub edasipääseja valik. Õige edasipääseja annab testimisel sama loogika järgi +1 punkti.


## Mobiilivaates lõppenud mängud

Mobiilivaates on lõppenud mängud ennustusvaates vaikimisi peidus, et kasutaja ei peaks pikalt allapoole kerima.

Nupuga `Näita lõppenud mänge` saab need vajadusel nähtavaks teha. Uus vajutus peidab need uuesti.

See töötab ainult juba laetud mängude põhjal brauseris ega tee API-Footballi või Supabase päringuid juurde.

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
