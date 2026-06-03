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
