# ATX Scrubbin' — Implementation Plan

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 15 (App Router, TypeScript) | Full-stack in one app, API routes for backend logic, SSR for SEO on homepage |
| **Database** | Supabase (PostgreSQL) | Free tier, managed auth for customers, great DX |
| **Styling** | Tailwind CSS | Fast, utility-first, easy to match brand colors |
| **Payments** | Stripe | Industry standard, auth + capture, refunds, no monthly fee |
| **SMS** | Twilio | Reliable, pay-per-message (~$0.008/text), business number |
| **Email** | Resend | Free tier (3K emails/mo), simple API, great for receipts |
| **Maps** | Google Maps JavaScript API | Service area polygon drawing, geocoding, address validation, $200/mo free credit |
| **Calendar** | Google Calendar API | Push appointments to Carter/Augie's calendars |
| **Hosting** | Vercel | Free tier, one deployment for everything, perfect for Next.js |
| **Domain** | atxscrubbin.com (Squarespace → Vercel) | Point DNS from Squarespace to Vercel |

**Estimated monthly cost at low volume: ~$0** (all free tiers, pay only per Stripe transaction + SMS messages)

---

## Database Schema

### Tables

```
team_members
├── id (uuid, PK)
├── username (text, unique)
├── password_hash (text)
├── display_name (text)
├── phone (text)
├── email (text)
├── google_calendar_id (text, nullable)
├── role (enum: admin, member)
├── active (boolean)
├── created_at, updated_at

customers (managed by Supabase Auth + profile table)
├── id (uuid, PK, references auth.users)
├── full_name (text)
├── email (text)
├── phone (text)
├── address (text)
├── lat (decimal)
├── lng (decimal)
├── created_at, updated_at

car_sizes
├── id (uuid, PK)
├── name (text) — "Small", "Medium", "Large"
├── description (text) — examples of cars
├── base_price (decimal)
├── wash_time_minutes (integer) — default 45/55/65
├── sort_order (integer)
├── active (boolean)
├── created_at, updated_at

addons
├── id (uuid, PK)
├── name (text)
├── description (text)
├── price (decimal)
├── time_minutes (integer)
├── active (boolean)
├── sort_order (integer)
├── created_at, updated_at

bookings
├── id (uuid, PK)
├── customer_id (uuid, FK → customers)
├── car_size_id (uuid, FK → car_sizes)
├── scheduled_date (date)
├── scheduled_start (time)
├── scheduled_end (time)
├── estimated_duration_minutes (integer)
├── address (text)
├── lat (decimal)
├── lng (decimal)
├── notes (text)
├── subtotal (decimal)
├── total (decimal)
├── status (enum: confirmed, in_progress, completed, cancelled, refunded)
├── stripe_payment_intent_id (text)
├── stripe_refund_id (text, nullable)
├── reminder_day_before_sent (boolean)
├── reminder_hour_before_sent (boolean)
├── completion_notification_sent (boolean)
├── created_at, updated_at

booking_addons
├── id (uuid, PK)
├── booking_id (uuid, FK → bookings)
├── addon_id (uuid, FK → addons)
├── price_at_booking (decimal) — snapshot price
├── time_at_booking (integer) — snapshot time

booking_team_members
├── booking_id (uuid, FK → bookings)
├── team_member_id (uuid, FK → team_members)

availability
├── id (uuid, PK)
├── team_member_id (uuid, FK → team_members)
├── day_of_week (integer, 0-6)
├── start_time (time) — default 10:00
├── end_time (time) — default 16:00
├── active (boolean)

availability_overrides
├── id (uuid, PK)
├── team_member_id (uuid, FK → team_members)
├── date (date)
├── available (boolean) — false = day off, true = custom hours
├── start_time (time, nullable)
├── end_time (time, nullable)

service_area
├── id (uuid, PK)
├── polygon (jsonb) — GeoJSON coordinates
├── updated_at

settings
├── key (text, PK)
├── value (jsonb)
— travel_buffer_minutes, default_start_time, default_end_time, etc.
```

---

## Page Structure

### Customer-Facing Pages

```
/ .......................... Homepage
  ├── Hero ("We scrub so you don't have to.")
  ├── How it works (3 steps)
  ├── Service area map
  ├── About Carter & Augie
  ├── Contact
  └── CTA → /book

/book ...................... Booking flow (multi-step)
  ├── Step 1: Choose car size
  ├── Step 2: Choose add-ons
  ├── Step 3: Price summary
  ├── Step 4: Sign in (Google or create account)
  ├── Step 5: Enter address → validate against service area
  ├── Step 6: Pick a time slot
  ├── Step 7: Phone number + notes
  └── Step 8: Stripe payment → confirmation

/account ................... Customer dashboard
  ├── Past washes (with one-click rebook)
  └── Upcoming washes (with cancel/reschedule)

/account/bookings/[id] ..... Booking detail
```

### Admin Pages

```
/admin/login ................. Username/password login

--- Desktop/iPad (Setup Mode) ---
/admin ....................... Dashboard (today's bookings, stats)
/admin/services .............. Manage car sizes, base prices, wash times
/admin/addons ................ Manage add-ons (add/edit/remove, price, time)
/admin/team .................. Team members (add/remove, username/password)
/admin/availability .......... Set availability per team member
/admin/service-area .......... Draw polygon on Google Map
/admin/bookings .............. All bookings (filterable, searchable)
/admin/bookings/[id] ......... Booking detail (edit, refund, status, text)

--- Mobile (Field Mode) ---
/admin/today ................. Today's schedule (mobile-first card view)
/admin/bookings/[id] ......... Same detail page, responsive
  ├── Customer contact info
  ├── Service details (editable)
  ├── Mark started / finished (triggers texts)
  ├── Adjust price
  ├── Issue refund
  └── Send direct text
```

---

## Scheduling Algorithm

```
1. Customer selects a date
2. Calculate total duration:
   = car_size.wash_time_minutes + SUM(addon.time_minutes)
3. Find team members available on that date:
   - Check recurring availability (day_of_week)
   - Apply overrides (availability_overrides)
   - Need at least 2 available members
4. Get existing bookings for that date
5. Calculate busy windows:
   - Each booking blocks: scheduled_start → scheduled_end + 15min buffer
6. Find open slots where:
   - At least 2 team members are free
   - Slot duration fits the estimated wash time
   - Slot falls within available hours
7. Return available time slots (30-minute start increments)
```

---

## Notification System

### Automated Texts (Twilio)
| Trigger | Timing | Message |
|---------|--------|---------|
| Day-before reminder | 6pm the day before | "Hey! Your car wash is tomorrow at {time}. See you then! - Keep Austin Scrubbin'" |
| Hour-before alert | 1 hour before start | "Carter & Augie are heading your way! They'll be at {address} around {time}." |
| Wash complete | When status → completed | "Your car is all clean! Thanks for choosing Keep Austin Scrubbin'!" |

### Automated Emails (Resend)
| Trigger | Content |
|---------|---------|
| Booking confirmed | Service details, date/time, address, total, cancellation policy |
| Wash complete | Receipt with line items, total charged |

### Direct Texts (from admin)
- Carter/Augie can text any customer from the business Twilio number
- Simple text input in the booking detail view

---

## Implementation Phases

### Phase 1: Project Foundation
- Initialize Next.js project with TypeScript, Tailwind, ESLint
- Set up Supabase project and database schema
- Create GitHub repo
- Configure Vercel deployment
- Set up project structure (components, lib, API routes)
- Environment variables and configuration

### Phase 2: Homepage & Branding
- Build the homepage with all sections:
  - Hero with slogan and CTA
  - How it works
  - Service area map (read-only, displays polygon)
  - About Carter & Augie
  - Contact section
- Responsive design (mobile-first)
- Brand colors (orange), fonts, logo integration

### Phase 3: Admin Authentication & Core Setup
- Admin login system (username/password, JWT sessions)
- Admin layout with navigation
- Car sizes & pricing CRUD
- Add-ons CRUD
- Wash time configuration
- Settings management

### Phase 4: Admin — Team, Area & Availability
- Team member management (add/remove, credentials)
- Service area map with polygon drawing tool
- Availability management per team member
- Availability overrides (specific dates)

### Phase 5: Customer Booking Flow
- Multi-step booking form with progress indicator
- Car size selection UI
- Add-on selection UI
- Dynamic price calculation
- Customer auth (Google OAuth + email/password via Supabase)
- Address entry with Google Places autocomplete
- Address validation against service area polygon
- Time slot selection (scheduling algorithm)
- Phone number + notes collection

### Phase 6: Payments
- Stripe integration (checkout, charge at booking)
- Payment confirmation
- Refund processing from admin
- Booking confirmation email (Resend)
- Receipt email on completion

### Phase 7: Admin — Booking Management & Field Mode
- Booking list with filters (date, status)
- Booking detail view (full CRUD)
- Edit services/add-ons on existing booking
- Price adjustment
- Wash status workflow (confirmed → in_progress → completed)
- Mobile-optimized "Today" view
- Google Calendar sync (push appointments)

### Phase 8: Notifications & Messaging
- Twilio setup with business phone number
- Automated text notifications (day-before, hour-before, complete)
- Background job scheduling for timed notifications (Vercel Cron)
- Direct text messaging from admin to customer
- Text conversation view in booking detail

### Phase 9: Customer Accounts
- Account dashboard with past washes
- One-click rebook flow
- Cancel/reschedule (up to day before policy)
- Rebook links for emails

### Phase 10: Polish & Launch
- Full responsive design audit
- Error handling and edge cases
- Loading states and optimistic UI
- SEO (meta tags, OpenGraph for sharing)
- Point atxscrubbin.com DNS to Vercel
- Production environment variables
- Smoke testing end-to-end
- Launch!

---

## Project Structure

```
atxscrubbin/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Homepage
│   │   ├── layout.tsx                  # Root layout
│   │   ├── globals.css                 # Tailwind + brand styles
│   │   ├── book/
│   │   │   └── page.tsx                # Booking flow
│   │   ├── account/
│   │   │   ├── page.tsx                # Customer dashboard
│   │   │   └── bookings/[id]/page.tsx  # Booking detail
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   ├── page.tsx                # Admin dashboard
│   │   │   ├── layout.tsx              # Admin layout + nav
│   │   │   ├── services/page.tsx
│   │   │   ├── addons/page.tsx
│   │   │   ├── team/page.tsx
│   │   │   ├── availability/page.tsx
│   │   │   ├── service-area/page.tsx
│   │   │   ├── bookings/page.tsx
│   │   │   ├── bookings/[id]/page.tsx
│   │   │   ├── today/page.tsx          # Field mode
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       ├── bookings/
│   │       ├── services/
│   │       ├── addons/
│   │       ├── team/
│   │       ├── availability/
│   │       ├── service-area/
│   │       ├── payments/
│   │       ├── sms/
│   │       ├── calendar/
│   │       └── cron/                   # Vercel Cron jobs
│   ├── components/
│   │   ├── ui/                         # Reusable UI components
│   │   ├── booking/                    # Booking flow components
│   │   ├── admin/                      # Admin components
│   │   └── homepage/                   # Homepage sections
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client
│   │   ├── stripe.ts                   # Stripe config
│   │   ├── twilio.ts                   # Twilio config
│   │   ├── resend.ts                   # Resend config
│   │   ├── google-maps.ts              # Maps utilities
│   │   ├── google-calendar.ts          # Calendar sync
│   │   ├── scheduling.ts              # Scheduling algorithm
│   │   └── auth.ts                     # Auth helpers
│   └── types/
│       └── index.ts                    # TypeScript types
├── public/
│   ├── logo-color.png
│   ├── logo-bw.png
│   └── favicon.ico
├── supabase/
│   └── migrations/                     # SQL migrations
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── vercel.json
```

---

## Third-Party Account Setup Required

Before building, Carter & P.J. will need to create accounts at:
1. **Supabase** (supabase.com) — free tier
2. **Stripe** (stripe.com) — free, charges per transaction
3. **Twilio** (twilio.com) — buy a phone number (~$1.15/mo + ~$0.008/text)
4. **Resend** (resend.dev) — free tier
5. **Google Cloud Console** (console.cloud.google.com) — Maps API + Calendar API, $200/mo free credit
6. **GitHub** (for the repo)
7. **Vercel** (vercel.com) — free tier

These can be set up as we go — we don't need them all on Day 1.
