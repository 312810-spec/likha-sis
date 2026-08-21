// functions/index.js
// Entry point for LIKHA-SIS's scheduled Cloud Functions. Each sync job
// lives in its own file under functions/ and is re-exported here.

import { initializeApp } from "firebase-admin/app";

initializeApp();

export { syncPagasaBulletins } from "./syncPagasaBulletins.js";
export { syncDepedCalendar } from "./syncDepedCalendar.js";
