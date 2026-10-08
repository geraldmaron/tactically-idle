import { CALL_TREES } from './call-trees';
import { SCENARIO_TYPES_V11 } from './scenario-types-v11';

/** Content version 13 starts from the v11 catalog. A framework authored as a call tree is drawn
 * only to the building types its tree lists, because its scene names things those buildings have. */
export const SCENARIO_TYPES_V13 = SCENARIO_TYPES_V11.map(info => {
  const tree = CALL_TREES[info.type];
  return tree ? { ...info, families: [...tree.families] } : info;
});
