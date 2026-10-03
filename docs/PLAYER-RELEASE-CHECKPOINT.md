# Player experience release checkpoint

Published release, 3 October 2026. The roster, equipment artwork, management tools, mobile interaction improvements and expanded response system are available on GitHub Pages.

Implemented: canonical Equipment/Training/Develop navigation, direct free testing point packs, tiered services, safe squad arrangement previews and Undo, department overview, integrated equipment power with legacy refunds, contextual mission kits and persistent operation results. New calls now use six decision patterns, including active armed incidents, hostage crises and protected rescues. Support requests, accepted care, individual civilian outcomes and persistent officer injury are separate parts of the operation.

PR #19 published commit `0e175139f9e3adcb27ae7783e5dca19c01a934b6` after 1,273 tests, type checking, artwork validation and a Pages-base production build passed. Its exact-commit CI and Pages deployment succeeded. Existing issued-operation compatibility fingerprints pass.

Hosted phone checks used temporary in-memory test campaigns, isolated from normal browser saves. They covered medical support arrival and accepted care, partial hostage release and separate completion for the second person, an armed incident with a named officer injury, first aid, evacuation, lasting roster recovery and save-slot reload, and a vehicle rescue interrupted into a slower alternative. Practice correctly leaves no lasting injuries or rewards. Support sheets were checked at 320 and 390 pixels, including Back/Close/focus restoration and repeated confirmation.

The follow-up addresses two findings from those journeys: reported people and threats must agree across the briefing, and optional preparation equipment must not be mixed with warnings about future mission states. It also corrects shared practice wording about vehicle wear. No operation mechanics or saved history are changed by these presentation fixes.

Phone-sized browser checks are not a claim of testing physical iOS/Android hardware. Larger-text keyboard zoom did not take effect in the cloud browser, so that check remains unverified. All artwork is installed; no binary upload is pending.
