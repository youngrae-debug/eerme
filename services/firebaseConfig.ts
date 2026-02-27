export type FirebaseConfig = {
  apiKey: string;
  databaseURL: string;
  projectId: string;
  appId: string;
};

const readFirebaseEnv = (): FirebaseConfig => ({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyCTe1oUQnVcwTeUzy7oQVoM0O1ZnNMoR1A",
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? "https://eerme-e8335-default-rtdb.firebaseio.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "eerme-e8335",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "com.eerme.app",
});

export const firebaseConfig = readFirebaseEnv();

export const hasFirebaseSdkConfig = () =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
