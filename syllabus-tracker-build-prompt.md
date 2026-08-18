# Build Prompt: Syllabus-to-Calendar Tracker

Use this with Claude Code, Cursor, v0, or any AI coding assistant. Adjust the stack section if you have a preference.

---

## Prompt

Build a web app called **[YOUR APP NAME]** — a syllabus tracker for college students. Students upload a syllabus (PDF, image, or pasted text), an AI model extracts all assignments, exams, and deadlines into structured data, and the app displays them as a clean calendar/timeline with reminders.

### Tech stack
- Frontend: React + Tailwind CSS
- Backend: Node.js (Express) or Next.js API routes
- Database: PostgreSQL via Supabase (also gives free auth)
- AI: Claude API (claude-sonnet-4-6) with vision support for scanned syllabi
- Calendar sync: Google Calendar API (OAuth)
- Email reminders: Resend or SendGrid (free tier), triggered by a daily cron job

### Core features (MVP)

1. **Auth** — email/password or Google OAuth via Supabase Auth.
2. **Syllabus upload** — accept PDF, image (jpg/png), or pasted text. For PDFs, extract text server-side; for images or messy PDFs, send the file directly to Claude's vision input instead of relying on OCR.
3. **AI extraction** — send the syllabus content to Claude with a system prompt instructing it to return **strict JSON only**, matching this schema:
   ```json
   {
     "course_name": "string",
     "assignments": [
       {
         "title": "string",
         "due_date": "YYYY-MM-DD",
         "due_time": "HH:MM or null",
         "type": "homework | exam | project | reading | quiz | other",
         "weight_percent": "number or null"
       }
     ]
   }
   ```
   Include a few-shot example in the prompt and instruct the model to return `[]` for assignments it can't confidently date, rather than guessing.
4. **Review/edit screen** — show extracted assignments before saving, so the user can fix any AI mistakes (dates are the highest-risk field to get wrong).
5. **Dashboard** — a timeline/calendar view of all courses combined, sortable by due date, with overdue items flagged.
6. **Google Calendar sync** — push confirmed assignments as calendar events via the Google Calendar API (OAuth consent flow).
7. **Email reminders** — a daily scheduled job that emails users about anything due in the next 24–72 hours.
8. **Grade calculator** (optional but nice) — given assignment weights and entered scores, calculate current grade and "what you need on remaining work" to hit a target grade. Pure frontend logic, no AI needed.
9. **Overdue flagging** — visually distinguish overdue items from upcoming ones on the dashboard, not just sorted by date.
10. **Streaks** — track consecutive days the user has checked off at least one task or logged in, as a lightweight engagement hook.
11. **Multi-course single view** — combine all uploaded courses into one unified timeline/dashboard rather than separate per-course pages.

### Stretch features (paid-tier-style, add later if you monetize)
- **SMS/text reminders** — via Twilio, in addition to email (adds real infra cost, so gate behind a paid tier).
- **Push notifications** — requires a mobile app or PWA with device token management.
- **Gamification** — badges, streak rewards, or progress bars beyond the basic streak counter.
- **Unlimited uploads** — free tier can cap syllabus uploads (e.g. 3–5 courses); paid tier removes the cap.
- **Parent/multi-student accounts** — one login managing several students' schedules, with progress tracking and monitoring for the parent.
- **Outlook/Apple Calendar sync** — Google Calendar covers the MVP; add the others once that flow is proven.

### Design direction
- Clean, calm, low-clutter — this is for stressed students, not a dashboard for power users.
- Timeline or agenda view as the default (not a dense month grid).
- Color-code by course.
- Mobile-first responsive layout.

### Explicitly out of scope for v1
- SMS/push notifications and gamification (see Stretch features above — add later if you want a paid tier)
- LMS (Canvas/Brightspace) direct integration — syllabus upload only for now
- Multi-student/parent accounts
- Outlook/Apple Calendar sync (Google Calendar only for v1)

### Constraints
- Keep AI costs low: cache extraction results, don't re-parse on every view, and cap syllabus uploads per free user if usage grows.
- Do not copy any existing app's branding, name, logo, or exact UI — this should be an original implementation of the "AI reads a syllabus → calendar" concept.

Start by scaffolding the project structure, then implement upload → AI extraction → review screen as the first working slice before building calendar sync or reminders.
