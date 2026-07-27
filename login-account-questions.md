# Questions for Building Your Login / Profile System

Based on the detailed feature breakdown (`login-account-features.md`), please clarify the following so I can design it exactly how you want:

## 1. Scope & Format
- [ ] Should this be a **standalone repo/template** you can clone (like `chrona-profile-module`)?
- [ ] Or should it be a **sub-package/module** inside an existing project?
- [ ] Should it include the **local device PIN** (`PBKDF2`, panic lock, recovery questions) or only the **cloud Firebase Auth** part?
- [ ] Should it include the **admin dashboard** (`admin.html`, admin UID sync) or is that out of scope?

## 2. Authentication Method
The Tracker branch uses a specific design: **username + PIN** where PIN (`4–6` digits) is transformed to `passwordFor(pin) = 'tlk_' + pin` and used as the Firebase Auth password.
- [ ] Keep **username + PIN** exactly as designed?
- [ ] Change to standard **email + PIN** (no username lookup)?
- [ ] Change to standard **email + full password** (drop the PIN concept)?
- [ ] Keep PIN but allow **longer passphrases** (instead of `4–6` digits)?
- [ ] Should the `usernames/{username}` lookup remain **publicly readable** (needed for username login), or should it be protected (requires backend/cloud function for resolution)?

## 3. Firebase Setup & Deployment
- [ ] Will you manually manage `.env` variables and publish `firestore.rules` to Firebase Console?
- [ ] Should I include an automated setup script (`npm run setup:firebase`) or just documentation?
- [ ] Should the admin UID (`ADMIN_UID`) remain manually synchronized between `.env` and `firestore.rules`, or should I add a check script (`npm run check:admin-uid`) to catch mismatches?
- [ ] Should I include `firebase.json` / `.firebaserc` for Firebase Hosting deployment, or stick to static host (GitHub Pages / Vercel / Netlify) only?

## 4. Profile & Data Features
- [ ] Should the profile store only `{ name, username, email, data }`, or should it include the extra fields from reports (`employeeId`, `role`, `department`, `managerName`)?
- [ ] Should profile data be **user-editable** from Settings (`updateRecoveryEmail` updates email; `changeCloudPin` updates PIN), or read-only?
- [ ] Should profile sync (`mergeProfile`, `loadCloudLedger`, `queueCloudSync`) work automatically on app load, or only when manually triggered?

## 5. Cache & Offline
- [ ] Should the module include the **IndexedDB cache** (`chrona-ledger` DB) for offline-first behavior?
- [ ] Should it fall back to `localStorage` only (no IndexedDB)?
- [ ] Should it include data import/export (`JSON` backup + `CSV` reports)?
- [ ] Should it include the full **calendar/ledger** app (timesheet), or just the auth/profile layer?

## 6. Security & Privacy
- [ ] Should the **local device PIN** be mandatory, optional, or excluded?
- [ ] Should recovery questions (`verifyQuestions`) and recovery codes (`regenerateRecoveryCode`) be included?
- [ ] Should there be a **panic lock** (`Ctrl+Shift+L`) feature, or just manual lock?
- [ ] Should the module include warnings about the privacy tradeoff (`usernames` lookup exposes email) in the docs/code comments?

## 7. Testing & Quality
- [ ] Should I copy the existing `tests/auth-account.test.js` and `tests/ledger-sync.test.js` into the module?
- [ ] Should I add a `tests/` folder with basic Vitest/Jest tests for auth flows?
- [ ] Should I include lint/format configs (`eslint.config.js`, `.prettierrc`)?

## 8. Build Tooling
The original Tracker repo uses Vite (`vite.config.js`, `.env` via `import.meta.env`).
- [ ] Keep Vite-style environment (`import.meta.env.VITE_FIREBASE_*`)?
- [ ] Or convert to standard `process.env` / `dotenv` for broader compatibility (`Node.js` / other bundlers)?
- [ ] Should the module include a `build` script (`npm run build`) to output a `dist/` bundle, or remain source-only?

---

# How to Answer

Reply with numbers and letters (e.g., `1-A, 2-C, 3-B`) or describe in plain text what you want. Once I know:

- The format (repo / package / sub-module)
- The auth method (username+PIN / email+PIN / standard)
- Whether to include local PIN + admin + sync + tests
- The build/environment preference

...I will build the exact module/repo you need.
