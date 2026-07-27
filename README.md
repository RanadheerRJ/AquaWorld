# AquaWorld

Dashboard for 30-Gal Tank & Sump control.

## Live Page (GitHub Pages)

Once enabled in repo settings:
**https://ranadheerRJ.github.io/AquaWorld/**

## Enable GitHub Pages

1. Go to https://github.com/RanadheerRJ/AquaWorld/settings/pages
2. Source: **Deploy from a branch**
3. Branch: `arena/019fa1e0-aquaworld` (or `main` after merge)
4. Folder: `/ (root)`
5. Save — site will be live at the link above.

## Firebase Setup (for persistent cloud data)

1. Create a Firebase project at https://console.firebase.google.com/
2. Add a Web app and copy the SDK config.
3. Replace the placeholder values in `firebase-config.js`.
4. In Firestore, create a `todos` collection.
5. Reload the page — data will sync to the cloud and survive cache clears.

## Features

- 30-Gal Setup Checklist (add / delete / complete)
- Tank Devices: Return Pump, Heater, Powerhead
- Sump Devices: Sump Return Pump, Protein Skimmer, ATO System
- Live simulated updates
- Fully responsive ocean-themed design
