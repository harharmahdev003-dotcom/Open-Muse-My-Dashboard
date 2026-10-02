# Project workspaces

Projects are owner-scoped workspaces for ongoing efforts such as a course, job search, or software project. They are stored in OpenMuse's existing database and can be used from the Projects screen or Chat.

## What a project contains

- Name, description, status, and optional instructions for project-related delegated work.
- Tasks and goals linked to the project.
- Notes, reference links, and attached files.
- A bounded activity view built from saved task progress and run events.

Project instructions are included as context when an explicitly linked task runs. They are treated as user data and do not override system safety rules. Project context is bounded to recent tasks, goals, notes, links, files, and activity so a large workspace cannot produce an unbounded prompt.

## Daily use

1. Create a project from **Projects** and add a short description and useful instructions.
2. Add notes, links, and relevant files; create tasks from the project detail screen or Chat.
3. Link goals to the project so the project page shows both immediate work and longer-term progress.
4. Review task state and recent activity from the project page or **Activity**.
5. Archive completed projects to keep them out of project selection. Archiving preserves their task and goal records.

Chat can list, create, and resolve projects by an exact name. If the name is ambiguous, select the intended project in the app and retry. When asking Chat to create a task, explicitly name the project if you want it linked.

## Data and current limits

Project records and relationships use OpenMuse's current owner-scoped PGlite/Postgres store. Each API request is scoped to the authenticated workspace owner. There is no project sharing or multi-user collaboration layer. Files remain in the existing Files subsystem; project links reference file records rather than duplicating file contents. Archive is reversible by changing the project's status back to active.
