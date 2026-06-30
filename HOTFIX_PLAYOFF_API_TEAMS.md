# Hotfix: play-off bracket visibility and bad #91 score guard

This build keeps the existing scoring and prediction save logic, but adds a stricter bracket guard for World Cup play-off matches.

## Fixed

- Later play-off rounds (#89-#104) are no longer trusted just because both team names look like real teams.
- A later round match is visible only when its official local W/L source matches are resolved and the row teams match those resolved winners/losers.
- Example: #91 is W76 vs W78, so Brazil vs Morocco is hidden and considered invalid if #78 has not produced a winner.
- Bad fake results on invalid future knockout rows are cleared and predictions on those rows are reset to 0 points.
- API team-name updates are disabled for #89-#104; those teams are derived from the local W/L bracket only.
- API result sync skips unresolved/invalid future knockout rows, preventing wrong scores from being attached again.

## Not changed

- `matches.id` values are not changed.
- `predictions` rows are not deleted.
- `players`, users, bonus answers and SQL schema are not changed.
- `calcPoints`, play-off advancer bonus rules and normal prediction save format are not changed.

## After deploy

Run admin result sync once. It will clear invalid future play-off scores and derive any already-known next-round teams.
