# California Patio Builders — Website Design Spec

**Date**: 2026-03-22
**Status**: Approved
**Approach**: Fork & Rebrand from Tri Pros Remodeling codebase
**Target directory**: `olis-v3/nextjs/california-patio-builders/`

---

## 1. Company Information

| Field | Value |
|---|---|
| Name | California Patio Builders |
| Domain | californiapatiobuilders.com |
| Address | 6252 Calvin Ave, Tarzana, CA 91335 |
| Email | info@californiapatiobuilders.com |
| Phone | (818) 651-1445 |
| Years in business | 6 |
| License | B2, General |
| Service area | Southern California |

---

## 2. Tech Stack

### Core (same as Tri Pros)
- Next.js 15, React 19, TypeScript
- Tailwind CSS v4, shadcn/ui (new-york style), lucide-react, motion/react
- tRPC + TanStack React Query (DAL pattern)
- better-auth (Google OAuth)
- Drizzle ORM + PostgreSQL (Neon serverless)
- Notion (blog content)
- react-hook-form + Zod
- Resend + React Email (contact form)
- Cloudflare R2 (portfolio media)
- nuqs (URL state)

### Excluded from Tri Pros
- Pipedrive (CRM)
- Monday.com (CRM)
- DocuSign (e-signature)
- Upstash QStash (background jobs)
- Upstash Redis (caching)
- Vercel AI SDK + OpenAI (AI generation)
- Tiptap (rich text editor)
- dnd-kit (drag and drop)
- recharts (charting)
- zustand (state management)
- zxcvbn (password strength)
- millify (number formatting)
- Google Drive / Google Picker

### Packages to remove from package.json
```
pipedrive, @mondaydotcomorg/api, docusign-esign,
@upstash/qstash, @upstash/ratelimit, @upstash/redis,
@ai-sdk/openai, ai, jsonwebtoken,
@tiptap/* (all), @dnd-kit/* (all),
recharts, @zxcvbn-ts/core, zustand, millify
```

---

## 3. Route Architecture

```
/ (home)
/about
/services                                    # Overview — 3 pillar cards
/services/patios-and-hardscape               # Pillar 1 + 3 service cards
/services/patios-and-hardscape/[serviceSlug]  # concrete-patios, deck-patios, paver-patios
/services/shade-structures                    # Pillar 2 + 3 service cards
/services/shade-structures/[serviceSlug]      # insulated-patio-covers, uninsulated-patio-covers, pergolas
/services/outdoor-entertainment              # Pillar 3 + 3 service cards
/services/outdoor-entertainment/[serviceSlug] # outdoor-kitchens, outdoor-lighting, built-in-seating
/portfolio                                   # Project gallery grid
/portfolio/[projectSlug]                     # Simple gallery detail
/promotions                                  # Current specials / bundles
/blog                                        # Notion-powered posts
/contact                                     # Form + company info
/privacy                                     # Legal
```

### Routes removed from Tri Pros
- `/experience`, `/community/*`, `/intake/*`, `/tests/*`
- `/proposal-flow/*` (entire authenticated feature)
- `/dashboard/*` (entire agent dashboard)

---

## 4. Service Pillars & Individual Services

### Pillar 1 — Patios & Hardscape
| Service | Slug | Description |
|---|---|---|
| Concrete Patios | `concrete-patios` | Broom finish, stamped, stained concrete patio installation |
| Deck Patios | `deck-patios` | Wood and composite deck patio construction |
| Paver Patios | `paver-patios` | Interlocking concrete, porcelain, and natural stone pavers |

### Pillar 2 — Shade Structures
| Service | Slug | Description |
|---|---|---|
| Patio Covers (Insulated) | `insulated-patio-covers` | Solid insulated aluminum patio covers for year-round comfort |
| Patio Covers (Uninsulated) | `uninsulated-patio-covers` | Non-insulated aluminum patio covers for shade and rain protection |
| Pergolas | `pergolas` | Wood, vinyl, and aluminum pergola structures |

### Pillar 3 — Outdoor Entertainment
| Service | Slug | Description |
|---|---|---|
| Outdoor Kitchens & BBQ Islands | `outdoor-kitchens` | Custom outdoor kitchens, BBQ islands, and cooking areas |
| Outdoor Lighting | `outdoor-lighting` | Low-voltage LED landscape and patio lighting |
| Built-in Seating & Benches | `built-in-seating` | Custom masonry and wood built-in seating areas |

---

## 5. Navigation Structure

### Desktop
```
Logo | Services ▾ | Portfolio | Promotions | About | Blog | Contact | [CTA: Free Estimate]
```

**Services dropdown:**
- Patios & Hardscape
- Shade Structures
- Outdoor Entertainment

### Mobile
Popover menu (same pattern as Tri Pros SiteNavbar/PopoverNav)

### CTA
"Free Estimate" button → links to `/contact`

---

## 6. Page Compositions

### Home (`/`)
1. **Hero** — Headline + subheadline + CTA + fullscreen background image
2. **Value Propositions** — 3 cards (Quality Craftsmanship, On-Time Delivery, Licensed & Insured)
3. **Services Preview** — 3 pillar cards with images
4. **Featured Projects** — 4-6 project cards from portfolio
5. **Testimonials** — Quote carousel
6. **Promotions Teaser** — Current special highlight
7. **Bottom CTA** — Call-to-action banner

### About (`/about`)
1. Hero
2. Company Story (6 years, Tarzana-based, B2 licensed, SoCal focus)
3. Team / Credentials section
4. Process Overview (3 steps: Consultation → Design → Build)
5. Bottom CTA

### Services Overview (`/services`)
1. Hero
2. 3 Pillar Cards (Hardscape, Shade, Entertainment)

### Pillar Page (`/services/[pillar]`)
1. Cinematic hero with pillar headline + stats
2. 3 Service Cards grid
3. Why Choose Us / differentiators
4. Process overview
5. Bottom CTA

### Service Detail (`/services/[pillar]/[serviceSlug]`)
1. Hero image + service name
2. Description + key features
3. Materials / options breakdown
4. Photo gallery (portfolio projects tagged to this service)
5. Bottom CTA

### Portfolio Grid (`/portfolio`)
1. Hero
2. Filterable grid of project cards (filter by pillar/service type)
3. Each card: image + title + services used

### Project Detail (`/portfolio/[projectSlug]`)
1. Hero image
2. Title + description
3. Specs (materials, area sq ft, timeline, location)
4. Photo gallery grid (completed work only — no before/after)
5. Bottom CTA

### Promotions (`/promotions`)
1. Hero
2. 2-3 current specials as cards (e.g., "Patio + Pergola Package — Save 10%")
3. Seasonal messaging
4. Financing mention
5. Bottom CTA

### Blog (`/blog`)
1. Hero
2. Blog post grid (Notion-powered)

### Contact (`/contact`)
1. Hero
2. Contact form (name, email, phone, service interest dropdown, message)
3. Company info sidebar (address, phone, email, license, hours)

### Privacy (`/privacy`)
Standard legal prose (adapted from Tri Pros)

---

## 7. Database Schema (Simplified)

### Tables

**`projects`**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | defaultRandom |
| title | text | Required |
| slug | text | Unique, URL-friendly |
| description | text | Project narrative |
| location | text | City/area |
| materials | text | Materials used |
| area_sqft | integer | Project size |
| timeline | text | e.g., "2 weeks" |
| pillar | text | patios-and-hardscape, shade-structures, outdoor-entertainment |
| services | jsonb | Array of service slugs |
| is_public | boolean | Default true |
| created_at | timestamp | defaultNow |
| updated_at | timestamp | defaultNow |

**`media_files`**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | defaultRandom |
| file_name | text | Original filename |
| url | text | R2 public URL |
| project_id | uuid FK | References projects |
| sort_order | integer | Display order |
| is_hero | boolean | Primary image flag |
| created_at | timestamp | defaultNow |

**`users`** — better-auth managed (admin access only)

**`sessions`** — better-auth managed

### Removed tables (vs Tri Pros)
customers, meetings, proposals, finance-options, finance-providers, trades, scopes, materials, addons, benefits, benefit-categories, variables, lead-sources, proposal-views, customer-notes, notifications, tags, and ALL junction tables (x-scope-materials, x-scope-benefits, x-scope-variables, x-trade-benefits, x-material-benefits, x-project-scopes, x-project-media)

---

## 8. Static Content Architecture

All service/pillar content is hardcoded in constants (not DB-driven like Tri Pros trades/scopes from Notion). This keeps the site fast and simple.

```
src/features/landing/
├── constants/
│   ├── pillar-config.ts        # 3 pillars: headlines, stats, descriptions
│   ├── service-config.ts       # 9 services: descriptions, features, materials, slugs
│   └── promotions.ts           # Current specials / bundles
├── data/
│   ├── value-props.ts          # 3 homepage value proposition cards
│   ├── testimonials.ts         # Customer quotes (hardcoded for launch)
│   ├── blog-topics.ts          # Patio-focused blog titles
│   ├── process-steps.ts        # Consultation → Design → Build
│   └── company/
│       ├── info.ts             # Name, address, phone, email, license
│       ├── team.ts             # Team members (placeholder)
│       ├── credentials.ts      # B2 license, insured, etc.
│       └── stats.ts            # 6 years, X projects, etc.
```

---

## 9. Environment Variables

### Required
```env
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=https://californiapatiobuilders.com
DATABASE_URL=            # New Neon project
BETTER_AUTH_SECRET=      # New secret
GOOGLE_CLIENT_ID=        # New OAuth app
GOOGLE_CLIENT_SECRET=    # New OAuth app
RESEND_API_KEY=          # For contact emails
NOTION_API_KEY=          # For blog content
R2_ACCOUNT_ID=           # Shared with TPR initially
R2_TOKEN=                # Shared with TPR initially
R2_ACCESS_KEY_ID=        # Shared with TPR initially
R2_SECRET_ACCESS_KEY=    # Shared with TPR initially
R2_JURISDICTION=         # Shared with TPR initially
```

### Optional
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # Contact page map
```

### Removed (vs Tri Pros)
```
MONDAY_API_TOKEN, PIPEDRIVE_BASE_URL, PIPEDRIVE_API_KEY,
DS_DEV_USER_ID, DS_USER_ID, DS_ACCOUNT_ID, DS_INTEGRATION_KEY,
DS_JWT_PRIVATE_KEY_PATH, DS_JWT_PRIVATE_KEY,
QSTASH_URL, QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY,
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

---

## 10. Features & Services Layer

### Features kept (rewritten for CPB)
| Feature | Tri Pros Equivalent | Changes |
|---|---|---|
| `landing` | `landing` | All content rewritten for patio business |
| `portfolio` | `showroom` | Renamed; simplified to completed-work-only gallery |

### Features removed
| Feature | Reason |
|---|---|
| `agent-dashboard` | No dashboard in CPB |
| `customer-pipelines` | No CRM pipeline |
| `meetings` | No meeting flow |
| `proposal-flow` | No proposal builder |
| `intake` | No intake forms |

### Services kept
| Service | Usage |
|---|---|
| `r2` | Portfolio media storage |
| `resend` | Contact form emails |
| `notion` | Blog content CMS |

### Services removed
| Service | Reason |
|---|---|
| `pipedrive` | Excluded per requirements |
| `monday` | Excluded per requirements |
| `docusign` | No e-signature needed |
| `ai` | No AI generation needed |
| `upstash` | No background jobs or caching needed |
| `google-drive` | No file picker needed |

---

## 11. tRPC Routers

### Kept (adapted)
| Router | Purpose |
|---|---|
| `landingRouter` | Contact form submission, blog data |
| `portfolioRouter` | Portfolio project queries (renamed from showroom) |

### Removed
| Router | Reason |
|---|---|
| `aiRouter` | No AI features |
| `customersRouter` | No customer management |
| `dashboardRouter` | No dashboard |
| `docusignRouter` | No e-signature |
| `hubspotRouter` | No HubSpot |
| `meetingsRouter` | No meetings |
| `notionRouter` | Notion used directly for blog, no sync router needed |
| `customerPipelinesRouter` | No pipeline |
| `proposalRouter` | No proposals |

---

## 12. Auth (Simplified)

- better-auth with Google OAuth
- No role-based access (no agent/super-admin distinction)
- No CASL permissions
- Admin-only access for portfolio management (future)
- Public site requires zero authentication

---

## 13. R2 Bucket Configuration

### Initial (shared with Tri Pros)
```ts
R2_BUCKETS = {
  'cpb-portfolio': 'tpr-portfolio-projects',  // Temporarily using TPR bucket
}
R2_PUBLIC_DOMAINS = {
  'cpb-portfolio': 'https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev',
}
```

### Future (dedicated CPB account)
```ts
R2_BUCKETS = {
  'cpb-portfolio': 'cpb-portfolio-projects',
}
R2_PUBLIC_DOMAINS = {
  'cpb-portfolio': 'https://<new-cpb-r2-domain>.r2.dev',
}
```

Media model: completed work only. No before/during/after phases. Each media file has `is_hero` (boolean) for the primary display image, rest are gallery images sorted by `sort_order`.

---

## 14. Content Gap List

Items that need real content (placeholder copy will be generated for launch):

| Content | Source | Status |
|---|---|---|
| Company story narrative | Owner input needed | PLACEHOLDER |
| Team members + bios | Owner input needed | PLACEHOLDER |
| Credentials / certifications | Owner input needed | PLACEHOLDER |
| Testimonial quotes | Owner input needed | PLACEHOLDER |
| Portfolio projects (real) | Owner input needed | PLACEHOLDER (using TPR media temporarily) |
| Pillar headlines + stats | Generated from market research | PLACEHOLDER |
| Service descriptions + features + materials | Generated from market research | PLACEHOLDER |
| Differentiator framework | Adapted from TPR S.W.C.E. | PLACEHOLDER |
| Promotions / specials | Owner input needed | PLACEHOLDER |
| Blog post content | Notion setup needed | PLACEHOLDER |
| Process steps copy | Generated | PLACEHOLDER |
| Service bundles / pairings | Generated from market research | PLACEHOLDER |
| Privacy policy | Adapted from TPR | NEEDS LEGAL REVIEW |
| Logo / brand assets | Owner input needed | PLACEHOLDER |
| Hero images / photography | Owner input needed | PLACEHOLDER (using stock/TPR) |
| Google Maps API key | Owner setup needed | NOT SET |
| Neon database | Owner setup needed | NOT SET |
| Google OAuth app | Owner setup needed | NOT SET |
| Resend account | Owner setup needed | NOT SET |
| Notion blog database | Owner setup needed | NOT SET |

This list will be maintained as `CONTENT-GAPS.md` in the CPB repo root.

---

## 15. Git Strategy

- Fresh git repo in `olis-v3/nextjs/california-patio-builders/`
- Incremental commits as features are added
- Descriptive but not overloaded commit messages
- No branching strategy needed for initial build (main only)

### Commit sequence (planned)
1. `init: scaffold Next.js app with core dependencies`
2. `feat: add shared config, env validation, and constants`
3. `feat: add database schema and Drizzle config`
4. `feat: add auth setup (better-auth + Google OAuth)`
5. `feat: add tRPC setup with landing and portfolio routers`
6. `feat: add shared components (navigation, footer, CTA, UI primitives)`
7. `feat: add home page with hero, value props, services preview`
8. `feat: add services pages (overview, pillars, service detail)`
9. `feat: add portfolio pages (grid + detail)`
10. `feat: add promotions page`
11. `feat: add about page`
12. `feat: add contact page with form`
13. `feat: add blog page (Notion-powered)`
14. `feat: add privacy page`
15. `chore: add CLAUDE.md, CONTENT-GAPS.md, and project docs`

---

## 16. Coding Conventions

Same as Tri Pros (enforced via CLAUDE.md in new repo):
- ONE React component per file
- No file-level constants in component files (extract to `constants/`)
- No helper functions in component files (extract to `lib/`)
- Named exports only (never `export default`)
- No barrel files in ui/components, ui/views, constants, hooks, lib, dal
- Import directionality: shared → never imports from features
- Views own data fetching + layout; components are props-driven
- Prop interfaces stay in component file unless shared
- All DAL functions have explicit return type annotations
- pgEnum in `shared/db/schema/meta.ts` only
- Const arrays in `shared/constants/enums/`
- TS types in `shared/types/enums/`
