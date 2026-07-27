# chrona-profile-module

Reusable Firebase Auth / Profile / Local Security module. Drop into any Git repo.

Based on the `arena/019f834c-tracker` branch of [RanadheerRJ/Tracker](https://github.com/RanadheerRJ/Tracker).

## What it gives you

| Area | Features |
|---|---|
| **Cloud Auth** | Username + PIN login (`passwordFor(pin)` transforms PIN to Firebase Auth password), email recovery reset, PIN change, recovery email update |
| **Profile** | `ledgers/{uid}` (name, username, email, data) + `usernames/{username}` lookup (public read for login resolution) |
| **Local Security** | Separate device PIN (`PBKDF2-SHA-256`, 120k iterations, random salt), panic lock (`Ctrl+Shift+L`), recovery questions/codes, auto-lock on `visibilitychange` |
| **UI** | Account gate (`login` / `register`), greeting (`— Name's ledger`), settings controller |
| **Sync** | `mergeProfile`, `queueCloudSync`, `loadCloudLedger` |
| **Cache** | IndexedDB (`chrona-ledger`) + `localStorage` with profile/ledger/pending keys |
| **Admin** | `admin.html` template + `firestore.rules` with admin UID sync |

## Quick start

### 1. Copy the module into your repo

```bash
git clone <your-repo>
cp -r path/to/chrona-profile-module your-app/src/chrona-profile-module
```

### 2. Set environment variables (`.env`)

Copy `config/.env.example` to `.env` and fill Firebase Console values:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_FIREBASE_ADMIN_UID=your-admin-uid
```

### 3. Publish Firestore rules

Copy `config/firestore.rules` to Firebase Console → Firestore Database → Rules.

Update the admin UID in both `.env` (`VITE_FIREBASE_ADMIN_UID`) and `firestore.rules` (`isAdmin()`).

### 4. Install Firebase peer dependency

```bash
npm install firebase
```

### 5. Use in your app

```js
import {
  registerAccount,
  loginAccount,
  openApp,
  showAccountGate,
  createFirebaseServices,
  createSettingsController,
} from 'chrona-profile-module';

// Initialize
const { auth, firestore } = createFirebaseServices();

// Register a new user
await registerAccount({
  auth,
  firestore,
  values: { name: 'Alice', username: 'alice', email: 'alice@example.com', pin: '1234', confirm: '1234' },
  data: {},
});

// Log in
await loginAccount({ auth, firestore, username: 'alice', pin: '1234' });
```

## Module exports

```js
import {
  // Auth
  registerAccount, loginAccount, sendCloudPinReset,
  changeCloudPin, updateRecoveryEmail,
  // Auth UI
  showAccountGate, openApp, bindAccountForms, setGreeting,
  // Security
  createLocalAccount, loadLocalAccount, verifyPin,
  setPrivateLock, updatePin, verifyRecoveryCode,
  // Settings
  createSettingsController,
  // Firebase
  createFirebaseServices, firebaseAuthApi, firestoreApi,
  // Utilities
  usernameFor, emailFor, passwordFor, validPin,
  // Cache / Sync
  createLedgerCache, mergeProfile, loadCloudLedger,
} from 'chrona-profile-module';
```

## File structure

```
chrona-profile-module/
  src/
    index.js              # Main exports
    auth/
      account.js          # register, login, reset, change PIN, update email
      ui.js               # account gate, greeting, bind forms
    security/
      local-security.js   # device PIN (PBKDF2), panic lock, recovery
    settings/
      settings.js         # profile/settings controller
    lib/
      firebase.js         # Firebase init + auth/firestore APIs
      firebase-config.js  # Vite env-backed config + admin UID
      utils.js            # username/email/pin helpers
    ledger/
      cache.js            # IndexedDB + localStorage cache factory
      sync.js             # profile/ledger cloud sync
  config/
    .env.example          # Environment template
    firestore.rules       # Firestore security rules
```

## Using with any git repo

Because this is a plain directory (not a package with build steps), you can:

- **Copy** it into any repo (`cp -r`)
- **Git submodule** it (`git submodule add ...`)
- **NPM link** it (`npm link` or `npm install file:...`)
- **Publish** to a private registry (`npm publish` from the module folder)

It has no build step — just `import` from the `.js` files directly.

## Important security notes

- The cloud PIN (`4–6` digits) is lower entropy than normal passwords. The design preserves backward compatibility with the `passwordFor(pin) = 'tlk_' + pin` scheme.
- `usernames/{username}` is readable (`allow read: if true`) so unauthenticated clients can resolve usernames to Firebase Auth emails before signing in. This exposes the account email in lookup docs — a deliberate tradeoff.
- The local device PIN does **not** encrypt IndexedDB/localStorage records. It only prevents casual same-device access.
- The admin UID (`ADMIN_UID`) is duplicated in `.env` and `firestore.rules`. Keep them in sync.

## License

MIT
