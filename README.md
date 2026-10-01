# My Timeline 🕰️

A soft, light-themed personal timeline website. You add entries manually — each entry
has a **title**, **image**, **description**, **date created**, **date modified**, and a
**share button**.

Built with plain **HTML, CSS and JavaScript** only — no frameworks, no build step.

## Run it

Open `index.html` directly in your browser (double-click it), or serve the folder:

```bash
cd timeline-website
npx serve .
# or: python -m http.server 8000
```

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

## Files

| File         | Purpose                     |
| ------------ | --------------------------- |
| `index.html` | Page structure & modal form |
| `style.css`  | Soft light theme & layout   |
| `script.js`  | Timeline logic & storage    |
