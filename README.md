# zsoltszabo777.github.io

Personal portfolio site. Plain HTML, CSS and JavaScript, hosted free on GitHub Pages.

Everything you see on the site comes from the files in `content/`. You never need to touch the code to update it.

## Add a clip

The easiest way is the site editor at https://zsoltszabo777.github.io/admin.html. It walks you through connecting a GitHub token the first time, then lets you add clips, update view counts and remove clips.

To edit by hand instead, open the section's file (for example `content/red-bull.json`), find the right tab, and add an entry to its `items` list:

```json
{
  "title": "Verstappen onboard, Suzuka",
  "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
  "date": "2026-10-12",
  "views": 1250000
}
```

- `date` is `YYYY-MM-DD` and drives "Most recent".
- `views` is a plain number and drives "Most viewed".
- YouTube thumbnails appear automatically. For Instagram, Facebook or TikTok you can add `"thumbnail": "<image link>"`.
- Separate entries with a comma.

## Projects (one video on several platforms)

`content/red-bull.json` uses `"type": "projects"`: each item is one video with a link and view count per platform, and the site adds the views up.

```json
{
  "id": "1793285524257",
  "title": "sideways is the way",
  "date": "2026-10-29",
  "posts": {
    "instagram": { "url": "https://www.instagram.com/reel/…", "views": 900000 },
    "youtube": { "url": "https://www.youtube.com/shorts/…", "views": 121000 }
  }
}
```

The platforms a project can use are listed under `platforms` in the same file. The site editor handles all of this for you.

## Add a section

1. Copy `content/red-bull.json` to a new file, such as `content/company-x.json`, and change the title and tabs.
2. Add it to the `sections` list in `content/site.json`:

```json
{ "id": "company-x", "title": "Company X", "file": "content/company-x.json" }
```

A section can have any number of platforms. `"display": "stacked"` shows them all on one page, in the order listed; leave it out to show them as tabs instead. Use `"layout": "vertical"` on a tab for 9:16 clips.
