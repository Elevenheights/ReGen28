# ReGen28 – iOS testers via Ionic Appflow

This guide gets your ReGen28 app buildable for iOS in Appflow and distributable to testers via **TestFlight**.

---

## Prerequisites

- **Ionic Appflow** account (you have this).
- **Apple Developer account** (Individual or Organization) – [developer.apple.com](https://developer.apple.com).
- **Mac (one-time)** – Required only to add the `ios` native project to the repo. After that, Appflow builds iOS in the cloud. If you don’t have a Mac, you can use MacInCloud, a friend’s Mac, or a CI job on a Mac runner to run the “Add iOS platform” step once.

---

## 1. Add the iOS platform (once, on a Mac)

Appflow needs the **`ios`** folder in your repo. That folder is created only on macOS (Xcode/CocoaPods).

**On a Mac**, in the project root:

```bash
npm install
npx cap add ios
npx cap sync ios
```

Then **commit and push** the new `ios` folder and any changed config (e.g. `package-lock.json`):

```powershell
git add ios package-lock.json package.json
git commit -m "Add iOS platform for Appflow"
git push
```

If you’re on **Windows only**, options:

- Use **MacInCloud** or similar: open the repo, run the three commands above, commit and push.
- Use **GitHub Actions** (or similar) with a `macos-latest` runner: add a workflow that runs `npx cap add ios && npx cap sync ios`, then commits and pushes the `ios` folder (one-time job).

Your app ID is already **`com.regen28labs`** in `capacitor.config.json`; the generated iOS project will use that.

---

## 2. Apple Developer setup

Do this in [Apple Developer](https://developer.apple.com/account) and [App Store Connect](https://appstoreconnect.apple.com/).

1. **Register the App ID**  
   - Certificates, IDs & Profiles → Identifiers → **+**  
   - App IDs → Continue → **App**  
   - Description: e.g. “ReGen28”  
   - Bundle ID: **Explicit** → `com.regen28labs`  
   - Register.

2. **Create the app in App Store Connect** (if not already):  
   - App Store Connect → **My Apps** → **+** → **New App**  
   - Platform: iOS, name ReGen28, Bundle ID `com.regen28labs`.  
   - Note the **Apple ID** (numeric) and **Team ID** (Membership details in Apple Developer) for Appflow later.

3. **iOS Distribution certificate** (for App Store / TestFlight):  
   - In Xcode: **Xcode → Settings → Accounts** → select team → **Manage Certificates** → **+** → **Apple Distribution**.  
   - Right‑click the new certificate → **Export Certificate** → save as `.p12` and set a password (store it securely).

4. **Provisioning profile (App Store)**  
   - Apple Developer → **Profiles** → **+**  
   - **App Store** (under Distribution)  
   - Select App ID `com.regen28labs`  
   - Select the **Apple Distribution** certificate  
   - Name it (e.g. “ReGen28 App Store”)  
   - Download the `.mobileprovision` file.

You’ll upload the `.p12` and `.mobileprovision` in Appflow in the next step.

---

## 3. Connect the app to Appflow

1. In [Ionic Appflow](https://app.ionic.io/): **Apps** → **Create app** (or use existing).  
2. Choose **Import existing app** → **Capacitor**.  
3. Connect your **Git** repo (GitHub/GitLab/Bitbucket) and select the **regen28** repository.  
4. Ensure the branch you use for builds (e.g. `main`) has the **`ios`** folder and latest code pushed.

---

## 4. Add iOS credentials in Appflow

1. In Appflow: your app → **Package** → **Credentials**.  
2. **Add credential** → **Apple (iOS)**.  
3. **Type**: **Production** (for App Store / TestFlight).  
4. Upload:
   - **Signing certificate**: the `.p12` file.  
   - **Certificate password**: the password you set when exporting.  
   - **Provisioning profile**: the `.mobileprovision` file.  
5. Name it (e.g. “ReGen28 iOS Production”) and save.

---

## 5. Create Apple App Store destination (for TestFlight)

1. In Appflow: your app → **Deploy** → **Destinations** (or **Package** → **Destinations**).  
2. **Add destination** → **Apple App Store**.  
3. Fill in:
   - **Name**: e.g. “ReGen28 TestFlight”
   - **Apple ID**: your Apple ID email (with upload rights).
   - **App-specific password**: from [appleid.apple.com](https://appleid.apple.com) → Security → App-Specific Passwords (requires 2FA).
   - **App Apple ID**: the **numeric** app ID from App Store Connect (ReGen28 app page → General → App Information).
   - **Team ID**: from [Apple Developer → Membership details](https://developer.apple.com/account/#/membership/).

Save the destination.

---

## 6. Run an iOS build in Appflow

1. **Package** → **Builds** → **New build**.  
2. Select the **commit** that includes the `ios` folder (and your latest app code).  
3. **Native build**:
   - **Platform**: **iOS**
   - **Build type**: **App Store** (or **Release** – production signing)
   - **Signing certificate**: the credential you created (e.g. “ReGen28 iOS Production”)
4. Start the build and wait for it to finish.  
5. Download the **IPA** from the build artifacts if you want a local copy.

---

## 7. Deploy to TestFlight

1. After the iOS build succeeds: open that build → **Deploy** (or use **Deploy** tab).  
2. Choose the **Apple App Store** destination you created.  
3. Deploy; Appflow uploads the IPA to App Store Connect.  
4. In **App Store Connect** → your app → **TestFlight**:  
   - Wait for the build to finish processing (can take 5–15 minutes).  
   - Under **Internal Testing** or **External Testing**, add testers (email) or create a **Public Link**.  
   - Testers install via the **TestFlight** app on their iPhone/iPad.

---

## 8. Optional: Automate with CLI

To deploy a specific build to TestFlight from your machine:

```powershell
npx ionic deploy ios --app-id=<APPFLOW_APP_ID> --build-id=<BUILD_ID> --destination="ReGen28 TestFlight"
```

Get **App ID** from Appflow (app overview); **Build ID** from the build detail page.

---

## Quick checklist

- [ ] `ios` folder in repo (added on a Mac, then pushed)
- [ ] App ID `com.regen28labs` registered in Apple Developer
- [ ] App created in App Store Connect
- [ ] iOS Distribution certificate (`.p12`) and App Store provisioning profile (`.mobileprovision`) created
- [ ] Appflow app created and connected to Git
- [ ] iOS Production credential added in Appflow (certificate + profile)
- [ ] Apple App Store destination added in Appflow (Apple ID, app-specific password, App Apple ID, Team ID)
- [ ] First iOS build run and successful
- [ ] Build deployed to Apple; TestFlight processing completed
- [ ] Testers added in App Store Connect → TestFlight

---

## Troubleshooting

- **“No iOS project” / build fails**: Ensure the **`ios`** folder is committed and pushed on the branch you’re building.
- **Signing errors**: Confirm the provisioning profile’s Bundle ID is `com.regen28labs` and the profile type is **App Store**.
- **TestFlight not showing build**: Wait for processing in App Store Connect; check **Activity** and email for any compliance or processing errors.
- **Firebase / Google Sign-In on iOS**: Ensure you’ve added the iOS app in Firebase Console and, if needed, updated `GoogleService-Info.plist` in the `ios` project (then commit and rebuild).

Once the first iOS build and TestFlight upload work, you can repeat “Run an iOS build” → “Deploy to TestFlight” for every new version you want testers to try.
