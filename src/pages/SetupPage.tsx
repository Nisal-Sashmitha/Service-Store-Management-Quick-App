export function SetupPage() {
  return (
    <div className="page">
      <div className="card">
        <div className="pageTitle">Firebase setup required</div>
        <p className="muted">
          Copy <span className="mono">.env.example</span> to <span className="mono">.env</span> and fill in your Firebase
          web app config. Then restart the dev server.
        </p>
        <pre className="codeBlock">Copy-Item .env.example .env</pre>
      </div>
      <div className="card">
        <div className="sectionTitle">Firestore rules (dev-only)</div>
        <p className="muted">
          This MVP has no auth. For local development, set Firestore rules to allow read/write. Do not use open rules in
          production.
        </p>
        <pre className="codeBlock">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
      </div>
    </div>
  )
}
