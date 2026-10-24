import { createContext, useContext } from 'react';
import type { Id } from '../../../sim/types';

/** What the Team header can open: the bond web (E3) and an officer's aftercare (E4). Team provides them, so the
 * header, the jacket and the rows open the same two sheets, and other screens can open them the same way. */
export interface TeamActions {
  openBonds: () => void;
  openAftercare: (imprintId: Id) => void;
}

const none = () => {};
export const TeamActionsContext = createContext<TeamActions>({ openBonds: none, openAftercare: none });
export const useTeamActions = (): TeamActions => useContext(TeamActionsContext);
