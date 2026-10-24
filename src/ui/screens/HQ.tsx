// The old HQ home screen is retired: the City tab (screens/city/) replaced it and the HQ tab (shell/HeadquartersTab)
// is Build, Gear and Training. What other files still import lives in screens/city/ and is re-exported here until
// they point there. `HQ` is the City screen under its old name only so the two tests that mount it still compile
// (HQ.test.ts, visual-floors.test.ts); both assert the old markup and are rewritten in wave 3. Delete this file
// once nothing imports './HQ'.
export { CityScreen as HQ } from './city/CityScreen';
export { Debriefs } from './city/Results';
export { openCallBrief } from './city/callBrief';
