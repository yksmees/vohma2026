# Hotfix: play-off tiimid, placeholderid ja algusajad

See pakk parandab Võhma MM 2026 deploys kolm seotud probleemi:

1. API-Footballi MM fixture võib muuta play-off mängu algusaega. Sync uuendab nüüd ka `kickoff_utc` väärtust ainult päris MM mängudel 1 kuni 104.
2. API-Footballi tiiminimede aliasid normaliseeritakse kohaliku MM tiiminime vastu. Näiteks `Cape Verde Islands` salvestub kujul `Cape Verde`, et `Argentina vs 2H` ei tekiks tagasi.
3. Tulevased lahendamata placeholder mängud nagu `W101 vs W102` jäävad kasutaja vaadetest peitu ja nende fake tulemused puhastatakse synci ajal.

Ei muudeta:

- `matches.id`
- `predictions` ridu
- kasutajaid
- punktiarvestuse reegleid
- play-off viigi korral edasipääseja valiku loogikat
- bonusküsimuste loogikat

Pärast deployd käivita adminis `Sünkroniseeri tulemused`.
