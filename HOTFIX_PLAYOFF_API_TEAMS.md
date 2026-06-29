# Hotfix: play-off API team sync, placeholder hiding and official kickoff override

This package keeps the Võhma deployment on the FIFA World Cup 2026 data set only.

Changes in this version:

- API-Football fixture matching for World Cup matches is restricted to league id `1` and season `2026`.
- U17, U20, women's or other World Cup-like API fixtures cannot overwrite World Cup matches.
- Unresolved knockout placeholders such as `W73`, `L101`, `2H` and `3DEIJL` are hidden from user prediction views until both teams are resolved.
- Existing bogus scores on unresolved placeholder matches are cleaned during sync.
- Match #78 Ivory Coast vs Norway has an official kickoff override of `2026-06-30T17:00:00Z`, which is 20:00 in Estonia.
- The #78 override is applied in display output and during API sync, so API-Football cannot move that match back to 21:00 in the app.

Not changed:

- `matches.id`
- user rows
- predictions
- the scoring formulas
- play-off draw winner selection logic
- bonus question scoring
