const admin = require('firebase-admin');
const serviceAccount = require('./firebase-google-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const Config = {
  apiKey: "AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "XXXXXXXXXXXX.firebaseapp.com",
  projectId: "XXXXXXXXXXXX",
  storageBucket: "XXXXXXXXXXXX.firebasestorage.app",
  messagingSenderId: "220000000000",
  appId: "1:220000000000:web:c35128bdb4b2c6dcf29b8e",
  measurementId: "G-G0XXXXXXXX",
  useGoogleAuth: process.env.USE_GOOGLE_AUTH ? process.env.USE_GOOGLE_AUTH === 'true' : true
};

module.exports = { admin, Config };


/*
How to enable 'Authentication':

1. Authentication
2. Go to https://console.firebase.google.com/
3. Select the Firebase project you want.
4. All Products -> Authentication -> Start.
5. Click the 'Sing-in method' tab
6. 'Add New Provider' -> Enable 'Google'

How to get files firebase-google-service-account.json:

1. Go to https://console.firebase.google.com/
2. Select the Firebase project you want.
3. Click the gear icon (Settings) in the top left corner, then select "Project settings."
4. In the "Service accounts" tab, click the "Generate new private key" button.
5. A JSON file containing the credentials will automatically download to your computer.
6. Save the file in the 'config/' folder and name it 'firebase-google-service-account.json'.


How to get Config ( SDK setup and configuration ):

1. Go to https://console.firebase.google.com/
2. Select the Firebase project you want.
3. Click the gear icon (Settings) in the top left corner, then select "Project settings."
4. Look for the 'Your apps' section.
5. Copy the Firebase configuration object that contains the keys and identifiers for your app.
*/