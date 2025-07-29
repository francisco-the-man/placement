# Placement

A dinner party seating web app by Avery Louis with etiquette intuitions from Elizabeth Louis, powered by pseudo-boolean optimisation using lazy clause generation.

## Overview

This app helps users create optimal seating arrangements and teams for dinner parties using constraint programming (CP-SAT) with intelligent rules for placement optimization.

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **UI**: React 18
- **Styling**: CSS Modules
- **Fonts**: PT Serif & Playwrite US Modern (Google Fonts)
- **Drag & Drop**: @dnd-kit
- **Colors**: White, Black, Grey (#F5F5F5)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser to see the landing page.

## Project Structure

- `/app` - Next.js App Router pages and components
- `/public/assets` - SVG icons and assets
- `implementation.md` - Detailed project requirements and specifications

## Features (Planned)

- User authentication
- Party creation and management
- Guest management with relationships
- Seating arrangement optimization
- Team creation with fair play options
- Drag & drop interface for manual adjustments
- Multiple optimization solutions (top 6)

## Next Steps

- Set up Supabase for authentication and data storage
- Implement CP-SAT optimization engine
- Build party and guest management interfaces 