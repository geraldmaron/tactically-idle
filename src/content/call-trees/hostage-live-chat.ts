import type { ChatLine, ThreatChat } from './types';

// What the viewers say as each threat drains (docs/call-pressure.md, "Chat that follows the pressure";
// swat-call-prose references/live-chat.md). Early, closing and imminent are thirds of the threat's
// minutes. A line is plain text under a generated handle, or says who types it (`by`) and which beat
// of its threat it waits for (`after`). The last imminent line of a threat that names a {handle} is
// that commenter's own. Viewers see the rider's phone, the comments and the news, never the radio.
const after = (beat: string, text: string): TreeChat => ({ text, after: beat });
const by = (who: string, text: string): TreeChat => ({ by: who, text });
type TreeChat = Exclude<ChatLine, string>;
const FRIEND = '{friend.first}';
export const CHAT: Record<string, ThreatChat | false> = {
  going_live: {
    early: [by('{handle}', 'wait where is this place'), 'no clue, counter looks so familiar', 'laundromat one??', 'phone at 4 percent 😬',
      { by: '{handle}', text: '{rider.first} just read my question out', after: 'where_is_this' }, 'east side i think', 'is somebody on the floor back there'],
    closing: ['got a map open. two stores on that block', 'not the laundromat. green sign maybe', 'is there a bus stop out front?', 'maybe the one next to the bank',
      after('cross_streets', 'bank corner? 📍'), 'dont post it. whoever has it dont', 'i live near there, they are taping the corner off'],
    imminent: ['dont read it out {rider.first}', 'somebody in the group chat has the street', 'pleeease dont post it', by(FRIEND, 'dont post the address. i mean it'),
      '{handle} you have it??', 'takes two seconds on any map', by('{handle}', 'ok i got it. typing it now')],
  },
  on_air: {
    early: ['the handgun is still there', 'is {manager.first} ok down there', by(FRIEND, 'come out. i got you. im at the tape'), 'everybody chill, let {rider.first} talk', 'woah hold on', after('count_two', 'more people coming in 👀')],
    closing: ['why bring the gun then', 'let them walk out at least', 'i got cut off too and never did this', '{rider.first} stop answering them', 'the manager is still back there', 'this chat flipped fast', 'so who took the bag then'],
    imminent: ['put it down', 'just put it down {rider.first}', 'we were on your side. put it down', 'let the clerk and the manager go', 'mute the comments', 'walk out'],
  },
  off_air: false,
  clerk_talks: {
    early: ['did the clerk make it out?', 'someone said the clerk left', 'why does {rider.first} keep looking at the door', 'is the clerk ok', 'who is {rider.first} asking about', 'is anyone still in the back'],
    closing: ['{rider.first} keeps asking where the kid went', 'nobody is answering {rider.first}', 'what is {rider.first} waiting for', 'the negotiator went quiet', 'tell {rider.first} the kid is fine'],
    imminent: ['still nothing', 'just answer the question', 'any word on the clerk', 'somebody say where the kid is', 'this silence is making it worse'],
  },
  way_out: {
    early: ['theres a van at the corner, i can see it from my window', 'which channel 👀', '{outlet_short} i think, logo on the side', 'cops let a van park there?', 'did {rider.first} see it', 'can anyone see the van from inside'],
    closing: ['theyre unloading something tall', 'what are they setting up', 'now {outlet_short} sees what we see', after('how_out', 'asking if the walk out is on camera'), 'its so bright out there', 'my mom texted, shes watching on {outlet_short}'],
    imminent: ['everybody will see this', 'are they allowed that close', 'somebody tell the van to back up', 'wow no', 'more people tuning in on tv now', 'ugh turn it off'],
  },
  cornered: {
    early: ['someone is recording that', 'did anyone catch what {manager.first} said', after('thief', 'people are saying {rider.first} took the bag'), 'who says? nobody proved it', 'stop reading it out loud', 'the clip is better than the stream tbh', 'read the room'],
    closing: ['comments are split now', 'half of you werent here for the start', 'the clip cut off the part before', '{manager.first} didnt say it like that', 'count keeps going', 'everyone is piling on'],
    imminent: ['stop sharing it', 'it makes it worse', 'dont look at it', 'nobody needs that clip', 'just reported it', 'how many shares is that now'],
  },
  threat: {
    early: ['somebody by the tape says the van moved', 'are they going live??', 'people at the tape say the gun is up', 'turn on {outlet_short}', 'my mom says {outlet_short} keeps teasing it', 'this is bad'],
    closing: ['theyre lining up a shot of the window', 'can they see {rider.first} in there', 'tell them to back off', 'crowd keeps growing, someone near there says', 'people are INSIDE'],
    imminent: ['{outlet_short} is counting down to air', 'theyre going to put this on tv', 'somebody make them wait', 'please wait', 'hold on hold on', 'not the window. anything but the window'],
  },
  fired_on: {
    early: ['WAIT', 'was that a shot', 'the window!!', '{rider.first} what did you do', 'is everybody ok in there', 'did that hit someone outside'],
    closing: ['is anyone hurt outside', 'i heard it from two streets over', 'is {manager.first} ok', 'somebody stop this', 'drop it'],
    imminent: ['what is that buzzing', 'is that a phone', 'dont ignore it', 'somebody say something', 'please let it be someone good'],
  },
  last_word: {
    early: ['whats going on at the door', 'is {rider.first} still there', 'who is waiting out there', 'everybody wants to see what happens', 'hello?', 'its so quiet now'],
    closing: ['{rider.first} keeps looking at the front', 'is {rider.first} going to walk out', 'is {rider.first} coming out', 'dont go near the window', 'whats the negotiator saying'],
    imminent: ['something is happening', 'uh oh', 'where is {rider.first} going', 'please just walk out', 'talk to us'],
  },
  address_out: {
    early: ['the address is all over the comments now', 'im ten minutes away, thinking about going', 'dont go over there', 'stay home, you will make it worse', after('past_tape', 'someone is arguing at the tape')],
    closing: ['patrol is shouting at people to back up', 'dont film through the window', 'this is how people get hurt', after('see_store', 'someone said they can see the register from outside'), 'back UP'],
    imminent: ['nobody go near that glass', 'please stay back everyone', 'patrol will grab whoever goes up', 'stay behind the tape', 'patrol just turned someone around at the corner'],
  },
  chat_turned: {
    early: ['whose gun is that even', 'nobody asked about it till now', 'are the police coming in', 'cops wont go in with people inside', 'you dont know that', after('three_k', 'still more people joining 👀')],
    closing: ['borrowed, i heard', 'from who tho', '{rider.first} answers every single guess', 'stop feeding it', 'thats how this chat works though', '{rider.first} stop reading them'],
    imminent: ['enough guessing', 'dont answer them {rider.first}', 'ignore the chat', 'let the negotiator talk', 'ok im muting this'],
  },
};
