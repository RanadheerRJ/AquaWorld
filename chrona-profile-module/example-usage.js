/**
 * Example: using chrona-profile-module in any web app.
 *
 * Prerequisites:
 *   npm install firebase
 *   .env with VITE_FIREBASE_* variables
 */

import {
  createFirebaseServices,
  registerAccount,
  loginAccount,
  showAccountGate,
  openApp,
  bindAccountForms,
  createSettingsController,
  createLedgerCache,
} from './src/index.js';

async function initApp() {
  // 1. Initialize Firebase
  const { auth, firestore } = createFirebaseServices();

  // 2. Create cache
  const cache = createLedgerCache();
  await cache.initialize();

  // 3. Bind account forms
  bindAccountForms({
    auth,
    firestore,
    cache,
    getData: () => ({}),
    setProfile: (p) => (window.currentProfile = p),
    setLegacyData: () => {},
    setRegistrationInProgress: () => {},
    setCurrentUser: (u) => (window.currentUser = u),
    getCurrentUser: () => window.currentUser,
  });

  // 4. Bind settings
  const settings = createSettingsController({
    auth,
    firestore,
    cache,
    getCurrentUser: () => window.currentUser,
    getProfile: () => window.currentProfile,
    setProfile: (p) => (window.currentProfile = p),
  });
  settings.refreshSettings();

  console.log('Chrona profile module initialized.');
}

initApp();
