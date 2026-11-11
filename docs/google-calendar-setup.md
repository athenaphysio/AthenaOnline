# Switching on the Google Calendar link

The diary planner works without this: clients and PAs can place sessions in the app straight away. These steps switch on the part that puts each planned session into an "Athena Training" calendar in the client's Google account. You do them once.

## 1. Make a Google Cloud project

1. Go to console.cloud.google.com and sign in with the Google account you want to own the app's Google settings.
2. At the top of the page, open the project list and choose **New project**. Call it "Athena Online" and create it.

## 2. Switch on the Google Calendar API

1. In the search bar at the top, type **Google Calendar API** and open it.
2. Press **Enable**.

## 3. Set up the sign in screen clients will see

1. Open **Google Auth Platform** (search for "OAuth consent screen" if you can't see it).
2. Choose **External** as the audience.
3. App name: **Athena Online**. Support email: your email. Add your logo if you like.
4. App home page: `https://app.drdavidsilverphd.com`. Privacy policy: `https://app.drdavidsilverphd.com/legal/privacy`. Terms: `https://app.drdavidsilverphd.com/legal/terms`.
5. Under **Data access** (or Scopes), add these three:
   - `openid`
   - `.../auth/userinfo.email`
   - `https://www.googleapis.com/auth/calendar.app.created`
6. While the app is in **Testing**, add the Google email of each test client under **Test users**. Up to 100 people can use it in testing.

## 4. Make the keys

1. Open **Clients** (or Credentials), then **Create client**.
2. Application type: **Web application**. Name: "Athena Online".
3. Under **Authorised redirect URIs**, add exactly:
   `https://app.drdavidsilverphd.com/api/google-calendar/callback`
4. Create it. Google shows a **Client ID** and a **Client secret**.

## 5. Put the keys into Vercel

1. In Vercel, open the Athena Online project, then **Settings**, then **Environment Variables**.
2. Add `GOOGLE_CLIENT_ID` with the Client ID, and `GOOGLE_CLIENT_SECRET` with the Client secret, for Production.
3. Redeploy (Deployments, the latest one, then Redeploy) so the app picks them up.

## 6. Before going beyond test clients

Once the test run has gone well, press **Publish app** on the Audience page and submit it for Google's verification. Google checks the app's name, logo, home page and privacy policy, and why it needs the calendar permission. A short explanation that works well: "The app creates one calendar called Athena Training in the user's account and writes their planned training sessions to it. It cannot see any other calendar."

## 7. For each client company

If a client's company manages their Google accounts, its Google administrator may need to allow the app. They do this in the Google Admin console under Security, API controls, App access control, by marking Athena Online as trusted. Point them to the fact that the app can only reach the one calendar it creates.
