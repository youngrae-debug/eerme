import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { Database, getDatabase } from "firebase/database";
import { firebaseConfig } from "./firebaseConfig";

const buildConfig = (): FirebaseOptions => ({
  apiKey: firebaseConfig.apiKey,
  appId: firebaseConfig.appId,
  databaseURL: firebaseConfig.databaseURL,
  projectId: firebaseConfig.projectId,
});

let cachedAuth: ReturnType<typeof getAuth> | null = null;
let cachedDatabase: Database | null = null;

export const getFirebaseApp = (): FirebaseApp => {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(buildConfig());
};

export const getFirebaseAuthClient = () => {
  if (cachedAuth) return cachedAuth;

  const app = getFirebaseApp();

  try {
    cachedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    cachedAuth = getAuth(app);
  }

  return cachedAuth;
};

export const getFirebaseDatabaseClient = () => {
  if (cachedDatabase) return cachedDatabase;

  const app = getFirebaseApp();
  cachedDatabase = getDatabase(app);

  return cachedDatabase;
};
