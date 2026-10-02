# Using OpenMuse day to day

OpenMuse is a self-hosted personal agent. The **Today** screen is the daily starting point: it puts calendar events, unread mail, pending reviews, open task count, active task status, recent activity, and goal progress in one view. **Plan my day** opens Chat with a planning prompt; the assistant's answer and any delegated work remain available in the existing chat and Activity views.

## A practical routine

1. Open **Today** to scan the day's calendar, inbox, work waiting for review, active tasks, and goals.
2. Select **Plan my day** or ask a specific question in **Chat**, such as what needs attention or which task is waiting on you.
3. Delegate work when you want OpenMuse to keep working in the background. **Activity** shows the saved plan, progress, requests for input, approvals, retries, and receipts. Work is stored durably; keep the API server running for background tasks.
4. Keep long-running efforts in **Projects**: link tasks and goals, collect notes/files/reference links, and add project instructions for linked delegated work.
5. Create a **Routine** for repeatable read-and-plan work. Choose the built-in steps, local schedule and time zone; new routines are disabled until you review and enable them. Run one immediately to see its durable task and report.
6. Use **Goals** to track milestones or create a public-page watch. Use **Apps** to connect Google, review available integrations, and edit personal context.
7. Return to **Today** to pick up unfinished work. Open a task card to continue in its Activity record.

## What the app can connect

- Gmail and Google Calendar through server-side Google OAuth. Read and draft workflows are available; sending mail and changing calendar events require a separate review in OpenMuse.
- A persistent Chromium browser worker for public web research and user takeover.
- An optional isolated Linux computer in Docker, with bounded terminal commands, files, PDF transfer, and saved receipts. Its terminal has no network access and is not a Windows desktop.
- A model provider for open-ended agent work and a CopilotKit Intelligence project key for conversation persistence. Provider keys stay on the server.

The local sample workspace is useful for trying the UI and built-in flows. Live Google data and model-backed reasoning require the relevant credentials. Setup steps and exact environment variable names are in the [quick start](../README.md) and [.env.example](../.env.example).

## App shape

```text
Expo client (web, iOS, Android)
            |
       Hono API
       /  |  \
 tasks  Google  CopilotKit agent
   |       |        |
PGlite/   Gmail   browser worker
Postgres Calendar  optional Docker computer
```

The API owns credentials, tool execution, approvals, and task persistence. The mobile/web client renders results and asks for approval when an action needs it. Local storage uses PGlite; PostgreSQL is supported for a separate task worker. This release is designed for one workspace owner per deployment.

## Current limits

Scheduled routines are checked by the running server and currently support only built-in read-and-plan steps; they do not execute arbitrary code or perform external actions. OpenMuse does not currently include a Windows companion, unrestricted host-shell access, voice input, or phone push notifications. It also does not silently send mail, perform purchases, or operate a financial account. See the [Projects guide](PROJECTS.md), [Routines guide](ROUTINES.md), [feature inventory](FEATURES.md), [roadmap](../ROADMAP.md), and [security guide](../SECURITY.md) before enabling a remote deployment.
