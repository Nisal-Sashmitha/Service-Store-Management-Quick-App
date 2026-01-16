import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

export type FirebaseEnv = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export function getFirebaseEnv(): FirebaseEnv {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  }
}

export function isFirebaseConfigured(env: FirebaseEnv): boolean {
  return Boolean(env.apiKey && env.authDomain && env.projectId && env.appId)
}

let app: FirebaseApp | undefined
let db: Firestore | undefined

export function getDb(): Firestore {
  if (db) return db

  const env = getFirebaseEnv()
  if (!isFirebaseConfigured(env)) {
    throw new Error(
      'Firebase env vars are missing. Copy .env.example to .env and fill in your Firebase web app config.',
    )
  }

  app = initializeApp({
    apiKey: env.apiKey,
    authDomain: env.authDomain,
    projectId: env.projectId,
    storageBucket: env.storageBucket,
    messagingSenderId: env.messagingSenderId,
    appId: env.appId,
  })
  db = getFirestore(app)
  return db
}

