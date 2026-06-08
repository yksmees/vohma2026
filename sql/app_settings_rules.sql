create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('rules_text', $rules$
Reeglid

Siin on kõik väga lihtsalt kirjas.

1. Ennusta mängu skoori

Iga mängu juures pane kirja, mitu väravat lööb kodumeeskond ja mitu väravat lööb võõrsilmeeskond.

Näide:
Eesti 2 : 1 Läti

See tähendab, et arvad, et Eesti lööb 2 väravat ja Läti lööb 1 värava.

2. Punktid mängude eest

Õige võitja või õige viik annab 2 punkti.

Näide:
Sina ennustad 2 : 1
Mäng lõpeb 1 : 0
Võitja on õige, saad 2 punkti.

Õige kodutiimi väravate arv annab 1 punkti.

Näide:
Sina ennustad 2 : 1
Mäng lõpeb 2 : 0
Kodutiimi väravate arv oli õige, saad 1 punkti.

Õige võõrsiltiimi väravate arv annab 1 punkti.

Näide:
Sina ennustad 2 : 1
Mäng lõpeb 3 : 1
Võõrsiltiimi väravate arv oli õige, saad 1 punkti.

Täpne skoor annab kokku 4 punkti.

Näide:
Sina ennustad 2 : 1
Mäng lõpeb 2 : 1
Kõik oli õige, saad 4 punkti.

3. Play-off mängud

Play-offis ennustame 90 minuti skoori.

Kui mäng lõpeb 90 minutiga, siis punkte saad sama moodi nagu tavalises mängus.

Kui play-off mäng läheb lisaajale või penaltitele, siis saad 1 lisapunkti, kui arvasid õige edasipääseja.

Näide:
Sina ennustad 1 : 1 ja valid, et edasi saab Eesti.
Mäng on 90 minuti järel 1 : 1 ja Eesti pääseb edasi.
Saad täpse skoori eest 4 punkti ja edasipääseja eest 1 punkti.
Kokku 5 punkti.

Tabelis näed seda nii:
4+1p

See tähendab:
4 punkti skoori eest
1 punkt edasipääseja eest

4. Millal teiste ennustusi näeb?

Teiste ennustusi näeb siis, kui mäng on lukus.

Mäng läheb lukku 1 tund enne mängu algust.

Pärast seda ei saa selle mängu ennustust enam muuta.

5. Lisaküsimused

Lisaküsimused annavad lisapunkte play-off edetabelisse.

Iga õigesti vastatud lisaküsimus annab 3 punkti.

6. Edetabelid

Alagrupiturniiri edetabel näitab ainult alagrupimängude punkte.

Play-off edetabel näitab play-off mängude punkte ja lisaküsimuste punkte.

Üldtabel näitab kõik punktid kokku:
alagrupimängud + play-off mängud + lisaküsimused.

7. Auhinnarahad

Alagrupi turna 550€
1. koht 300€
2. koht 150€
3. koht 100€

Rehamängude turna 550€
1. koht 300€
2. koht 150€
3. koht 100€

Lisaks 90€ kahe turniiri punktisumma üldvõitjale.

$rules$)
on conflict (key) do nothing;
