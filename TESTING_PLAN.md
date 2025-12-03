# Training Platform - Comprehensive Testing Plan
## Pathways System Implementation (Phases 1-7)

**Date Created:** 2025-12-03  
**Latest Deployment:** https://training-platform-257.pages.dev  
**Test Accounts:**
- Admin: `admin@training.com` / `admin123`
- Boss: `boss@training.com` / `boss123`
- Consultant (John): `consultant1@training.com` / `consultant123`
- Consultant (Sarah): `consultant2@training.com` / `consultant123`

---

## Phase 1: Database Migration

### Database Schema Tests

#### 1.1 Pathways Table
- [ ] Verify `pathways` table exists with all required columns
- [ ] Check default values for `color_primary` and `color_secondary`
- [ ] Confirm `active` column defaults to 1
- [ ] Test unique constraint on `title` (if implemented)

**Test SQL:**
```sql
SELECT * FROM pathways;
DESC pathways;
```

#### 1.2 Pathway Enrollments Table
- [ ] Verify `pathway_enrollments` table exists
- [ ] Check foreign key constraints to `users` and `pathways`
- [ ] Confirm status values: 'pending', 'approved', 'rejected'
- [ ] Test unique constraint: one enrollment per user per pathway

**Test SQL:**
```sql
SELECT * FROM pathway_enrollments;
SELECT COUNT(*) FROM pathway_enrollments WHERE status = 'approved';
```

#### 1.3 Pathway Levels Table
- [ ] Verify `pathway_levels` table exists (junction table)
- [ ] Check foreign key constraints to `pathways` and `levels`
- [ ] Confirm `order_index` is working correctly
- [ ] Test unique constraint: one level can be in multiple pathways

**Test SQL:**
```sql
SELECT p.title, l.title, pl.order_index 
FROM pathway_levels pl
JOIN pathways p ON pl.pathway_id = p.id
JOIN levels l ON pl.level_id = l.id
ORDER BY p.id, pl.order_index;
```

#### 1.4 User Progress Table Updates
- [ ] Verify `pathway_id` column added to `user_progress`
- [ ] Check existing progress migrated to pathway_id = 1
- [ ] Confirm foreign key constraint to pathways
- [ ] Test unique constraint: (user_id, level_id, pathway_id)

**Test SQL:**
```sql
SELECT user_id, level_id, pathway_id, status 
FROM user_progress 
WHERE pathway_id IS NULL; -- Should return 0 rows

SELECT COUNT(*) FROM user_progress WHERE pathway_id = 1;
```

---

## Phase 2: Backend API Routes

### Admin API Tests

#### 2.1 GET /api/admin/pathways
- [ ] Returns all pathways with `enrolled_count` and `level_count`
- [ ] Includes inactive pathways for admin
- [ ] Ordered by `order_index`
- [ ] Returns 403 for non-admin users

**Test:**
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://training-platform-257.pages.dev/api/admin/pathways
```

#### 2.2 POST /api/admin/pathways
- [ ] Creates new pathway with all fields
- [ ] Applies default colors if not provided
- [ ] Returns newly created pathway with ID
- [ ] Validates required fields (title)

**Test:**
```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Pathway","description":"Test","icon":"fa-rocket","color_primary":"#FF0000"}' \
  https://training-platform-257.pages.dev/api/admin/pathways
```

#### 2.3 PUT /api/admin/pathways/:id
- [ ] Updates pathway details
- [ ] Changes `active` status correctly
- [ ] Returns updated pathway
- [ ] Validates pathway exists

#### 2.4 DELETE /api/admin/pathways/:id
- [ ] Prevents deletion if users enrolled
- [ ] Successfully deletes empty pathways
- [ ] Returns appropriate error messages

#### 2.5 GET/POST/DELETE /api/admin/pathways/:id/levels
- [ ] GET: Returns assigned levels in order
- [ ] POST: Adds level with correct order_index
- [ ] DELETE: Removes level from pathway
- [ ] POST /reorder: Updates level ordering

#### 2.6 GET /api/admin/pathways/analytics
- [ ] Returns pathway analytics with:
  - [ ] `enrolled_count`
  - [ ] `completed_count`
  - [ ] `in_progress_count`
  - [ ] `completion_rate`
  - [ ] `level_count`

### Consultant API Tests

#### 2.7 GET /api/consultant/pathways/available
- [ ] Returns all active pathways
- [ ] Shows enrollment status for current user
- [ ] Includes `level_count` for each pathway
- [ ] Returns 401 for unauthenticated users

**Test:**
```bash
curl -H "Authorization: Bearer $CONSULTANT_TOKEN" \
  https://training-platform-257.pages.dev/api/consultant/pathways/available
```

#### 2.8 GET /api/consultant/pathways/enrolled
- [ ] Returns only approved enrollments
- [ ] Shows progress: `completed_levels` / `level_count`
- [ ] Includes `requested_at` and `reviewed_at` timestamps
- [ ] Returns empty array if no enrollments

#### 2.9 POST /api/consultant/pathways/:id/request
- [ ] Creates enrollment request with 'pending' status
- [ ] Prevents duplicate requests
- [ ] Stores `request_note` correctly
- [ ] Returns 404 for inactive pathways

#### 2.10 GET /api/consultant/ladder?pathway_id=X
- [ ] Filters levels by pathway_id
- [ ] Shows only levels in specified pathway
- [ ] Returns correct user progress for pathway
- [ ] Defaults to pathway_id=1 if not specified

**Test:**
```bash
curl -H "Authorization: Bearer $CONSULTANT_TOKEN" \
  "https://training-platform-257.pages.dev/api/consultant/ladder?pathway_id=1"
```

#### 2.11 POST /api/consultant/levels/:levelId/start
- [ ] Accepts `pathway_id` parameter
- [ ] Creates user_progress with correct pathway_id
- [ ] Returns error if level not in pathway
- [ ] Validates user has access to level

#### 2.12 POST /api/consultant/tests/:testId/submit
- [ ] Accepts `pathway_id` parameter
- [ ] Uses pathway_id for completeLevel()
- [ ] Unlocks next level in same pathway
- [ ] Awards achievements per pathway

### Boss API Tests

#### 2.13 GET /api/boss/pathways
- [ ] Returns all active pathways
- [ ] Includes `level_count` for each pathway
- [ ] Works for both boss and admin roles
- [ ] Ordered by `order_index`

**Test:**
```bash
curl -H "Authorization: Bearer $BOSS_TOKEN" \
  https://training-platform-257.pages.dev/api/boss/pathways
```

#### 2.14 GET /api/boss/enrollment-requests
- [ ] Returns pending requests for boss's team
- [ ] Includes consultant name and email
- [ ] Shows pathway details (title, icon, color)
- [ ] Ordered by most recent first

#### 2.15 POST /api/boss/enrollment-requests/:id/approve
- [ ] Updates status to 'approved'
- [ ] Unlocks first level in pathway for consultant
- [ ] Sets `reviewed_at` and `reviewed_by`
- [ ] Prevents approving other boss's requests

#### 2.16 POST /api/boss/enrollment-requests/:id/reject
- [ ] Updates status to 'rejected'
- [ ] Stores `response_note` correctly
- [ ] Sets `reviewed_at` and `reviewed_by`
- [ ] Prevents rejecting other boss's requests

#### 2.17 GET /api/boss/team?pathway_id=X
- [ ] Filters team by pathway enrollment
- [ ] Shows only consultants enrolled in pathway
- [ ] Returns all team if pathway_id not specified
- [ ] Includes progress stats per pathway

**Test:**
```bash
curl -H "Authorization: Bearer $BOSS_TOKEN" \
  "https://training-platform-257.pages.dev/api/boss/team?pathway_id=1"
```

---

## Phase 3: Admin UI for Pathway Management

### 3.1 Pathways Tab
- [ ] New "Pathways" tab appears in Admin Dashboard
- [ ] Visual pathway cards display correctly
- [ ] Shows pathway icon with color styling
- [ ] Displays `enrolled_count` and `level_count`
- [ ] Shows active/inactive badge
- [ ] "Create Pathway" button is visible

### 3.2 Create Pathway Modal
- [ ] Modal opens when clicking "Create Pathway"
- [ ] Form fields: Title (required), Description, Icon, Colors, Active toggle
- [ ] Icon selector shows 35+ Font Awesome icons
- [ ] Color picker works for primary and secondary colors
- [ ] Form validation prevents empty title
- [ ] Success message on creation
- [ ] Pathway card appears immediately after creation

### 3.3 Edit Pathway Modal
- [ ] Modal opens with pre-filled data
- [ ] Can modify all pathway fields
- [ ] Can toggle active/inactive status
- [ ] Changes reflected immediately in card
- [ ] Validation works correctly

### 3.4 Icon Selector Modal
- [ ] Shows grid of Font Awesome icons
- [ ] Icons are organized by category
- [ ] Click to select icon
- [ ] Selected icon highlighted
- [ ] Preview shows in form

**Icon List to Test:**
- fa-book, fa-chart-line, fa-rocket, fa-graduation-cap, fa-briefcase
- fa-users, fa-lightbulb, fa-star, fa-trophy, fa-cog
- fa-code, fa-database, fa-cloud, fa-shield-alt, fa-network-wired

### 3.5 Color Picker
- [ ] Opens color palette
- [ ] Shows preset colors
- [ ] Custom color input works
- [ ] Preview updates in real-time
- [ ] Hex code validation

### 3.6 Manage Pathway Levels
- [ ] "Manage Levels" button opens modal
- [ ] Shows two lists: Available and Assigned
- [ ] Available list shows all levels not in pathway
- [ ] Assigned list shows current pathway levels
- [ ] "Add" button adds level to pathway
- [ ] "Remove" button removes level from pathway
- [ ] Drag-and-drop reordering works
- [ ] Order saved correctly to database

### 3.7 Shared Levels Indicator (Phase 7)
- [ ] Available levels show "Shared" badge if in other pathways
- [ ] Assigned levels show "Also in: Pathway1, Pathway2" indicator
- [ ] Blue badge styling for shared levels
- [ ] Icon: fa-share-nodes for shared indicator

### 3.8 Enrollment Overview
- [ ] Shows pending enrollment requests
- [ ] Displays consultant name and requested pathway
- [ ] "Approve" and "Reject" buttons work
- [ ] Confirmation dialogs appear
- [ ] List updates after action

### 3.9 Delete Pathway
- [ ] Delete button on pathway card
- [ ] Confirmation dialog appears
- [ ] Prevents deletion if users enrolled
- [ ] Error message: "Cannot delete pathway with enrolled users. Deactivate it instead."
- [ ] Successfully deletes empty pathways
- [ ] Card removed immediately after deletion

---

## Phase 4: Consultant UI for Pathway Selection

### 4.1 First-Time User Experience
- [ ] Modal appears on first login (no pathway enrolled)
- [ ] Shows all available pathways with visuals
- [ ] Displays level count for each pathway
- [ ] "Request Enrollment" button visible
- [ ] Can add request note (optional)
- [ ] Success message after request submission
- [ ] Modal can be closed (Browse button)

### 4.2 Pathway Browser Modal
- [ ] Click "Browse Pathways" or pathway switcher opens modal
- [ ] Two sections: "My Enrolled Pathways" and "Explore More Pathways"
- [ ] Enrolled section shows:
  - [ ] Pathway card with icon and colors
  - [ ] Progress: X/Y levels completed
  - [ ] "Switch to this pathway" button
- [ ] Explore section shows:
  - [ ] Available pathways not enrolled
  - [ ] "Request Enrollment" button
  - [ ] Status badges: Pending, Approved, Rejected

### 4.3 Request Enrollment Modal
- [ ] Opens when clicking "Request Enrollment"
- [ ] Shows pathway details (icon, title, description)
- [ ] Textarea for request note
- [ ] Character counter (optional)
- [ ] "Submit Request" button
- [ ] Success notification
- [ ] Status changes to "Pending"

### 4.4 Pathway Switcher in Navigation
- [ ] Displays current pathway name and icon
- [ ] Button styled with pathway primary color
- [ ] Click opens pathway browser modal
- [ ] Updates when switching pathways
- [ ] Shows "No Pathway" if not enrolled

### 4.5 Journey Map (Ladder) Updates
- [ ] Ladder filters by current pathway
- [ ] Shows only levels in selected pathway
- [ ] Level order matches pathway configuration
- [ ] Progress tracked separately per pathway
- [ ] Switching pathways shows different ladder

### 4.6 Test Submission with Pathway Context
- [ ] Test submission includes pathway_id
- [ ] Completing level unlocks next in same pathway
- [ ] Progress doesn't affect other pathways
- [ ] Achievements awarded per pathway

### 4.7 Pathway Switching
- [ ] Click "Switch to this pathway" button
- [ ] Current pathway indicator updates
- [ ] Ladder reloads with new pathway levels
- [ ] Browser localStorage stores current_pathway_id
- [ ] Page refresh remembers selected pathway

---

## Phase 5: Boss Dashboard Updates

### 5.1 Pathway Filter Dropdown
- [ ] "All Pathways" button appears in Boss navigation (next to profile)
- [ ] Shows current filter: "All Pathways" or pathway name
- [ ] Dropdown lists all active pathways
- [ ] Each pathway shows icon with color styling
- [ ] Click outside closes dropdown

### 5.2 Team Progress Filtering
- [ ] Selecting "All Pathways" shows all team members
- [ ] Selecting specific pathway filters team list
- [ ] Shows only consultants enrolled in selected pathway
- [ ] "Levels" column shows progress in filtered pathway
- [ ] Empty state: "No team members enrolled in this pathway"

### 5.3 Signoff Requests with Pathway Context
- [ ] Signoff requests show pathway name
- [ ] Visual pathway icon displayed
- [ ] Can filter signoff requests by pathway (optional)
- [ ] Pathway context clear in review modal

### 5.4 View Progress Modal
- [ ] Opens for team member
- [ ] Filters progress by selected pathway
- [ ] Shows levels completed in that pathway
- [ ] Test history filtered by pathway

---

## Phase 6: Pathway Analytics

### 6.1 Admin Reports Tab - Pathway Analytics Cards
- [ ] New section "Pathway Analytics" in Reports tab
- [ ] Grid layout of pathway cards
- [ ] Each card shows:
  - [ ] Pathway icon and name with colors
  - [ ] Enrollment count
  - [ ] Completion count (users who completed all levels)
  - [ ] In-progress count
  - [ ] Completion rate percentage
  - [ ] Visual progress bar (color-coded)
  - [ ] Level count

### 6.2 Analytics Calculations
- [ ] Enrolled Count: Approved enrollments only
- [ ] Completed Count: Users who finished all levels
- [ ] In-Progress Count: Users with unlocked/in_progress levels
- [ ] Completion Rate: (Completed / Enrolled) * 100
- [ ] Progress bar colors:
  - [ ] Green: > 75%
  - [ ] Yellow: 50-75%
  - [ ] Orange: 25-50%
  - [ ] Red: < 25%

### 6.3 Analytics Data Accuracy
- [ ] Counts match actual database records
- [ ] Real-time updates when enrollments change
- [ ] Percentages rounded to 1 decimal place
- [ ] Shows "No enrollments yet" for empty pathways

---

## Phase 7: Shared Levels Indicator

### 7.1 Available Levels Display
- [ ] Shows "Shared" badge on levels in multiple pathways
- [ ] Badge styled with blue background
- [ ] Icon: fa-share-nodes
- [ ] Tooltip/hover shows "Used in X pathways"

### 7.2 Assigned Levels Display
- [ ] Shows "Also in:" followed by pathway names
- [ ] Comma-separated list of other pathways
- [ ] Styled with blue badge
- [ ] Icon: fa-share-nodes
- [ ] Example: "Also in: OXD, Sales Academy"

### 7.3 Shared Levels Query
- [ ] Backend returns shared pathway information
- [ ] Query joins pathway_levels to find duplicates
- [ ] Only shows active pathways in "Also in" list
- [ ] Performance optimized for multiple pathways

---

## Integration Tests

### 8.1 Complete User Journey - Consultant
1. [ ] Login as new consultant
2. [ ] See pathway selection modal
3. [ ] Request enrollment in "OXD" pathway
4. [ ] Wait for boss approval (simulate)
5. [ ] Login again, see "OXD" as current pathway
6. [ ] View ladder with OXD levels only
7. [ ] Start and complete a level
8. [ ] Switch to different pathway
9. [ ] Verify ladder shows new pathway levels
10. [ ] Original pathway progress preserved

### 8.2 Complete User Journey - Boss
1. [ ] Login as boss
2. [ ] See "All Pathways" filter in navigation
3. [ ] View enrollment requests
4. [ ] Approve consultant's OXD request
5. [ ] Filter team by OXD pathway
6. [ ] See consultant in filtered list
7. [ ] View consultant's progress
8. [ ] Switch to "All Pathways"
9. [ ] See full team list

### 8.3 Complete User Journey - Admin
1. [ ] Login as admin
2. [ ] Go to Pathways tab
3. [ ] Create new pathway "Sales Academy"
4. [ ] Select icon and colors
5. [ ] Manage levels: Add 5 levels
6. [ ] Reorder levels via drag-and-drop
7. [ ] View analytics for all pathways
8. [ ] Check enrollment counts
9. [ ] See shared levels indicators
10. [ ] Deactivate pathway
11. [ ] Verify it doesn't show for consultants

---

## Cross-Browser Testing

### 9.1 Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Test areas:**
- Modal displays
- Drag-and-drop functionality
- Color picker compatibility
- Icon rendering

### 9.2 Mobile Browsers
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)
- [ ] Firefox Mobile

**Test areas:**
- Responsive pathway cards
- Touch interactions for modals
- Dropdown menus on small screens
- Pathway switcher button

---

## Performance Tests

### 10.1 Database Performance
- [ ] Load time for /api/admin/pathways with 10+ pathways
- [ ] Query performance for pathway analytics with 100+ users
- [ ] Ladder load time with multiple pathways
- [ ] Enrollment request list with 50+ requests

### 10.2 Frontend Performance
- [ ] Pathway cards render smoothly (50+ pathways)
- [ ] Modal open/close animations smooth
- [ ] Drag-and-drop responsive with 20+ levels
- [ ] No memory leaks after switching pathways 10 times

---

## Security Tests

### 11.1 Authentication & Authorization
- [ ] Unauthenticated users cannot access APIs
- [ ] Consultants cannot access admin routes
- [ ] Boss cannot approve other boss's requests
- [ ] CSRF protection on all mutations
- [ ] SQL injection prevention in all queries

### 11.2 Data Validation
- [ ] Pathway title required and length limited
- [ ] Color codes validated (hex format)
- [ ] Pathway ID validation prevents invalid references
- [ ] Enrollment status enum validation
- [ ] Order index validation (positive integers)

---

## Edge Cases & Error Handling

### 12.1 Empty States
- [ ] No pathways created: Shows empty state message
- [ ] No enrollments: Analytics shows 0% correctly
- [ ] No levels assigned: "No levels assigned yet" message
- [ ] No enrollment requests: "No pending requests" message

### 12.2 Deletion & Deactivation
- [ ] Cannot delete pathway with enrollments
- [ ] Deactivated pathways hidden from consultants
- [ ] Deactivated pathways visible to admins
- [ ] Deleting pathway removes all pathway_levels entries

### 12.3 Concurrent Operations
- [ ] Two admins editing same pathway simultaneously
- [ ] Boss approves request while admin deletes pathway
- [ ] Consultant switches pathways during test submission
- [ ] Multiple level additions to same pathway

### 12.4 Data Integrity
- [ ] Orphaned records: No pathway_levels without valid pathway_id
- [ ] Orphaned enrollments: No enrollments for deleted pathways
- [ ] Progress consistency: pathway_id matches enrollment
- [ ] Unique constraints enforced

---

## Regression Tests

### 13.1 Pre-Pathways Functionality
- [ ] Users without pathways can still see levels (backward compatibility)
- [ ] Old ladder endpoint (/api/consultant/ladder) still works without pathway_id
- [ ] Achievements system still functional
- [ ] Leaderboard not affected by pathway changes
- [ ] Boss sign-off process unchanged

### 13.2 Existing Data Migration
- [ ] All existing user_progress has pathway_id = 1
- [ ] No NULL pathway_id in user_progress table
- [ ] Existing relationships preserved
- [ ] Levels not duplicated

---

## Accessibility Tests

### 14.1 Keyboard Navigation
- [ ] Tab through pathway cards
- [ ] Enter/Space to open modals
- [ ] Esc to close modals
- [ ] Arrow keys in icon selector
- [ ] Tab through form fields

### 14.2 Screen Reader Support
- [ ] Pathway names announced
- [ ] Icon descriptions available
- [ ] Modal titles announced on open
- [ ] Form labels properly associated
- [ ] Error messages announced

### 14.3 Visual Accessibility
- [ ] Color contrast meets WCAG AA standards
- [ ] Pathway colors readable on white background
- [ ] Focus indicators visible
- [ ] Text readable at 200% zoom
- [ ] Icons have text alternatives

---

## Documentation Tests

### 15.1 README.md
- [ ] Pathways system described
- [ ] Migration instructions included
- [ ] API endpoints documented
- [ ] Screenshots/GIFs added (optional)

### 15.2 Code Comments
- [ ] Complex SQL queries commented
- [ ] API route purposes explained
- [ ] Frontend functions documented

---

## Deployment Checklist

### 16.1 Pre-Deployment
- [ ] All tests passing
- [ ] Git commits with clear messages
- [ ] No console errors in browser
- [ ] Database migrations tested locally
- [ ] Build completes without warnings

### 16.2 Production Deployment
- [ ] Backup production database
- [ ] Run migrations on production D1: `npx wrangler d1 migrations apply training-platform-production --remote`
- [ ] Deploy to Cloudflare Pages: `npm run build && npx wrangler pages deploy dist --project-name training-platform`
- [ ] Verify deployment URL working
- [ ] Test with production accounts

### 16.3 Post-Deployment
- [ ] Smoke test: Login as admin, boss, consultant
- [ ] Check pathway dropdown shows all pathways
- [ ] Verify analytics data accurate
- [ ] Test enrollment request flow
- [ ] Monitor error logs for 24 hours

---

## Known Issues / Future Enhancements

### Known Issues
1. ~~Pathway dropdown not showing pathways without enrollments~~ **FIXED**
2. ~~Level count showing as 0 instead of actual count~~ **FIXED**
3. ~~Authentication error when loading consultant pathways~~ **FIXED**
4. ~~SQL error: "no such column: pe.enrolled_at"~~ **FIXED**

### Future Enhancements
1. Pathway templates (pre-configured level sets)
2. Pathway duplication feature
3. Bulk enrollment operations
4. Pathway completion certificates
5. Time-to-complete analytics
6. Popular pathways dashboard
7. Pathway difficulty ratings
8. Prerequisites between pathways
9. Pathway tags/categories
10. Export pathway configuration as JSON

---

## Test Status Summary

**Total Test Cases:** ~250  
**Automated:** 0  
**Manual:** 250  
**Status:** Ready for comprehensive testing

### Priority Levels
- **P0 (Critical):** Must work for production release - 80 tests
- **P1 (High):** Important but workarounds exist - 100 tests
- **P2 (Medium):** Nice to have - 50 tests
- **P3 (Low):** Future improvements - 20 tests

---

## Testing Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | [Your Name] | 2025-12-03 | ✅ Code Complete |
| QA Lead | [TBD] | [TBD] | ⏳ Pending |
| Product Owner | [TBD] | [TBD] | ⏳ Pending |
| Admin User | [TBD] | [TBD] | ⏳ Pending |
| Boss User | [TBD] | [TBD] | ⏳ Pending |
| Consultant User | [TBD] | [TBD] | ⏳ Pending |

---

**Last Updated:** 2025-12-03  
**Version:** 1.0  
**Next Review:** After first round of testing
