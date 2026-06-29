# Hotfix: play-off vaadete ja placeholder tulemuste parandus

Parandus Võhma Lihakombinaadi MM 2026 deploy jaoks.

## Miks see vajalik oli

Eelmises fallbackis võis juhtuda, et vale API vaste kirjutas mõne tulevase play-off mängu reale skoori või tiiminime. Kui rida puhastati seed tabeli järgi tagasi, võis kasutaja vaatesse jõuda placeholder kujul `W101 vs W102`, `W73 vs W75`, `L101 vs L102` või `Argentina vs 2H`.

## Mis muudeti

- `sanitizeWorldCupMatchesForDisplay` puhastab nüüd rikutud tiiminimed enne ja filtreerib placeholderid pärast seda välja.
- `predictions/matrix`, `matches`, `predictions/public`, `leaderboard` ja ennustuse salvestus ei luba enam unresolved MM placeholder mängu kasutaja vaadetesse ega punktiarvestusse.
- Lisatud kaitse, et W/L edasi liikumist ei tuletata mängust, mille tiimid on veel placeholderid või mille nimed on rikutud.
- Lisatud cleanup, mis eemaldab fake skoorid unresolved MM mängudelt, näiteks `W101 vs W102`.
- Cleanup nullib ka nende mängude `predictions.points`, et fake tulemused ei jääks edetabelisse.
- Admini tulemuste sync käivitab cleanupi automaatselt.
- Adminile lisatud eraldi endpoint `POST /api/admin/cleanup/unresolved-playoff`.
- Admini screenshot board filtreerib client side tasemel samuti ainult lahendatud MM mängud.

## Mida ei muudetud

- Ei kustutata kasutajaid.
- Ei kustutata ennustusi.
- Ei kustutata mänge.
- Ei muudeta `matches.id` väärtusi.
- Ei muudeta play-off viigi korral edasipääseja valiku loogikat.
- Ei muudeta `calcPoints` punktiarvestuse reegleid.

## Pärast deployd

Vajuta adminis `Sünkroniseeri tulemused`.

See puhastab varasemast bugist jäänud fake tulemused tulevastelt placeholder mängudelt ja peidab need vaadetest seni, kuni päris tiimid on teada.
