# Routines

Routines are saved, owner-scoped schedules that create durable OpenMuse tasks. They appear in **Routines**, can be run manually, and can be linked to a project. Scheduled routines are checked by the existing server maintenance loop about once a minute; keep the API/task worker running for scheduled work to execute.

## Supported steps

Routine steps run in the order shown and currently use a fixed allowlist:

- Today's calendar events.
- Unread mail summary.
- Open task summary.
- Summary of the selected project.
- Daily plan assembled from available workspace context.

These built-in steps read workspace state and save a plan/report as a task artifact. A routine cannot contain arbitrary code or issue external side effects such as sending mail or changing calendar events. Those actions remain in the normal reviewed workflow.

## Create and run

1. Open **Routines** and choose **New routine**.
2. Add a name, optional description and project, then add steps in the order you want.
3. Choose a daily or weekly schedule, time, and IANA time zone (for example `Asia/Kolkata`). New routines start disabled so you can review the setup first.
4. Save, open the routine, edit it to enable the schedule, or choose **Run now** for an immediate durable task.
5. Open a run to see its ordered step events, result artifact, and completion status.

Daily schedules follow local wall-clock time in the selected time zone, including daylight-saving changes. Weekly schedules require at least one weekday. If the server was down at a scheduled time, maintenance will recover the due occurrence after restart; the server does not provide a separate hosted scheduler.

## Current limits

Routines are single-owner and run only the built-in capabilities above. There are no push notifications, voice triggers, arbitrary generated workflows, or Windows desktop actions. Disabling or archiving a routine prevents future scheduled runs; existing task history is retained.
