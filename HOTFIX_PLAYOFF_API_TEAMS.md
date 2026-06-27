# Hotfix: play-off tiimid API-Footballist

Muudatus on tehtud Võhma Lihakombinaadi deploy ZIP-i peale.

## Mis muutus

- API-Footballi fixture sobitaja lubab play-off placeholderitega mänge (`2A`, `3ABCDF`, `W73`, `L101` jne) siduda ka siis, kui tiiminimed veel ei kattu.
- Placeholderiga play-off mängu seotakse API fixture'iga turvalise skoori järgi: algusaeg, staadion ja round/faas.
- Kui API-Football annab päris tiiminimed, uuendatakse ainult `matches.home` ja `matches.away` välju.
- Sama loogika töötab Round of 32, Round of 16, veerandfinaalide, poolfinaalide, 3. koha mängu ja finaali jaoks.
- Kui API-Football veel päris tiime ei anna, jäävad olemasolevad placeholderid alles.
- Olemasolev kohalik W/L fallback jäi alles, et varasemate play-off mängude võitjad/kaotajad saaksid järgmisse mängu liikuda ka siis, kui API hilineb.

## Mida ei muudetud

- `matches.id` ei muutu.
- `predictions` tabelit ei tühjendata ega kirjutata massiliselt üle.
- `players` tabelit ei muudeta.
- Punktiarvestuse loogikat ei muudetud.
- Play-off viigi korral kuvatav edasipääseja valik jäi alles.
- Andmebaasi skeemi muudatust ei lisatud.

## Kontroll

- `node --check server.js` läbis kontrolli.
- Muudatus puudutab ainult `server.js`, frontend admin sünkroni teadet ja seda selgitusfaili.
