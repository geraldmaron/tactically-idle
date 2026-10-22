# Pilot gate output, raw

Scratch gate (session scratchpad gate.ts): splices on-air-node.json into Going Live in memory, then runs the swat-call-prose checker (longest names, they; place words not passed as cast, so whole-call ngram counts run higher than npm run check:strings), node counts, odds at the first engine arrival at on_air (squad A, seed 7), and 300 drawn calls per balance style with real dice. 2026-10-22.

## Baseline (current on_air)
```
on_air strings 61 {"exit":0,"ngram":"0","pathEcho":"0","pathRepeat":"78","repeat":"0","overTarget":"3","long":"2","it":"5","cadence":"variation 0.46 FLAT","opener":"opener share: bellamy 38%, the 15%, you 8%, your 3%, tell 2%"}
whole call 846 {"exit":1,"ngram":"2","pathEcho":"0","pathRepeat":"857","repeat":"4","overTarget":"29","long":"21","it":"70","cadence":"variation 0.49 FLAT","opener":"opener share: bellamy 43%, the 11%, they 3%, you 2%, {lead} 2%"}
node counts {"handgunMentions":13,"adverseToThreat":4,"routes":{"favorable->way_out":3,"favorable->cornered":1,"mixed->way_out":4,"adverse->threat":4,"adverse->way_out":3,"favorable->off_air":1,"adverse->off_air":1},"spentLedgerHits":28,"spentHitsList":["behind the counter","at 11 40","the stockroom door","through the glass","took the bag","{rider.first} turns the","handgun at {manager.first}","{rider.first} watches the","turns the phone","{rider.first} picks up","the front window","away from the"],"count":4,"timestampRetold":3}
odds at on_air s1: manager_speaks 65/31/4 3m | camera_wall 85/11/4 4m | cut_feed 57/31/12 9m | team_glass 68/28/4 3m
odds at on_air s2: manager_speaks 65/31/4 3m | camera_wall 89/7/4 4m | cut_feed 57/31/12 9m | team_glass 68/28/4 3m
random    {"learnedWhoTook":0.23,"visitedOnAir":191,"onAirPicks":{"manager_speaks":57,"team_glass":26,"camera_wall":54,"cut_feed":54},"threatRightAfterOnAir":8,"weights":{"clean":140,"costly":128,"death":5,"unresolved":23,"hurt":4}}
best_odds {"learnedWhoTook":0,"visitedOnAir":297,"onAirPicks":{"camera_wall":293,"team_glass":4},"threatRightAfterOnAir":7,"weights":{"clean":199,"costly":80,"unresolved":21}}
patient   {"learnedWhoTook":0.55,"visitedOnAir":0,"onAirPicks":{},"threatRightAfterOnAir":0,"weights":{"costly":278,"unresolved":22}}
fast      {"learnedWhoTook":0.37,"visitedOnAir":295,"onAirPicks":{"manager_speaks":158,"camera_wall":132,"team_glass":5},"threatRightAfterOnAir":7,"weights":{"death":7,"clean":208,"costly":63,"unresolved":17,"hurt":5}}
```

## Pilot (on-air-node.json)
```
on_air strings 73 {"exit":1,"ngram":"0","pathEcho":"1","pathRepeat":"100","repeat":"0","overTarget":"3","long":"0","it":"11","cadence":"variation 0.58 OK","opener":"opener share: the 19%, bellamy 15%, they 7%, {lead} 5%, i 5%"}
whole call 858 {"exit":1,"ngram":"4","pathEcho":"1","pathRepeat":"880","repeat":"4","overTarget":"29","long":"19","it":"76","cadence":"variation 0.50 FLAT","opener":"opener share: bellamy 41%, the 12%, they 3%, {lead} 2%, then 2%"}
node counts {"handgunMentions":4,"adverseToThreat":1,"routes":{"favorable->way_out":4,"favorable->cornered":1,"mixed->way_out":4,"adverse->threat":1,"adverse->way_out":3,"favorable->off_air":1,"adverse->off_air":1},"spentLedgerHits":2,"spentHitsList":["the stockroom door","the register phone"],"count":1,"timestampRetold":0}
odds at on_air s1: manager_speaks 65/31/4 3m | camera_wall 79/17/4 4m | cut_feed 57/31/12 9m | team_glass 68/28/4 3m
odds at on_air s2: manager_speaks 65/31/4 3m | camera_wall 82/14/4 4m | cut_feed 57/31/12 9m | team_glass 68/28/4 3m
random    {"learnedWhoTook":0.39,"visitedOnAir":191,"onAirPicks":{"manager_speaks":57,"team_glass":26,"camera_wall":54,"cut_feed":54},"threatRightAfterOnAir":2,"weights":{"clean":138,"costly":133,"death":3,"unresolved":23,"hurt":3}}
best_odds {"learnedWhoTook":0.78,"visitedOnAir":297,"onAirPicks":{"camera_wall":293,"team_glass":4},"threatRightAfterOnAir":0,"weights":{"clean":188,"costly":95,"unresolved":17}}
patient   {"learnedWhoTook":0.55,"visitedOnAir":0,"onAirPicks":{},"threatRightAfterOnAir":0,"weights":{"costly":278,"unresolved":22}}
fast      {"learnedWhoTook":0.72,"visitedOnAir":295,"onAirPicks":{"manager_speaks":158,"camera_wall":132,"team_glass":5},"threatRightAfterOnAir":4,"weights":{"death":6,"clean":210,"costly":63,"unresolved":17,"hurt":4}}
```

## Checker rows on the pilot node
```
it-check        all  on_air.promptIf[0]                   read this string alone; does 'it' have a referent inside it?
it-check        all  on_air.manager_speaks.preview.favorable read this string alone; does 'it' have a referent inside it?
it-check        s1   on_air.manager_speaks.favorable[0]   read this string alone; does 'it' have a referent inside it?
it-check        all  on_air.manager_speaks.adverse[0]     read this string alone; does 'it' have a referent inside it?
it-check        s2   on_air.manager_speaks.adverse[1]     read this string alone; does 'it' have a referent inside it?
over-target     all  on_air.camera_wall.title             6 words, house target 5
it-check        all  on_air.camera_wall.summary           read this string alone; does 'it' have a referent inside it?
vague-preview   all  on_air.camera_wall.preview.mixed     'something'; name a person and a visible act or position
it-check        all  on_air.camera_wall.preview.mixed     read this string alone; does 'it' have a referent inside it?
tense-mix       s1   on_air.camera_wall.favorable[1]      past and present in one result; hold the call's tense
threat-it       all  on_air.camera_wall.mixed[0]          'swings it'; a threat line names the object in a noun phrase
it-check        all  on_air.camera_wall.mixed[0]          read this string alone; does 'it' have a referent inside it?
over-target     all  on_air.cut_feed.title                6 words, house target 5
it-check        all  on_air.cut_feed.preview.favorable    read this string alone; does 'it' have a referent inside it?
it-check        all  on_air.cut_feed.favorable[0]         read this string alone; does 'it' have a referent inside it?
it-check        all  on_air.cut_feed.mixed[0]             read this string alone; does 'it' have a referent inside it?
over-target     all  on_air.team_glass.title              7 words, house target 5
fronted         all  on_air.team_glass.preview.adverse    'Helmets show on the screen, Bellamy kills the fron'; change the subject, never the word order
result tense: {'present': 11}
path-echo       s2   on_air.manager_speaks.favorable[1].exchange[0] repeats 'the register camera' from on_air.manager_speaks.favorable[1], read back to back
lead uses: 8 across stages adapt
sentence length: mean 9.5, range 1-21, variation 0.58 OK
opener share: the 19%, bellamy 15%, they 7%, {lead} 5%, i 5%
rule-of-three lists: 2
summary over-limit 0, over-target 3, locked-clamp 0, sentence-lint 0, sentence-long 0, dash 0, colon 0, semicolon 0, exclamation 0, apostrophe 0, stock 0, stock-spoken 0, feeling 0, sheet-term 0, engine-word 0, policy-voice 0, defer 0, delay-only 0, word-choice 0, weapon-speech 0, placeholder 0, missing-band 0, marker-name 0, marker-judge 0, repeat 0, ngram 0, motif 0, path-repeat 100, path-echo 1, address-mix 0, clock-mix 0, cost-template 0, lead-thin 0, opener-share 0, cadence-flat 0, triad 0, unsafe 0, method 0, method-review 0, meta 0, accusation 0, settled 0, surface 0, inversion 0, fronted 1, nothing-alone 0, fragments 0, fragment-open 0, narrator-hedge 0, mechanic 0, vague-preview 1, ending-status 0, tape-subject 0, aphorism 0, ai-tell 0, threat-it 1, role-position 0, it-check 11, tense-mix 1, tense-call 0, speech-tag 0, negation-openers 0, strings 73
```
