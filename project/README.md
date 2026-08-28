# Shoopy Store Asset Management Dashboard

A production-ready web dashboard to manage and organize uploaded HTML/CSS store theme assets, with Shoopy API integration for store search and publishing.

## Features

- **Store Search** — Find stores by phone number or store URL via the Shoopy agent API
- **ZIP & File Upload** — Drag-and-drop a ZIP (auto-extracted in-browser) or individual HTML/CSS files
- **Auto-Categorization** — Files are sorted into Banners, Announcement Bar, Collection, and Custom CSS based on filename keywords
- **Reverse Sequence Sorting** — Banner and Collection files are sorted by numeric prefix in descending order (e.g. `10_` → `02_` → `01_`)
- **File Preview** — HTML rendered in a sandboxed iframe; CSS shown in a syntax-highlighted editor
- **File Actions** — Preview, rename, remove, and download for every file
- **Publish to Shoopy** — Push banners, announcements, collections, and CSS directly to a selected store
- **API Debug Panel** — Expandable request/response JSON logs for every API call
- **Dark / Light Mode** — Theme toggle with system preference detection
- **localStorage Persistence** — Uploaded assets survive page refresh
- **Export / Import JSON** — Back up and restore your categorized assets
- **Duplicate Detection** — Files with existing names are flagged and skipped
- **Toast Notifications** — Feedback for every action
- **Mobile Responsive** — Sidebar collapses into a drawer on small screens

## File Classification Rules

| Category | Rule | Examples |
|---|---|---|
| **Banners** | Filename contains `hero` or `banner` (case-insensitive) | `01_Hero.html`, `main-banner.html` |
| **Announcement Bar** | Filename contains `announcement` | `announcement.html`, `top-announcement-bar.html` |
| **Custom CSS** | Any `.css` file | `custom.css`, `homepage-style.css` |
| **Collection** | Any remaining HTML file | `03_featured-products.html`, `05_collection-grid.html` |

## Shoopy API Integration

The dashboard talks to the Shoopy API directly from the browser (CORS-enabled endpoints). Configure the API base URLs and tokens in the **Store Search** view's settings panel.

### Flow

1. **Search** — `GET /api/v1/partner/shoopy-agent/shoopy-stores?query=<phone|url>` with the agent bearer token
2. **Login Token** — `GET /api/v1/partner-users/login-token?store-id=<id>` returns a base64 `username:password`
3. **OAuth** — `POST /api/v1/auth/oauth/token` (Basic auth) exchanges the login token for an access token
4. **Publish** — Banners → `/offers`, Announcements → `/group-names/header/attributes`, Collections → `/product-collections`, CSS → `/cloud/file/pub`

All requests and responses are logged in an expandable debug panel.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS (dark mode via class strategy)
- JSZip (client-side ZIP extraction)
- lucide-react (icons)
- localStorage (persistence)

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output is generated in `dist/`.

## Deploy to Netlify

### Option A — Git-based (recommended)

1. Push this project to a GitHub/GitLab repository
2. In Netlify, click **Add new site → Import an existing project**
3. Select your repository
4. Build settings are auto-detected from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy**

### Option B — Drag & drop

1. Run `npm run build` locally
2. Drag the generated `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop)

### Netlify config

`netlify.toml` is included with the correct build command, publish directory, and SPA redirect rule.

## Project Structure

```
project/
├── index.html
├── netlify.toml
├── src/
│   ├── App.tsx                  # Main app shell & state orchestration
│   ├── main.tsx
│   ├── index.css                 # Tailwind + design tokens
│   ├── types.ts                  # Shared TypeScript types
│   ├── context/
│   │   ├── ThemeContext.tsx      # Dark/light mode
│   │   └── ToastContext.tsx      # Toast notifications
│   ├── lib/
│   │   ├── config.ts             # Shoopy API config & token storage
│   │   ├── storage.ts           # localStorage persistence (assets, history, import/export)
│   │   ├── classify.ts          # File classification & sequence extraction
│   │   ├── zip-handler.ts       # ZIP extraction & file processing (JSZip)
│   │   ├── shoopy.ts           # Shoopy API client (search, login, publish)
│   │   └── download.ts          # Download helpers
│   └── components/
│       ├── Sidebar.tsx
│       ├── UploadZone.tsx
│       ├── AssetCard.tsx
│       ├── AssetSectionView.tsx
│       ├── DashboardView.tsx
│       ├── StoreSearchView.tsx
│       ├── HistoryView.tsx
│       ├── PreviewModal.tsx
│       └── ToastContainer.tsx
└── README.md
```
