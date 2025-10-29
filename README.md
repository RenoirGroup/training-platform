# The Renoir Academy

A comprehensive consultant training platform with gamification, built with Hono and Cloudflare Pages for Renoir Consulting.

## Project Overview

This is a full-stack training management system designed for Renoir Consulting. It features:

- **Admin Dashboard**: Manage users, levels, tests, training materials, and boss levels
- **Consultant Portal**: Duolingo-style training ladder with tests, progress tracking, and gamification
- **Boss Dashboard**: Review sign-off requests, monitor team progress, and analytics

**Brand Identity:**
- Primary Color: Renoir Green (#7CB342)
- Secondary Color: Teal (#00ACC1)
- Logo: Renoir Consulting branding throughout the application

## URLs

- **Production**: https://10c6bca7.training-platform-257.pages.dev
- **GitHub**: https://github.com/RenoirGroup/renoir-training26
- **Development Sandbox**: https://3000-i5jt5upplbv2n9drgj7lj-0e616f0a.sandbox.novita.ai
- **Local Development**: http://localhost:3000

## Features

### Current Functional Entry URIs

#### Authentication
- `POST /api/auth/login` - User login (returns JWT token)
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user info

#### Admin API (requires admin role)
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/levels` - List all levels
- `POST /api/admin/levels` - Create level
- `PUT /api/admin/levels/:id` - Update level
- `DELETE /api/admin/levels/:id` - Delete level
- `GET /api/admin/levels/:levelId/materials` - Get training materials
- `POST /api/admin/levels/:levelId/materials` - Create material
- `PUT /api/admin/materials/:id` - Update material
- `DELETE /api/admin/materials/:id` - Delete material
- `GET /api/admin/levels/:levelId/tests` - Get tests
- `POST /api/admin/levels/:levelId/tests` - Create test
- `PUT /api/admin/tests/:id` - Update test
- `DELETE /api/admin/tests/:id` - Delete test
- `GET /api/admin/tests/:testId/questions` - Get questions
- `POST /api/admin/tests/:testId/questions` - Create question with answer options
- `PUT /api/admin/questions/:id` - Update question
- `DELETE /api/admin/questions/:id` - Delete question
- `GET /api/admin/levels/:levelId/tasks` - Get boss level tasks
- `POST /api/admin/levels/:levelId/tasks` - Create task
- `PUT /api/admin/tasks/:id` - Update task
- `DELETE /api/admin/tasks/:id` - Delete task
- `GET /api/admin/boss-relationships` - Get all boss-consultant relationships
- `GET /api/admin/consultants/:consultantId/bosses` - Get bosses for a consultant
- `GET /api/admin/bosses/:bossId/consultants` - Get consultants for a boss
- `POST /api/admin/boss-relationships` - Create boss-consultant relationship
- `PUT /api/admin/boss-relationships/:id` - Update relationship
- `DELETE /api/admin/boss-relationships/:id` - Delete relationship
- `GET /api/admin/reports/progress` - Get progress report
- `GET /api/admin/reports/completion` - Get completion rates

#### Consultant API (requires consultant role)
- `GET /api/consultant/ladder` - Get training ladder with progress
- `GET /api/consultant/levels/:levelId` - Get level details with materials and tests
- `POST /api/consultant/levels/:levelId/start` - Start a level
- `GET /api/consultant/tests/:testId` - Get test with questions
- `POST /api/consultant/tests/:testId/submit` - Submit test answers
- `GET /api/consultant/test-history` - Get test attempt history
- `GET /api/consultant/my-bosses` - Get list of assigned bosses
- `POST /api/consultant/levels/:levelId/request-signoff` - Request boss sign-off (supports multiple bosses)
- `GET /api/consultant/signoff-requests` - Get sign-off request status
- `GET /api/consultant/stats` - Get streaks, achievements, and stats
- `GET /api/consultant/leaderboard` - Get leaderboard rankings

#### Boss API (requires boss role)
- `GET /api/boss/team` - Get team members and their progress
- `GET /api/boss/team/:userId/progress` - Get individual progress
- `GET /api/boss/signoff-requests` - Get pending sign-off requests
- `GET /api/boss/signoff-requests/all` - Get all sign-off requests
- `GET /api/boss/signoff-requests/:requestId` - Get detailed request
- `POST /api/boss/signoff-requests/:requestId/approve` - Approve sign-off
- `POST /api/boss/signoff-requests/:requestId/reject` - Reject sign-off
- `GET /api/boss/analytics` - Get team analytics
- `GET /api/boss/export/team-report` - Export team report as CSV

### Completed Features

1. ✅ **User Management**
   - Role-based access control (Admin, Boss, Consultant)
   - JWT authentication
   - User creation and management
   - **Many-to-many boss-consultant relationships** (NEW)
     - Consultants can report to multiple bosses
     - Bosses can manage multiple consultants
     - Project-specific assignments

2. ✅ **Level System**
   - Regular training levels
   - Boss levels (checkpoints requiring manager approval)
   - Training materials (PowerPoint, Video, Word, Excel links)
   - Tests with multiple question types

3. ✅ **Testing System**
   - Multiple choice questions
   - True/False questions
   - Open text questions
   - Auto-grading
   - Immediate retry on failure
   - Test history tracking

4. ✅ **Boss Level Sign-offs**
   - Evidence submission (notes + URLs)
   - Approval/rejection workflow
   - Feedback system
   - **Multi-boss support** (NEW) - Consultants can request sign-off from any assigned boss

5. ✅ **Gamification**
   - Login streaks
   - Test completion streaks
   - Practice streaks
   - Achievement system (15 achievements)
   - Points system
   - Leaderboard with rankings
   - League system (Bronze, Silver, Gold, Platinum, Diamond)

6. ✅ **Boss Dashboard**
   - Team progress monitoring (now supports many-to-many relationships)
   - Sign-off request management
   - Team analytics
   - CSV export for reports (includes project assignments)

7. ✅ **Consultant Dashboard**
   - Duolingo-style training ladder
   - Visual progress indicators
   - Material access
   - Test taking interface
   - Streak and achievement tracking

8. ✅ **Admin Dashboard** (ENHANCED)
   - User management
   - **Level Management Modal** (NEW)
     - Add/edit/delete training materials with SharePoint links
     - Create tests with pass percentage and time limits
     - **Inline editing** for test titles, pass %, and time limits
     - Add questions with **8 question types**:
       1. Multiple Choice
       2. True/False
       3. Open Text
       4. **Matching** (drag-and-drop pairs)
       5. **Fill-in-the-blank** (fuzzy matching)
       6. **Ranking/Ordering** (exact sequence)
       7. **Odd one out** (select incorrect item)
       8. **Hotspot/Diagram labelling** (coordinate-based)
     - All questions use all-or-nothing scoring
     - Manage answer options for multiple choice questions
     - Configure boss level tasks
   - **Boss-Consultant Relationships Tab** (NEW)
     - Assign consultants to multiple bosses
     - Manage project-specific assignments
     - Activate/deactivate relationships
   - Progress and completion reports

9. ✅ **Rebranding to The Renoir Academy** (NEW)
   - Renoir Consulting logos integrated
   - Corporate color scheme (Green #7CB342, Teal #00ACC1)
   - All pages updated with new branding
   - Professional consulting firm identity

### Features Not Yet Implemented

1. ❌ **Email Notifications**
   - Resend API integration for notifications
   - Sign-off request notifications
   - Achievement notifications
   - Streak milestone emails

2. ❌ **Advanced Reporting**
   - PDF export for reports
   - Detailed analytics dashboards
   - Time-based progress charts

3. ❌ **Social Features**
   - Team challenges
   - Peer comparisons
   - Comments on materials

4. ❌ **Mobile App**
   - Native mobile applications
   - Push notifications

## Data Architecture

### Data Models

**Core Entities:**
- Users (consultants, bosses, admins)
- **Boss-Consultant Relationships** (NEW) - Many-to-many with project assignments
- Levels (training rungs with regular and boss levels)
- Training Materials (SharePoint links to documents)
- Tests & Questions
- Answer Options (for multiple choice and true/false questions)
- User Progress (level completion tracking)
- Test Attempts (scoring and history)
- Sign-off Requests (boss approval workflow with multi-boss support)

**Gamification:**
- User Streaks (login, test, practice)
- Achievements (15 predefined achievements)
- Leaderboard (rankings and leagues)
- Activity Log (daily activity tracking)

### Storage Services

- **Cloudflare D1 (SQLite)**: All relational data
  - 19 tables with comprehensive indexing (including boss_consultant_relationships)
  - Full ACID compliance
  - Automatic replication across Cloudflare's global network

### Data Flow

1. **Admin creates structure** → Levels, Materials, Tests, Questions stored in D1
2. **Consultant accesses training** → Progress tracked in user_progress table
3. **Tests are taken** → Results stored in test_attempts and user_answers
4. **Gamification updates** → Streaks and achievements calculated real-time
5. **Boss reviews** → Sign-off requests workflow in signoff_requests table

## Tech Stack

- **Backend**: Hono (TypeScript) on Cloudflare Workers
- **Frontend**: HTML, TailwindCSS, Vanilla JavaScript
- **Database**: Cloudflare D1 (SQLite)
- **Authentication**: Custom JWT implementation
- **Password Hashing**: bcryptjs
- **Deployment**: Cloudflare Pages

## Demo Accounts

- **Admin**: admin@training.com / admin123
- **Boss**: boss@training.com / boss123
- **Consultant 1**: consultant1@training.com / consultant123
- **Consultant 2**: consultant2@training.com / consultant123

## Deployment

### Local Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Initialize database
npm run db:migrate:local
npm run db:seed

# Start development server
npm run dev:sandbox
# or with PM2
pm2 start ecosystem.config.cjs
```

### Production Deployment

```bash
# Create production D1 database
npx wrangler d1 create training-platform-production

# Update wrangler.toml with the database_id from above

# Apply migrations to production
npm run db:migrate:prod

# Seed production database (optional)
npx wrangler d1 execute DB --file=./seed.sql

# Build and deploy
npm run deploy
```

## Recommended Next Steps

1. **Email Integration**
   - Set up Resend API key
   - Implement notification triggers
   - Create email templates

2. **Production Database**
   - Create Cloudflare D1 production database
   - Configure proper database_id in wrangler.toml
   - Apply migrations to production

3. **Custom Domain**
   - Configure custom domain in Cloudflare Pages
   - Set up SSL certificates

4. **Monitoring**
   - Set up Cloudflare Analytics
   - Configure error tracking
   - Monitor API performance

5. **Testing**
   - Add unit tests
   - Integration tests for API
   - End-to-end tests for UI

## Project Structure

```
webapp/
├── src/
│   ├── index.tsx          # Main Hono application
│   ├── types.ts           # TypeScript type definitions
│   ├── utils/
│   │   ├── auth.ts        # JWT & password hashing
│   │   └── middleware.ts  # Auth middleware
│   └── routes/
│       ├── auth.ts        # Authentication routes
│       ├── admin.ts       # Admin management routes
│       ├── consultant.ts  # Consultant training routes
│       └── boss.ts        # Boss management routes
├── public/static/
│   ├── admin.html         # Admin dashboard
│   ├── consultant.html    # Consultant training ladder
│   └── boss.html          # Boss dashboard
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_seed_achievements.sql
│   └── 0003_boss_consultant_relationships.sql
├── seed.sql               # Sample data
├── wrangler.toml          # Cloudflare configuration
├── package.json
└── ecosystem.config.cjs   # PM2 configuration

```

## Database Initialization

The application **automatically initializes** the database with sample data on the first login attempt. This ensures the platform works immediately in both development and production environments without manual database setup.

**Sample data includes:**
- 4 demo users (admin, boss, 2 consultants)
- 5 sample levels (including 1 boss level)
- Training materials and tests
- 15 predefined achievements

Simply start the server and login - the database will be created automatically!

## Known Issues

1. **Password Hashes**: Sample passwords use bcrypt hashing. For production, ensure proper password policies are enforced.

2. **Static Files**: All training materials are external SharePoint links. No file uploads are supported due to Cloudflare Workers limitations.

## Support

For issues or questions, please refer to:
- [Hono Documentation](https://hono.dev/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)

## License

Proprietary - Internal use only

---

**Last Updated**: 2025-10-29  
**Status**: ✅ Production Deployed - Live on Cloudflare Pages  
**Production URL**: https://10c6bca7.training-platform-257.pages.dev  
**Deployment Platform**: Cloudflare Pages  
**Brand**: Renoir Consulting
