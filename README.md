# Nook MVP

Reserve calm workspaces by the hour — Resy for workspaces.

## Tech Stack

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase Postgres + Prisma ORM
- **Design**: Mobile-first, PWA-ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (for database)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
```

3. Set up Prisma:
```bash
npx prisma generate
npx prisma db push
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  ├── (root)/              # Routes with bottom navigation
  │   ├── page.tsx        # Explore (/)
  │   ├── reservations/   # Reservations page
  │   └── profile/        # Profile page
  ├── venue/
  │   ├── [id]/          # Venue detail page
  │   └── onboard/       # Venue onboarding
  └── layout.tsx         # Root layout

components/
  ├── ui/                # shadcn/ui components
  ├── layout/            # Layout components (BottomNav)
  └── venue/             # Venue components (VenueCard)

lib/
  ├── utils.ts           # Utility functions
  └── prisma.ts          # Prisma client

prisma/
  └── schema.prisma      # Database schema
```

## Routes

- `/` - Explore venues
- `/venue/[id]` - Venue detail page
- `/reservations` - User reservations
- `/venue/onboard` - Venue onboarding
- `/profile` - User profile

## Design System

- **Primary Color**: Dark green (#0F5132)
- **Style**: Calm, premium, minimal
- **Typography**: Clean modern sans-serif
- **Layout**: Mobile-first with bottom navigation

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run db:studio` - Open Prisma Studio