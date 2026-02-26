export type FirebaseConfig = {
  apiKey: string;
  databaseURL: string;
  projectId: string;
  appId: string;
};

const readFirebaseEnv = (): FirebaseConfig => ({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
});

export const firebaseConfig = readFirebaseEnv();

export const hasFirebaseSdkConfig = () =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
