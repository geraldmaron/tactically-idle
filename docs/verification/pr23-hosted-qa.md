# Campaign variety: hosted QA and follow-up

Tested the public Pages build from main `6569ef59d7908ba5a2e14f749c01c3f1c004ce7a` (`app-ClPR_kzA.js`) in its isolated, in-memory responsive harness. These are cloud-browser checks at 320×568 and 390×844, not physical-device tests. Normal player saves were untouched.

## Verified in the browser

- Three separately created campaigns produced 22 distinct identities across 24 starting positions. Their three candidate pools differed. Loading each slot again preserved names, roles, ages, service, portraits and skills. Navigation did not reroll recruitment.
- Squad-only Auto left the other squad alone. Manual quantities (including zero), exact units, repeat clicks and Undo behaved correctly. Every story decision began unselected and required explicit Review and Confirm.
- Optional support remained unselected until clicked. Closing/reopening the review preserved the explicit choice without advancing time.
- An early stores delivery reserved the requested owned unit, preserved the selected decision and squad, and charged three operation minutes. A later delivery was correctly blocked; exhausted stock offered an honest alternative squad rather than inventing equipment.
- A fresh welfare call resolved after its source check and current welfare check, with no filler closure click. The result retained actual time, stress, rewards and learned facts.
- A medical episode exposed different receiving crews, arrival clocks and physical destinations. Requesting the inside crew early advanced only that crew's response; the later agreement kept the person's keys and required the crew's actual route into the building.

## Defects found and corrected

1. Fixed-result v6 choices, including ending with incomplete progress, still advertised a chance to go well. A shared structural comparison now recognizes identical complete authored effect tables. It removes the false success forecast and records a neutral result label while preserving the sampled check, actual time, stress, resources and consequences. Different mechanics or conditional effects retain ordinary forecasts. Frozen v1–v5 definitions and past history are unchanged.
2. A second tap on New Game's Cancel or Start could land on newly exposed Save a Copy or Ops controls. Save sheets now guard the original pointer area for the remainder of that repeated gesture, including campaign remounts. Keyboard activation and deliberate taps elsewhere stay available. Save operations also have a synchronous in-flight lock.

Combined verification: 1,625 tests in 107 files, typecheck, artwork validation and both normal and Pages-base builds pass. Regression coverage includes unchanged legacy fingerprints, fixed-result save/reload, genuinely different effects, touch and desktop repeated taps, remount, keyboard, Back, and retry after failed save writes. The corrected artifact still requires hosted retesting after its follow-up deployment.

## Explicit limit

The single renewed normal Import backup attempt timed out waiting for the browser file chooser. No file was selected or imported. Legacy navigation has engine, save/reload, frozen-history and rendering coverage, but importing that synthetic legacy campaign was not verified in this browser session. No alternate import or storage-injection route was used.
