# CourseConnect

CourseConnect is an integrated learning platform that combines a Learning Management System (LMS) with WhatsApp-based communication to create collaborative university classboards. Students can join course-specific groups where they can ask and answer doubts, access curated study materials, and share their own notes. The platform fosters peer-to-peer learning while maintaining organized course content through a centralized system, making academic support more accessible, interactive, and real-time.

🔗 **Live Demo:** [course-connect-eight.vercel.app](https://course-connect-eight.vercel.app)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), JavaScript, CSS |
| Backend | Firebase Cloud Functions (Node.js) |
| Database | Firebase Data Connect / Firestore |
| Hosting | Vercel (client), Firebase (functions) |
| Dev Tools | Firebase Emulators |

---

## Project Structure

```
CourseConnect/
├── client/               # React frontend (Vite)
│   └── dist/             # Production build output
├── dataconnect/          # Firebase Data Connect schema & queries
├── functions/            # Firebase Cloud Functions (serverless backend)
├── firebase.json         # Firebase project configuration
├── firestore.rules       # Firestore security rules
├── firestore.indexes.json
└── .firebaserc           # Firebase project alias
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Firebase CLI](https://firebase.google.com/docs/cli) — `npm install -g firebase-tools`
- A Firebase project set up in the [Firebase Console](https://console.firebase.google.com/)

### 1. Clone the repository

```bash
git clone https://github.com/Daksh1105/CourseConnect.git
cd CourseConnect
```

### 2. Install dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install functions dependencies
cd functions
npm install
cd ..
```

### 3. Configure Firebase

```bash
firebase login
firebase use --add   # Select your Firebase project
```

### 4. Run locally with Firebase Emulators

```bash
firebase emulators:start
```

This starts the following emulators:

| Service | Port |
|---------|------|
| Functions | 5001 |
| Firestore | 8080 |
| Hosting | 5000 |
| Emulator UI | 4000 |

### 5. Run the frontend dev server

```bash
cd client
npm run dev
```

The React app will be available at `http://localhost:5173` by default.

---

## Deployment

### Deploy to Firebase (Functions + Hosting)

```bash
# Build the client first
cd client && npm run build && cd ..

# Deploy everything
firebase deploy

# Or deploy specific services
firebase deploy --only functions
firebase deploy --only hosting
```

The client is deployed to **Vercel** separately. Push to the connected branch or run:

```bash
cd client
vercel --prod
```

---

## Environment Variables

Create a `.env` file inside the `client/` directory with your Firebase project credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> ⚠️ Never commit `.env` files. They are already listed in `.gitignore`.

---

## Scripts

### Client (`client/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |

### Functions (`functions/`)

| Command | Description |
|---------|-------------|
| `npm run lint` | Lint Cloud Functions source |

### Root

| Command | Description |
|---------|-------------|
| `firebase emulators:start` | Start all local Firebase emulators |
| `firebase deploy` | Deploy functions and hosting |

---

## Firestore Security Rules

The current rules (`firestore.rules`) deny all direct client reads and writes by default — all data access is routed through Firebase Cloud Functions:

```
allow read, write: if false;
```

Update these rules as needed to grant scoped access based on authentication.

---

## License

This project is open source. See the repository for details.
