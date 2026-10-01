# My Timeline 🕰️

A soft, light-themed personal timeline website. You add entries manually — each entry
has a **title**, **image**, **description**, **date created**, **date modified**, and a
**share button**.

Built with plain **HTML, CSS and JavaScript** only — no frameworks, no build step.

## Run it

Open `start-server.bat` (double-click) — it serves the app at
http://localhost:8123 and opens it in your browser. Keep the window open
while using the app; Google sign-in needs this server running to complete.

Alternatively: `python -m http.server 8123`, `npx serve .`, or open
`index.html` directly (everything except Google sign-in works from a
direct file open).

## Features

- **Add entries manually** via a modal form (title, event date, description, image)
- **Categories** — tag each entry as *Games release*, *Event* or *Personal*; the
  category shows as a coloured badge at the top of its card
- **Category filter chips** — a row of pill filters below the header (All +
  one per category); on small screens the row scrolls horizontally
- **Event date & time picker** — optional; leave it empty to place the entry at "now".
  The timeline is **sorted by this date** (e.g. a release or event date), with the
  entries **closest to today** shown first
- **Images** — upload from your device (auto-compressed) or paste an image URL
- **Vertical timeline layout** — cards alternate left/right on desktop, stack on mobile
- **Date created** set automatically when you save; **date modified** updates on edit
- **Share button** — uses the native share sheet where available, otherwise copies
  a link to that entry to your clipboard (the link scrolls to and highlights the card)
- **Edit / delete** any entry
- **Backup / export / import** — Export downloads every entry as a JSON file;
  Import reads a backup and either **merges** it into the current timeline
  (duplicates by id are skipped) or **replaces** everything
- Entries persist in `localStorage` — they stay in your browser between visits

## Cloud sync (optional)

The timeline works fully offline in localStorage. To sync across devices:

1. Create a Supabase project (free tier is enough) and run `supabase-setup.sql`
   in its SQL Editor — this creates the table, Storage bucket and Row Level
   Security policies (each signed-in user only sees their own data)
2. Enable Google as an auth provider (Supabase → Authentication → Providers),
   pointing it at a Google OAuth client you create in Google Cloud Console
3. Put your Project URL + anon key in `supabase-config.js`

Sign in via **⋯ → Sign in with Google**. Guests keep using localStorage, and
**⋯ → Migrate local entries** uploads existing local entries to the cloud once.

## Files

| File         | Purpose                     |
| ------------ | --------------------------- |
| `index.html` | Page structure & modal form |
| `style.css`  | Soft light theme & layout   |
| `script.js`  | Timeline logic & storage    |
