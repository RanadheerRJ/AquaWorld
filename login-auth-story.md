# Story: Build the Chrona Login & Auth System (Tracker 34c branch)

## Background

You are an AI agent building a reusable login, profile, and account module. The reference is the `arena/019f834c-tracker` branch (ending in `34c`) from `RanadheerRJ/Tracker`. The module must work in any git repository — drop it in, set `.env`, publish Firestore rules, and it works.

The original is a timesheet ledger PWA. You are extracting ONLY the auth, profile, security, and sync layers into a standalone module called `chrona-profile-module`.

---

## Part 1: The Cloud Auth Flow (Firebase Auth + Firestore Lookup)

### 1.1 The Username + PIN Design

Users log in with a **username** (`3–24` chars, lowercase alphanumeric + `_.-`) and a **4–6 digit PIN** (not all same digit). Do NOT expose email/password directly to the user.

- Transform PIN: `passwordFor(pin) = 'tlk_' + pin` (this is the Firebase Auth password string).
- Transform username: `usernameFor(value)` trims and lowercase.
- Validate PIN: `/^\d{4,6}$/` and not `/^(\d)\1+$/`.
- Validate username: `/^[a-z0-9_.-]{3,24}$/`.
- Validate email: basic `/^\S+@\S+\.\S+$/`.

### 1.2 Username Lookup Document (`usernames/{username}`)

Before authentication, the client must resolve the username to a Firebase Auth email. The design intentionally uses a **publicly readable** Firestore document for this:

```
Collection: usernames
Document: {normalized-username}
Fields: { uid: <firebase-uid>, email: <recovery-email> }
Rules: allow read: if true; allow create/update/delete: owner/admin only
```

This exposes the account email — document this as a deliberate privacy tradeoff in the README. There is no backend/cloud function; the client reads this directly.

### 1.3 Login Process (`loginAccount`)

1. Normalize username (`usernameFor`).
2. Check `localStorage` for saved email: `chrona-login-email-v1:{username}`.
3. Read Firestore `usernames/{username}` for current email.
4. Call Firebase Auth `signInWithEmailAndPassword(auth, email, passwordFor(pin))`.
5. Save resolved email back to `localStorage`.
6. If login fails, throw `ChronaAuthError` with user-facing message (not raw Firebase errors).

### 1.4 Registration Process (`registerAccount`)

1. Validate all inputs (`validateRegistration`).
2. Check `usernames/{username}` does not exist (`getDoc`).
3. Create Firebase Auth account: `createUserWithEmailAndPassword(auth, email, passwordFor(pin))`.
4. Write Firestore batch (`writeBatch`):
   - `ledgers/{uid}`: `{ username, name, email, data }`
   - `usernames/{username}`: `{ uid, email }`
5. Cache profile locally (`IndexedDB` + `localStorage`).
6. Sign out and redirect to login gate (`showAccountGate('login')`).
7. If anything fails after Auth user creation, delete the Auth user (`deleteUser`) and sign out to clean up.

---

## Part 2: Profile Documents & Data Structure

### 2.1 Firestore Schema

```
Collection: ledgers
  Document: {uid}
  Fields: username (string), name (string), email (string), data (map/object — calendar/ledger data)

Collection: usernames
  Document: {normalized-username}
  Fields: uid (string), email (string)
```

### 2.2 Cache Structure (`IndexedDB`: `chrona-ledger`, version 2)

- Object store: `app`
- Keys used:
  - `profile:{uid}` → profile object
  - `ledger:{uid}` → data object
  - `pendingSync:{uid}` → boolean
  - `profile` / `ledger` / `pendingSync` (legacy single-user keys from version 1)

The `createLedgerCache()` factory returns methods: `getProfile`, `setProfile`, `getLedger`, `setLedger`, `getPending`, `setPending`, `initialize`, `readLocalCache`, `writeLocalCache`, `profileKey`, `ledgerKey`, `pendingKey`.

---

## Part 3: PIN & Account Management

### 3.1 Cloud PIN Change (`changeCloudPin`)

Requires current PIN for re-authentication:

1. `reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, passwordFor(currentPin)))`
2. `updatePassword(currentUser, passwordFor(nextPin))`

Validate `nextPin` with `validPin`. Throw `ChronaAuthError` on any failure.

### 3.2 Cloud PIN Reset (`sendCloudPinReset`)

1. Normalize username.
2. Read `usernames/{username}` for email.
3. If no email found → throw error: "This legacy account needs a recovery email added from Settings before cloud PIN reset is available."
4. Call `sendPasswordResetEmail(auth, email)`.

### 3.3 Recovery Email Update (`updateRecoveryEmail`)

1. Re-authenticate with cloud PIN (`reauthenticateWithCredential`).
2. Update Auth email (`updateEmail`).
3. Write to Firestore (`setDoc` with merge):
   - `ledgers/{uid}`: `{ email: normalizedEmail }`
   - `usernames/{username}`: `{ uid, email: normalizedEmail }`
4. Update cached profile (`cache.setProfile`).

---

## Part 4: Local Security (Device PIN — Separate System)

This is NOT cloud-synced. It is a browser-local privacy layer for an already-signed-in session.

### 4.1 Design Specs

- Hash algorithm: `PBKDF2-SHA-256`
- Iterations: `120,000`
- Salt: random `16-byte` array (`crypto.getRandomValues`)
- Storage: `localStorage` under `chrona-local-account-v1:{uid}`
- Weak fallback: if `SubtleCrypto` is unavailable, use clearly flagged `weak-fallback` algorithm.

### 4.2 Account Record Structure

```
{
  uid: string,
  pinHash: { algorithm: 'pbkdf2-sha256', iterations: 120000, salt: ArrayBuffer },
  questions: [{ index: number, answerHash: ... }],
  recoveryCode: { code: string, acknowledged: boolean },
  createdAt: number
}
```

### 4.3 Key Functions

- `createAccount(uid, pin, questionIndexes, answers)`: Creates account with hashed PIN and question answers (`normalizeAnswer`: trim, lowercase, replace whitespace with single space).
- `verifyPin(account, pin)`: Derives PBKDF2 hash from input and compares to `protectedValue`.
- `verifyQuestions(account, answers)`: Normalizes answers and compares.
- `verifyRecoveryCode(uid, code)`: Compares recovery code.
- `updatePin(uid, pin)`: Updates PIN hash with same salt.
- `updateQuestions(uid, indexes, answers)`: Updates questions.
- `regenerateRecoveryCode(uid)`: Generates new random code.
- `acknowledgeRecoveryCode(uid)`: Marks acknowledged.
- `setPrivateLock({ uid, reason, lockedAt })`: Stores lock state (`locked`, `panic`, `background`).
- `setPanicState(value)`: Sets panic flag.
- `isWeakFallback(account)`: Returns true if algorithm is `weak-fallback`.

### 4.4 Lock Behaviors

- **Panic Lock**: Triggered by `panicBtn` click or keyboard shortcut (`Ctrl+Shift+L` with `event.preventDefault()`). Reason: `panic`.
- **Auto-lock**: `visibilitychange` event (`document.hidden`) → reason: `background`. Only locks if `autoLock !== false`.
- **Unlock**: User enters local PIN into `unlockLocalPin` input; `localLockOverlay` hides; `appShell` removes `locked` class.

---

## Part 5: Profile & Settings Controller

### 5.1 Settings Controller (`createSettingsController`)

Inputs: `auth`, `firestore`, `cache`, `getCurrentUser`, `getProfile`, `setProfile`, `authApi`, `firestoreApi`.

Bound elements:
- `profileHeading`: shows `username + "'s space"` or `"Profile & preferences"`
- `settingsUsername`: input showing username
- `settingsUsernameText`: shows `@username`
- `settingsEmail`: shows `profile?.email || currentUser?.email`
- `securitySettings`: shown only if `loadAccount(uid)` exists; hidden (`securityEmpty`) otherwise
- `setupSecurityBtn`: hidden if account exists
- `autoLockToggle`: default checked (`autoLock !== false`)
- `securityMessage`: shows active message or weak fallback warning

### 5.2 Form Bindings

- `localSetupSave`: binds to `createAccount` for new local PIN setup.
- `localSetupCancel`: hides overlay.
- `updateLocalPin`: updates PIN.
- `updateLocalQuestions`: updates questions.
- `regenerateRecoveryCodeBtn`: regenerates code.
- `acknowledgeRecoveryBtn`: acknowledges code.
- `panicBtn`: triggers `setPrivateLock({ reason: 'panic' })`.

---

## Part 6: Firebase Configuration & Rules

### 6.1 `.env` Template (`config/.env.example`)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_FIREBASE_ADMIN_UID=your-admin-uid-here
```

### 6.2 Config File (`firebase-config.js`)

Exports:
- `firebaseConfig`: object for `initializeApp`
- `ADMIN_UID`: from `VITE_FIREBASE_ADMIN_UID`
- `missingFirebaseEnv()`: checks missing required keys

### 6.3 Firestore Rules (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.uid == ADMIN_UID;
    }
    match /ledgers/{uid} {
      allow read, write: if request.auth != null && (request.auth.uid == uid || isAdmin());
    }
    match /usernames/{username} {
      allow read: if true;  // PUBLIC — needed for username login resolution
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update: if request.auth != null && request.resource.data.uid == request.auth.uid && resource.data.uid == request.auth.uid;
      allow delete: if isAdmin();
    }
  }
}
```

**Important**: `ADMIN_UID` in `.env` must match the hardcoded UID in `firestore.rules`. Include a check script (`npm run check:admin-uid`) to catch mismatches.

---

## Part 7: Module Structure & Exports

Build the module at `chrona-profile-module/` inside any repo. It must have these files:

```
chrona-profile-module/
  package.json
  README.md
  .gitignore
  config/
    .env.example
    firestore.rules
  src/
    index.js              # Main exports (all public APIs)
    auth/
      account.js          # registerAccount, loginAccount, changeCloudPin, updateRecoveryEmail, sendCloudPinReset, ChronaAuthError, validateRegistration, validateLogin
      ui.js               # setGreeting, showAccountGate, openApp, bindAccountForms
      index.js            # Auth exports
    security/
      local-security.js   # QUESTIONS, createAccount, loadAccount, verifyPin, verifyQuestions, verifyRecoveryCode, updatePin, updateQuestions, regenerateRecoveryCode, acknowledgeRecoveryCode, setPrivateLock, setPanicState, isWeakFallback, validPin (local)
      index.js            # Security exports
    settings/
      settings.js         # createSettingsController
      index.js            # Settings exports
    lib/
      firebase.js         # firebaseAuthApi, firestoreApi, createFirebaseServices, firebaseConfig, ADMIN_UID
      firebase-config.js  # Config + env check
      utils.js            # usernameFor, emailFor, passwordFor, validPin, validUsername, validEmail, escapeHtml, keyFor, isoLocal, toISO
      index.js            # Lib exports
    ledger/
      cache.js            # openDatabase, createLedgerCache, cacheRecordKeys
      sync.js             # mergeProfile, queueCloudSync, loadCloudLedger
      index.js            # Ledger exports
  example-usage.js       # Quick usage snippet
```

### 7.1 Key Export Groups (`src/index.js`)

- Auth: `registerAccount`, `loginAccount`, `sendCloudPinReset`, `changeCloudPin`, `updateRecoveryEmail`, `ChronaAuthError`, `validateRegistration`, `validateLogin`
- Auth UI: `setGreeting`, `showAccountGate`, `openApp`, `bindAccountForms`
- Security: `createLocalAccount`, `loadLocalAccount`, `verifyPin`, `verifyQuestions`, `verifyRecoveryCode`, `setPrivateLock`, `updatePin`, `updateQuestions`, `regenerateRecoveryCode`, `acknowledgeRecoveryCode`, `setPanicState`, `isWeakFallback`
- Settings: `createSettingsController`
- Firebase: `createFirebaseServices`, `firebaseAuthApi`, `firestoreApi`, `firebaseConfig`, `ADMIN_UID`
- Utilities: `usernameFor`, `emailFor`, `passwordFor`, `validPin`, `validUsername`, `validEmail`, `escapeHtml`, `keyFor`, `isoLocal`, `toISO`
- Cache: `openDatabase`, `createLedgerCache`, `DB_NAME`, `DB_VERSION`, `DATA_RECORD`, `PENDING_RECORD`, `PROFILE_RECORD`, `STORAGE_KEY`
- Sync: `mergeProfile`, `queueCloudSync`, `loadCloudLedger`

---

## Part 8: Usage Pattern (How Any Repo Uses It)

### 8.1 Install Dependency

```
npm install firebase
```

### 8.2 Environment

Copy `.env.example` → `.env`. Fill Firebase Console values and `ADMIN_UID`. Never commit `.env`.

### 8.3 Initialize in App

```js
import {
  createFirebaseServices,
  registerAccount,
  loginAccount,
  openApp,
  showAccountGate,
  bindAccountForms,
  createSettingsController,
  createLedgerCache,
} from 'chrona-profile-module';

const { auth, firestore } = createFirebaseServices();
const cache = createLedgerCache();
await cache.initialize();
```

### 8.4 Registration Example

```js
await registerAccount({
  auth,
  firestore,
  values: {
    name: 'Alice Example',
    username: 'alice',
    email: 'alice@example.com',
    pin: '583214',
    confirm: '583214',
  },
  data: {},
  cache,
});
```

### 8.5 Login Example

```js
await loginAccount({
  auth,
  firestore,
  username: 'alice',
  pin: '583214',
});
```

---

## Part 9: Security & Privacy Notes (Must Be Documented)

- **PIN Entropy**: A 4–6 digit PIN (`passwordFor(pin) = 'tlk_' + pin`) has much lower entropy than a standard password. The design preserves backward compatibility with the original `tlk_` scheme.
- **Username Lookup Privacy**: `usernames/{username}` is readable by anyone (`if true`). This exposes the recovery/auth email in lookup docs. Document this clearly.
- **Local Lock Limitations**: The device PIN (`PBKDF2`) prevents casual same-device access only. It does not encrypt `IndexedDB`/`localStorage`, defeat developer tools, or recover a Firebase account on another device.
- **Admin UID Sync**: `VITE_FIREBASE_ADMIN_UID` and `firestore.rules` `isAdmin()` must stay synchronized. Include a check script.
- **Legacy Accounts**: Users without a real recovery email (`emailFor(username)` synthetic address) cannot use cloud PIN reset until they add a real email via Settings (`updateRecoveryEmail`).

---

## Part 10: Build Deliverable Checklist

Before finishing, verify each item exists and references the Tracker `34c` branch correctly:

- [ ] `package.json` with `peerDependencies` (`firebase`), `type: "module"`, exports
- [ ] `README.md` with usage, security notes, privacy tradeoff explanation
- [ ] `.env.example` with all `VITE_FIREBASE_*` + `ADMIN_UID`
- [ ] `config/firestore.rules` with public `usernames` read, owner/admin `ledgers`
- [ ] `src/auth/account.js` with full flow (`registerAccount`, `loginAccount`, `sendCloudPinReset`, `changeCloudPin`, `updateRecoveryEmail`)
- [ ] `src/auth/ui.js` with `showAccountGate`, `openApp`, `bindAccountForms`, `setGreeting`
- [ ] `src/security/local-security.js` with `PBKDF2`, `SubtleCrypto`, panic lock, questions
- [ ] `src/settings/settings.js` with profile/settings controller
- [ ] `src/lib/firebase.js` + `firebase-config.js` with env config and `missingFirebaseEnv`
- [ ] `src/lib/utils.js` with `usernameFor`, `emailFor`, `passwordFor`, validation
- [ ] `src/ledger/cache.js` with `IndexedDB` (`chrona-ledger`) factory
- [ ] `src/ledger/sync.js` with `mergeProfile`, `queueCloudSync`
- [ ] `src/index.js` exporting all public APIs
- [ ] `example-usage.js` demonstrating initialization, register, login
- [ ] `.gitignore` ignoring `.env`, `node_modules`
- [ ] Security comments in code: `// IMPORTANT: Keep ADMIN_UID in sync`, `// Low-entropy cloud auth`, `// Username lookup privacy tradeoff`

---

## Story Ending: What the Agent Should Do

Read this story. Then build (or adjust) the `chrona-profile-module` folder in the workspace (`/home/user/AquaWorld/chrona-profile-module/`). Ensure every feature from the Tracker `34c` branch is preserved: username lookup, PIN transformation (`tlk_`), batch Firestore writes, IndexedDB cache, PBKDF2 local PIN, admin UID sync, and privacy tradeoff documentation. If any feature is missing, compare against `login-account-features.md` and add it.
