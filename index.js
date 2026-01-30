const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.requestWithdrawal = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const uid = context.auth.uid;
  const amount = Number(data.amount);
  const method = data.method;

  if (amount < 50) {
    throw new functions.https.HttpsError("invalid-argument", "Minimum withdrawal is R50");
  }

  if (amount > 2000) {
    throw new functions.https.HttpsError("invalid-argument", "Maximum withdrawal is R2000");
  }

  const walletRef = admin.firestore().doc(`wallets/${uid}`);
  const walletSnap = await walletRef.get();

  if (!walletSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Wallet not found");
  }

  const balance = walletSnap.data().balance || 0;
  if (balance < amount) {
    throw new functions.https.HttpsError("failed-precondition", "Insufficient balance");
  }

  const pending = await admin.firestore()
    .collection("withdrawals")
    .where("uid", "==", uid)
    .where("status", "==", "pending")
    .get();

  if (!pending.empty) {
    throw new functions.https.HttpsError("failed-precondition", "Pending withdrawal exists");
  }

  await walletRef.update({
    balance: admin.firestore.FieldValue.increment(-amount)
  });

  await admin.firestore().collection("withdrawals").add({
    uid,
    amount,
    method,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});
