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
