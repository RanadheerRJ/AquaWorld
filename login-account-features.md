# Detailed Feature Breakdown: Login & Account System (Tracker branch 34c / arena/019f834c-tracker)

## 1. Cloud Auth System (Firebase Auth + Firestore Lookup)

### 1.1 Authentication Flow
- **Login Method**: Username + PIN (NOT email + password directly)
- **Username Resolution**: 
  - Client reads `usernames/{username}` document from Firestore
  - Document contains `{ uid: <firebase-uid>, email: <recovery-email> }`
  - `usernames` collection allows PUBLIC READ (`allow read: if true`) so unauthenticated clients can resolve username → email before signing in
- **PIN Transformation**: `passwordFor(pin) = 'tlk_' + pin` (4–6 digit PIN)
  - PIN never stored in raw form; only the transformed string is passed to Firebase Auth
  - Firebase Auth stores the hashed password; the app never stores raw PIN
- **Login Process** (`loginAccount`):
  1. Normalize username (`usernameFor` → lowercase, trim)
  2. Check saved email from `localStorage` (`chrona-login-email-v1:{username}`)
  3. Try Firestore lookup for current email
  4. Call `authApi.signInWithEmailAndPassword(auth, loginEmail, passwordFor(pin))`
  5. Save resolved email back to `localStorage`
- **Registration Process** (`registerAccount`):
  1. Validate: name, username (`3–24` chars, `a-z0-9_.-`), email format, PIN (`4–6` digits, not all same digit), confirm PIN
  2. Check `usernames/{username}` does not exist
  3. Create Firebase Auth user (`createUserWithEmailAndPassword` with synthetic or real email)
  4. Write batch to Firestore:
     - `ledgers/{uid}`: `{ username, name, email, data }`
     - `usernames/{username}`: `{ uid, email }`
  5. Cache profile locally (`IndexedDB` + `localStorage`)
  6. Sign out and redirect to login gate (`showAccountGate('login')`)

### 1.2 Profile Documents (Firestore)
```
Collection: ledgers
  Document: {uid}
  Fields: username (string), name (string), email (string), data (object/map)

Collection: usernames
  Document: {normalized-username}
  Fields: uid (string), email (string)
```
- **Privacy Note**: The `usernames` lookup intentionally exposes the account email (`email` field readable by anyone). This is a deliberate tradeoff to allow username-based login without a backend/cloud function.
- **Admin Access**: `isAdmin()` checks `request.auth.uid == ADMIN_UID`. Admin can read/write any `ledgers/{uid}` and delete `usernames` docs. Admin UID is duplicated in `.env` (`VITE_FIREBASE_ADMIN_UID`) and `firestore.rules`.

### 1.3 PIN & Security Management
- **Cloud PIN Change** (`changeCloudPin`):
  - Requires current PIN for re-authentication (`EmailAuthProvider.credential`)
  - Updates Firebase Auth password (`updatePassword` with `passwordFor(nextPin)`)
  - Keeps PIN `4–6` digits, not all same digit (`validPin`)
- **Cloud PIN Reset** (`sendCloudPinReset`):
  - Looks up username → email via `usernames` doc
  - Sends Firebase `sendPasswordResetEmail` to recovery email
  - If account is legacy (no real email), returns error: needs recovery email added from Settings first
- **Recovery Email Update** (`updateRecoveryEmail`):
  - Re-authenticates with cloud PIN
  - Updates Auth email (`updateEmail`)
  - Updates `ledgers/{uid}` and `usernames/{username}` via Firestore `setDoc` with merge
  - Updates cached profile locally

---

## 2. Local Security (Device-Level PIN — Separate from Cloud PIN)

### 2.1 Design Principles
- **Completely separate** from Firebase Auth cloud PIN
- **Browser-local only** (not cloud-synced)
- Uses `Web Crypto` (`SubtleCrypto`) for PBKDF2-SHA-256 with 120,000 iterations
- Random 16-byte salt per user (`crypto.getRandomValues`)
- Stores in `localStorage` under user UID (`chrona-local-account-v1:{uid}`)

### 2.2 Components
- `createAccount(uid, pin, questionIndexes, answers)`: Creates local account with hashed PIN + salt + security questions
- `loadAccount(uid)`: Reads local account from storage
- `verifyPin(account, pin)`: Compares PBKDF2 hash of input PIN against stored protected value
- `verifyQuestions(account, answers)`: Normalizes answers (`trim`, lowercase, replace whitespace) and compares
- `verifyRecoveryCode(uid, code)`: Checks recovery code acknowledgment
- `updatePin(uid, pin)`: Re-hashes new PIN with same salt
- `updateQuestions(uid, indexes, answers)`: Updates security questions
- `regenerateRecoveryCode(uid)`: Generates new recovery code
- `acknowledgeRecoveryCode(uid)`: Marks recovery code as acknowledged
- `setPrivateLock({uid, reason, lockedAt})`: Stores lock state with timestamp and reason (`locked`, `panic`, `background`)
- `isWeakFallback(account)`: Checks if algorithm is `weak-fallback` (for browsers without `SubtleCrypto`)

### 2.3 Lock Behaviors
- **Panic Lock**: `Ctrl+Shift+L` keyboard shortcut or `panicBtn` click → locks with `reason: 'panic'`
- **Auto-lock**: `visibilitychange` event (`document.hidden`) → locks with `reason: 'background'` if `autoLock !== false`
- **Unlock**: User enters local PIN to unlock session (`unlockLocalPin` input)
- **Lock UI**: `localLockOverlay` shown with error message (`localLockError`)

---

## 3. Profile & Settings System

### 3.1 Profile Fields (cached locally + in Firestore)
```
{
  name: string,
  username: string,
  email: string,
  employeeId?: string,     // from profile data
  role?: string,           // from profile data
  department?: string,     // from profile data
  managerName?: string     // from profile data
}
```

### 3.2 Settings Controller (`createSettingsController`)
- **Inputs bound**: `settingsUsername`, `settingsUsernameText`, `profileHeading`, `settingsEmail`
- **Profile Heading**: Shows `username + "'s space"` or `"Profile & preferences"`
- **Security Settings Section** (`securitySettings`): Shown only if local account exists; hidden (`securityEmpty`) otherwise
- **Setup Security Button** (`setupSecurityBtn`): Hidden if account already exists
- **Auto-lock Toggle** (`autoLockToggle`): Checked by default (`autoLock !== false`)
- **Security Message** (`securityMessage`): Shows `"Your local privacy lock is active"` or fallback warning

---

## 4. Firebase Configuration & Environment

### 4.1 `.env` Variables
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_ADMIN_UID
```

### 4.2 Config Export (`firebase-config.js`)
- Uses `import.meta.env` (Vite-style environment injection)
- `firebaseConfig` object exported for `initializeApp`
- `missingFirebaseEnv()` checks for missing required variables
- `ADMIN_UID` exported for client-side admin checks (`admin.html`)

### 4.3 Firebase Service Factory (`lib/firebase.js`)
- `createFirebaseServices(config)`: Creates `firebaseApp`, `auth`, `firestore`
- Exports `firebaseAuthApi` (auth methods) and `firestoreApi` (firestore methods) for dependency injection/testing

---

## 5. Cache & Sync Layer

### 5.1 IndexedDB Cache (`chrona-ledger` DB, version 2)
- Object store: `app`
- Keys: `DATA_RECORD` (`ledger`), `PROFILE_RECORD` (`profile`), `PENDING_RECORD` (`pendingSync`), `profile:{uid}`, `ledger:{uid}`, `pendingSync:{uid}`
- `createLedgerCache()` factory returns: `getProfile`, `setProfile`, `getLedger`, `setLedger`, `getPending`, `setPending`, `initialize`, `readLocalCache`, `writeLocalCache`

### 5.2 Sync Logic (`ledger/sync.js`)
- `mergeProfile({ cloud, profile, user })`: Merges cloud profile (`name`, `username`, `email`) with cached profile and user email
- `queueCloudSync({ user, profile, data, cache })`: Writes profile/ledger to Firestore + sets pending to false
- `loadCloudLedger({ user, profile, data, cache })`: Reads `ledgers/{uid}` from Firestore, updates cache, returns `{ profile, data }`

---

## 6. Admin Dashboard (`admin.html`)

- Separate admin URL with no public navigation
- Client-side gate checks `currentUser.uid == ADMIN_UID`
- Reads all `usernames` and `ledgers` for admin view
- Allows reading/editing any user ledger
- Allows deleting ledger or lookup document (but intentionally leaves dormant Firebase Auth account — requires Admin SDK/Cloud Function for full Auth user deletion)

---

## 7. Reports / Data Controller (`src/ledger/reports.js`)

- Uses `profile` for employee metadata: `employeeId` (`employeeId` / `employeeID` / `employeeNumber`), `role` (`role` / `title`), `name`, `department`, `managerName` / `manager`
- Generates reports grouped by `day` / `week` / `month`
- CSV export (`exportCsvBtn`) and JSON export (`exportBtn`)

---

## 8. Complete Feature Checklist

```
☑ Firebase Auth (Email/Password backend, PIN front-end)
☑ Username lookup (Firestore, public read)
☑ Profile docs (Firestore, owner/admin write)
☑ Registration with batch writes
☑ Login with username resolution
☑ Cloud PIN change (re-auth required)
☑ Cloud PIN reset (email-based)
☑ Recovery email update (re-auth required)
☑ Profile merge / cloud sync
☑ IndexedDB + localStorage cache
☑ Local device PIN (PBKDF2, 120k iters)
☑ Panic lock + auto-lock
☑ Recovery questions + recovery code
☑ Settings / profile UI controller
☑ Admin dashboard (UID-gated)
☑ Reports controller (profile-aware)
```
