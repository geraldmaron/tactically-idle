// The department for components that need it (OfficerCard's aged portraits) without the store, so
// the Scenario Lab can render them. The game's App provides it; null outside. Stream G wires it.
import { createContext } from 'react';
import type { Context } from 'react';
import type { Department } from '../../sim/types';

export const DepartmentContext: Context<Department | null> = createContext<Department | null>(null);
