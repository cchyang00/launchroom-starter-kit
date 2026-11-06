import React, { useEffect, useMemo } from 'react';
import App from './App.jsx';
import { LaunchroomContext } from './LaunchroomShell.jsx';
import { startAppearance } from './appearance.mjs';
import { MERRIVY_ID } from './launchroomModel.mjs';

const LAUNCHROOM_PROJECT = {
  id: MERRIVY_ID,
  name: 'Launchroom',
  kind: 'legacy',
};

const OWNER_USER = {
  id: 'owner',
  name: 'Owner',
  username: 'owner',
  role: 'admin',
};

/**
 * Launchroom: Single unified All-in-One Operating System for Merrivy.
 * Opens directly into the Launchroom workspace at `/` (and normalizes `/p/merrivy/` to `/`)
 * with no login gate and no multi-project wrapper.
 */
export function Launchroom() {
  useEffect(() => {
    startAppearance('owner');
    if (window.location.pathname.startsWith('/p/')) {
      window.history.replaceState(null, '', '/' + (window.location.hash || ''));
    }
  }, []);

  const context = useMemo(
    () => ({
      session: { initialized: true, user: OWNER_USER, canSetup: true, remoteEnabled: false },
      user: OWNER_USER,
      projects: [LAUNCHROOM_PROJECT],
      project: LAUNCHROOM_PROJECT,
      place: MERRIVY_ID,
      reload: () => {},
      signOut: () => {},
      openPeople: () => {},
      openNewProject: () => {},
    }),
    [],
  );

  return (
    <LaunchroomContext.Provider value={context}>
      <App project={LAUNCHROOM_PROJECT} />
    </LaunchroomContext.Provider>
  );
}
