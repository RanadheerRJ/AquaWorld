/**
 * chrona-profile-module
 * Reusable Firebase Auth / Profile / Local Security module.
 *
 * Usage:
 *   import { registerAccount, loginAccount, openApp, showAccountGate } from 'chrona-profile-module';
 *   import { createFirebaseServices } from 'chrona-profile-module/lib';
 */

// Auth / Account
export {
  registerAccount,
  loginAccount,
  sendCloudPinReset,
  changeCloudPin,
  updateRecoveryEmail,
  ChronaAuthError,
  validateRegistration,
  validateLogin,
} from './auth/account.js';

// Auth UI
export {
  setGreeting,
  showAccountGate,
  openApp,
  bindAccountForms,
} from './auth/ui.js';

// Security / Local PIN
export {
  createAccount as createLocalAccount,
  loadAccount as loadLocalAccount,
  verifyPin,
  verifyQuestions,
  verifyRecoveryCode,
  setPrivateLock,
  updatePin,
  updateQuestions,
  regenerateRecoveryCode,
  acknowledgeRecoveryCode,
  setPanicState,
  isWeakFallback,
} from './security/local-security.js';

// Settings / Profile Controller
export { createSettingsController } from './settings/settings.js';

// Firebase
export { firebaseAuthApi, firestoreApi, createFirebaseServices, firebaseConfig, ADMIN_UID } from './lib/firebase.js';

// Utilities
export {
  usernameFor,
  emailFor,
  passwordFor,
  validPin,
  validUsername,
  validEmail,
  escapeHtml,
  keyFor,
  isoLocal,
  toISO,
} from './lib/utils.js';

// Ledger Cache
export {
  openDatabase,
  createLedgerCache,
  cacheRecordKeys,
} from './ledger/cache.js';

export {
  DB_NAME,
  DB_VERSION,
  DATA_RECORD,
  PENDING_RECORD,
  PROFILE_RECORD,
  STORAGE_KEY,
} from './lib/utils.js';

// Ledger Sync
export {
  mergeProfile,
  queueCloudSync,
  loadCloudLedger,
} from './ledger/sync.js';
