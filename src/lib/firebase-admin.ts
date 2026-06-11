import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App;

function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!serviceAccount) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY env var is missing");
      }
      adminApp = initializeApp({
        credential: cert(JSON.parse(serviceAccount)),
      });
    }
  }
  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
