# 🎾 Padel Shmadel

A shared padel game signup app. Players enter their name and available time window for the next 10 days. When 4 players share a common 1.5-hour window, the day turns green.

---

## Setup — takes about 10 minutes

### 1. Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name (e.g. `padel-shmadel`) → Continue through the steps
3. In the left sidebar, click **Build → Firestore Database**
4. Click **Create database** → choose **Start in test mode** → pick any region → Done

### 2. Get your Firebase config keys

1. In Firebase Console, click the ⚙️ gear icon → **Project settings**
2. Scroll down to **Your apps** → click the `</>` (Web) icon
3. Register the app (any nickname) — you'll see a config object like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

4. Copy these values — you'll need them in the next step.

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your Firebase values:

```bash
cp .env.example .env
```

Then edit `.env`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 4. Test locally (optional)

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploy to Vercel

### Option A — via GitHub (recommended)

1. Push this folder to a GitHub repository
2. Go to [https://vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. In **Environment Variables**, add each of the 6 `VITE_FIREBASE_*` variables from your `.env` file
4. Click **Deploy** — done!

### Option B — via Vercel CLI

```bash
npm install -g vercel
vercel
```

When prompted, add your environment variables. Or add them afterward in the Vercel dashboard under **Settings → Environment Variables**.

---

## How it works

- **Shared data** — all signups are stored in Firebase Firestore and sync in real time across all users
- **10 rolling days** — always shows today + 9 future days; past days disappear automatically
- **Green section** — appears when 4+ players have a common 1.5-hour overlap
- **Book checkbox** — one person per day can claim booking responsibility; others are grayed out
- **Add more players** — click the link below any day to add a 5th, 6th, etc.

---

## Firestore security note

The setup above uses **test mode** which allows open read/write for 30 days. Before that expires, go to **Firestore → Rules** and set a basic rule to keep it open (since there's no login):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

This is fine for a private group of friends. If you want to restrict access, you'd need to add Firebase Authentication.
