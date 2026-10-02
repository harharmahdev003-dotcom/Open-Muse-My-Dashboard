# Start OpenMuse on Windows

## Start the local app

Install Node.js 22 or newer and pnpm once. In PowerShell, run:

```powershell
cd C:\open-muse
pnpm install
pnpm start:local
```

The script starts the API in a minimized PowerShell window and the web interface in the current window. Open [http://localhost:8081](http://localhost:8081). After the next laptop restart, run `pnpm start:local` again. It checks ports first and reuses existing services instead of stopping them. Press Ctrl+C in the web window to stop that web server; close the minimized API window to stop the API.

The default is local sample mode. You can use Today, sample mail/calendar, Projects, Routines, goals and saved tasks. The sample assistant supports guided workflows; general model chat needs a provider and model configured in `.env`. A temporary local Intelligence placeholder lets the sample API start, but saved CopilotKit cloud threads fall back to local conversation history.

## Browser and Linux computer

Install and start Docker Desktop, then run `pnpm start:local` again. When Docker is available, the script starts the isolated Chromium browser worker and builds the optional Linux computer image. The Browser and Terminal controls are not Windows desktop control: Browser is a separate Chromium session, and Terminal is a sandboxed Linux container with no network access. Saved profiles/files live under Docker-managed storage.

If Docker is not running, OpenMuse still opens normally; those computer features show as offline/unconfigured. The app never attempts to access your Windows files or run commands on the Windows host.

## Connect your own Google account

The sample workspace uses fictional Gmail and Calendar entries; the sample Connect button is intentionally replaced with setup instructions. Real OAuth requires a live deployment, a Google OAuth client ID and secret, a token encryption key, and the exact public API callback registered in Google Cloud Console. Set `WORKSPACE_MODE=live` and those values in the server's private `.env`, restart the API, then connect Google from **Apps**. Never put Google credentials in Expo/public variables.

## Add model-backed chat

In `.env`, choose `AGENT_BACKEND=model`, set `MODEL` to a supported provider/model ID, and provide that provider's server-side API key. Keep `.env` private. Restart the API after editing. Without that setup, local sample mode still provides guided task flows and the rest of the workspace.

## OpenBot and service tiers

OpenBot is an adapter extension point, not a bundled running backend. It is not required for OpenMuse's regular features. CopilotKit Intelligence is an external service for saved cloud conversations; without a valid project key/network access, OpenMuse uses local conversation history. Any external model, Google API, or hosting service may have its own account, quota, and billing terms; check that provider directly. There is no single OpenMuse subscription tier for these optional services.
