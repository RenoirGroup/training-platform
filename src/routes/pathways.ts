import { Hono } from 'hono';
import { authMiddleware } from '../utils/middleware';
import type { Bindings, JWTPayload } from '../types';

const pathways = new Hono<{ Bindings: Bindings; Variables: { user: JWTPayload } }>();

// Apply authentication middleware to all routes
pathways.use('/*', authMiddleware);

// ============================================
// ADMIN ROUTES - Pathway Management
// ============================================

// Get all pathways (admin can see all, including inactive)
pathways.get('/admin/pathways', async (c) => {
  const user = c.get('user');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const result = await c.env.DB.prepare(`
    SELECT p.*, 
           COUNT(DISTINCT pe.user_id) as enrolled_count,
           COUNT(DISTINCT pl.level_id) as level_count
    FROM pathways p
    LEFT JOIN pathway_enrollments pe ON p.id = pe.pathway_id AND pe.status = 'approved'
    LEFT JOIN pathway_levels pl ON p.id = pl.pathway_id
    GROUP BY p.id
    ORDER BY p.order_index
  `).all();

  return c.json({ pathways: result.results });
});

// IMPORTANT: Analytics route must come BEFORE :id route to avoid matching "analytics" as an id
// Get pathway analytics
pathways.get('/admin/pathways/analytics', async (c) => {
  const user = c.get('user');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    // Get basic pathway info with level counts
    const pathwaysResult = await c.env.DB.prepare(`
      SELECT 
        p.*,
        COUNT(DISTINCT pl.level_id) as level_count
      FROM pathways p
      LEFT JOIN pathway_levels pl ON p.id = pl.pathway_id
      GROUP BY p.id
      ORDER BY p.order_index
    `).all();

    const pathways = pathwaysResult.results || [];

    // For each pathway, calculate enrollment stats
    const analytics = await Promise.all(
      pathways.map(async (pathway) => {
        // Get enrolled users count
        const enrolledResult = await c.env.DB.prepare(`
          SELECT COUNT(DISTINCT user_id) as count
          FROM pathway_enrollments
          WHERE pathway_id = ? AND status = 'approved'
        `).bind(pathway.id).first();

        const enrolled_count = enrolledResult?.count || 0;

        // Get completed users count (users who completed all levels)
        const completedResult = await c.env.DB.prepare(`
          SELECT COUNT(DISTINCT pe.user_id) as count
          FROM pathway_enrollments pe
          WHERE pe.pathway_id = ? 
            AND pe.status = 'approved'
            AND (
              SELECT COUNT(DISTINCT up.level_id)
              FROM user_progress up
              JOIN pathway_levels pl ON up.level_id = pl.level_id
              WHERE up.user_id = pe.user_id 
                AND up.pathway_id = ?
                AND pl.pathway_id = ?
                AND up.status = 'completed'
            ) = ?
        `).bind(pathway.id, pathway.id, pathway.id, pathway.level_count || 0).first();

        const completed_count = completedResult?.count || 0;

        // Get in-progress users count
        const inProgressResult = await c.env.DB.prepare(`
          SELECT COUNT(DISTINCT pe.user_id) as count
          FROM pathway_enrollments pe
          WHERE pe.pathway_id = ? 
            AND pe.status = 'approved'
            AND EXISTS (
              SELECT 1
              FROM user_progress up
              WHERE up.user_id = pe.user_id 
                AND up.pathway_id = ?
                AND up.status IN ('in_progress', 'unlocked')
            )
        `).bind(pathway.id, pathway.id).first();

        const in_progress_count = inProgressResult?.count || 0;

        // Calculate completion rate
        const completion_rate = enrolled_count > 0 
          ? Math.round((completed_count / enrolled_count) * 100) 
          : 0;

        return {
          ...pathway,
          enrolled_count,
          completed_count,
          in_progress_count,
          completion_rate
        };
      })
    );

    return c.json({ analytics });
  } catch (error: any) {
    console.error('[ANALYTICS] Error:', error);
    return c.json({ error: 'Failed to load analytics', details: error.message }, 500);
  }
});

// Get single pathway details
pathways.get('/admin/pathways/:id', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('id');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const pathway = await c.env.DB.prepare(
    'SELECT * FROM pathways WHERE id = ?'
  ).bind(pathwayId).first();

  if (!pathway) {
    return c.json({ error: 'Pathway not found' }, 404);
  }

  // Get assigned levels
  const levels = await c.env.DB.prepare(`
    SELECT l.*, pl.order_index as pathway_order
    FROM pathway_levels pl
    JOIN levels l ON pl.level_id = l.id
    WHERE pl.pathway_id = ?
    ORDER BY pl.order_index
  `).bind(pathwayId).all();

  return c.json({ 
    pathway,
    levels: levels.results 
  });
});

// Create new pathway
pathways.post('/admin/pathways', async (c) => {
  const user = c.get('user');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const { title, description, icon, color_primary, color_secondary, order_index } = await c.req.json();

  if (!title) {
    return c.json({ error: 'Title is required' }, 400);
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO pathways (title, description, icon, color_primary, color_secondary, order_index) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(title, description || null, icon || 'fa-book', color_primary || '#1524A9', color_secondary || '#0077FF', order_index || 0).run();

  const pathway = await c.env.DB.prepare(
    'SELECT * FROM pathways WHERE id = ?'
  ).bind(result.meta.last_row_id).first();

  return c.json({ pathway }, 201);
});

// Update pathway
pathways.put('/admin/pathways/:id', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('id');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const { title, description, icon, color_primary, color_secondary, order_index, active } = await c.req.json();

  await c.env.DB.prepare(
    'UPDATE pathways SET title = ?, description = ?, icon = ?, color_primary = ?, color_secondary = ?, order_index = ?, active = ? WHERE id = ?'
  ).bind(title, description, icon, color_primary, color_secondary, order_index, active, pathwayId).run();

  const pathway = await c.env.DB.prepare(
    'SELECT * FROM pathways WHERE id = ?'
  ).bind(pathwayId).first();

  return c.json({ pathway });
});

// Delete pathway
pathways.delete('/admin/pathways/:id', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('id');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // Check if pathway has enrolled users
  const enrollments = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM pathway_enrollments WHERE pathway_id = ? AND status = ?'
  ).bind(pathwayId, 'approved').first();

  if (enrollments && (enrollments.count as number) > 0) {
    return c.json({ error: 'Cannot delete pathway with enrolled users. Deactivate it instead.' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM pathways WHERE id = ?').bind(pathwayId).run();

  return c.json({ message: 'Pathway deleted successfully' });
});

// Get pathway levels
pathways.get('/admin/pathways/:id/levels', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('id');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const levels = await c.env.DB.prepare(`
    SELECT l.*, pl.order_index, pl.pathway_id, pl.level_id
    FROM pathway_levels pl
    JOIN levels l ON pl.level_id = l.id
    WHERE pl.pathway_id = ?
    ORDER BY pl.order_index
  `).bind(pathwayId).all();

  return c.json({ levels: levels.results });
});

// Assign single level to pathway
pathways.post('/admin/pathways/:id/levels', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('id');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const { level_id } = await c.req.json();

  // Get max order_index for this pathway
  const maxOrder = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(order_index), 0) as max_order FROM pathway_levels WHERE pathway_id = ?'
  ).bind(pathwayId).first();

  const newOrder = ((maxOrder?.max_order as number) || 0) + 1;

  await c.env.DB.prepare(
    'INSERT INTO pathway_levels (pathway_id, level_id, order_index) VALUES (?, ?, ?)'
  ).bind(pathwayId, level_id, newOrder).run();

  return c.json({ message: 'Level assigned successfully' });
});

// Remove level from pathway
pathways.delete('/admin/pathways/:id/levels/:levelId', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('id');
  const levelId = c.req.param('levelId');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  await c.env.DB.prepare(
    'DELETE FROM pathway_levels WHERE pathway_id = ? AND level_id = ?'
  ).bind(pathwayId, levelId).run();

  return c.json({ message: 'Level removed successfully' });
});

// Reorder pathway levels
pathways.post('/admin/pathways/:id/reorder', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('id');
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const { levels } = await c.req.json(); // Array of { level_id, order_index }

  // Update each level's order
  for (const item of levels) {
    await c.env.DB.prepare(
      'UPDATE pathway_levels SET order_index = ? WHERE pathway_id = ? AND level_id = ?'
    ).bind(item.order_index, pathwayId, item.level_id).run();
  }

  return c.json({ message: 'Levels reordered successfully' });
});

// ============================================
// CONSULTANT ROUTES - Browse & Request
// ============================================

// Get available pathways for browsing
pathways.get('/consultant/pathways/available', async (c) => {
  const user = c.get('user');

  // Get all active pathways with enrollment status
  const result = await c.env.DB.prepare(`
    SELECT p.*,
           pe.id as enrollment_id,
           pe.status as enrollment_status,
           pe.request_note,
           pe.response_note,
           pe.requested_at,
           COUNT(DISTINCT pl.level_id) as level_count
    FROM pathways p
    LEFT JOIN pathway_enrollments pe ON p.id = pe.pathway_id AND pe.user_id = ?
    LEFT JOIN pathway_levels pl ON p.id = pl.pathway_id
    WHERE p.active = 1
    GROUP BY p.id
    ORDER BY p.order_index
  `).bind(user.userId).all();

  return c.json({ pathways: result.results });
});

// Get my enrolled pathways
pathways.get('/consultant/pathways/enrolled', async (c) => {
  const user = c.get('user');

  const result = await c.env.DB.prepare(`
    SELECT p.*,
           pe.requested_at,
           pe.reviewed_at,
           pe.status as enrollment_status,
           pe.id as enrollment_id,
           pe.pathway_id,
           pe.cohort_id,
           cp.deadline,
           COUNT(DISTINCT pl.level_id) as level_count,
           COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.level_id END) as completed_levels
    FROM pathways p
    JOIN pathway_enrollments pe ON p.id = pe.pathway_id
    LEFT JOIN cohort_pathways cp ON pe.cohort_id = cp.cohort_id AND p.id = cp.pathway_id
    LEFT JOIN pathway_levels pl ON p.id = pl.pathway_id
    LEFT JOIN user_progress up ON pl.level_id = up.level_id AND up.user_id = ? AND up.pathway_id = p.id
    WHERE pe.user_id = ? AND pe.status = 'approved' AND p.active = 1
    GROUP BY p.id
    ORDER BY p.order_index
  `).bind(user.userId, user.userId).all();

  return c.json({ pathways: result.results });
});

// Request enrollment in a pathway
pathways.post('/consultant/pathways/:id/request', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('id');
  const { request_note } = await c.req.json();

  // Check if pathway exists and is active
  const pathway = await c.env.DB.prepare(
    'SELECT * FROM pathways WHERE id = ? AND active = 1'
  ).bind(pathwayId).first();

  if (!pathway) {
    return c.json({ error: 'Pathway not found' }, 404);
  }

  // Check if already enrolled or has pending request
  const existing = await c.env.DB.prepare(
    'SELECT * FROM pathway_enrollments WHERE user_id = ? AND pathway_id = ?'
  ).bind(user.userId, pathwayId).first();

  if (existing) {
    return c.json({ error: 'Already enrolled or request pending' }, 400);
  }

  // Create enrollment request
  await c.env.DB.prepare(
    'INSERT INTO pathway_enrollments (user_id, pathway_id, status, request_note, enrolled_by) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.userId, pathwayId, 'pending', request_note || null, user.userId).run();

  return c.json({ message: 'Enrollment request submitted successfully' }, 201);
});

// ============================================
// BOSS ROUTES - Approve Requests
// ============================================

// Get all active pathways for boss filtering
pathways.get('/boss/pathways', async (c) => {
  const user = c.get('user');
  
  if (user.role !== 'boss' && user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const result = await c.env.DB.prepare(`
    SELECT p.*,
           COUNT(DISTINCT pl.level_id) as level_count
    FROM pathways p
    LEFT JOIN pathway_levels pl ON p.id = pl.pathway_id
    WHERE p.active = 1
    GROUP BY p.id
    ORDER BY p.order_index
  `).all();

  return c.json({ pathways: result.results });
});

// Get pending enrollment requests for team
pathways.get('/boss/enrollment-requests', async (c) => {
  const user = c.get('user');

  const result = await c.env.DB.prepare(`
    SELECT pe.*,
           u.name as consultant_name,
           u.email as consultant_email,
           p.title as pathway_title,
           p.description as pathway_description,
           p.icon as pathway_icon,
           p.color_primary
    FROM pathway_enrollments pe
    JOIN users u ON pe.user_id = u.id
    JOIN pathways p ON pe.pathway_id = p.id
    WHERE u.boss_id = ? AND pe.status = 'pending'
    ORDER BY pe.requested_at DESC
  `).bind(user.userId).all();

  return c.json({ requests: result.results });
});

// Approve enrollment request
pathways.post('/boss/enrollment-requests/:id/approve', async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  const { response_note } = await c.req.json();

  // Verify boss owns this consultant
  const request = await c.env.DB.prepare(`
    SELECT pe.*, u.boss_id, pe.pathway_id
    FROM pathway_enrollments pe
    JOIN users u ON pe.user_id = u.id
    WHERE pe.id = ?
  `).bind(requestId).first();

  if (!request || request.boss_id !== user.userId) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // Approve request
  await c.env.DB.prepare(
    'UPDATE pathway_enrollments SET status = ?, response_note = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?'
  ).bind('approved', response_note || null, user.userId, requestId).run();

  // Unlock first level in pathway for the consultant
  const firstLevel = await c.env.DB.prepare(`
    SELECT level_id FROM pathway_levels 
    WHERE pathway_id = ? 
    ORDER BY order_index 
    LIMIT 1
  `).bind(request.pathway_id).first();

  if (firstLevel) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO user_progress (user_id, level_id, pathway_id, status) VALUES (?, ?, ?, ?)'
    ).bind(request.user_id, firstLevel.level_id, request.pathway_id, 'unlocked').run();
  }

  return c.json({ message: 'Enrollment approved successfully' });
});

// Reject enrollment request
pathways.post('/boss/enrollment-requests/:id/reject', async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  const { response_note } = await c.req.json();

  // Verify boss owns this consultant
  const request = await c.env.DB.prepare(`
    SELECT pe.*, u.boss_id
    FROM pathway_enrollments pe
    JOIN users u ON pe.user_id = u.id
    WHERE pe.id = ?
  `).bind(requestId).first();

  if (!request || request.boss_id !== user.userId) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // Reject request
  await c.env.DB.prepare(
    'UPDATE pathway_enrollments SET status = ?, response_note = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?'
  ).bind('rejected', response_note || null, user.userId, requestId).run();

  return c.json({ message: 'Enrollment rejected' });
});

// ============================================
// ADMIN ROUTES - View All Enrollment Requests
// ============================================

// Get all enrollment requests (admin can see all)
pathways.get('/admin/enrollment-requests', async (c) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const result = await c.env.DB.prepare(`
    SELECT pe.*,
           u.name as consultant_name,
           u.email as consultant_email,
           u.role as consultant_role,
           u.division,
           u.region,
           u.location,
           u.title,
           p.title as pathway_title,
           p.description as pathway_description,
           p.icon as pathway_icon,
           p.color_primary,
           b.name as boss_name
    FROM pathway_enrollments pe
    JOIN users u ON pe.user_id = u.id
    JOIN pathways p ON pe.pathway_id = p.id
    LEFT JOIN users b ON u.boss_id = b.id
    WHERE pe.status = 'pending'
    ORDER BY pe.requested_at DESC
  `).all();

  return c.json({ requests: result.results });
});

// Approve enrollment request (admin)
pathways.post('/admin/enrollment-requests/:id/approve', async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  
  // Parse body safely (may be empty)
  let response_note = null;
  try {
    const body = await c.req.json();
    response_note = body?.response_note || null;
  } catch (e) {
    // Empty body is OK for approval
  }

  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const request = await c.env.DB.prepare(
    'SELECT * FROM pathway_enrollments WHERE id = ?'
  ).bind(requestId).first();

  if (!request) {
    return c.json({ error: 'Request not found' }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE pathway_enrollments SET status = ?, response_note = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?'
  ).bind('approved', response_note, user.userId, requestId).run();

  return c.json({ message: 'Enrollment approved' });
});

// Reject enrollment request (admin)
pathways.post('/admin/enrollment-requests/:id/reject', async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  const { response_note } = await c.req.json();

  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const request = await c.env.DB.prepare(
    'SELECT * FROM pathway_enrollments WHERE id = ?'
  ).bind(requestId).first();

  if (!request) {
    return c.json({ error: 'Request not found' }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE pathway_enrollments SET status = ?, response_note = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?'
  ).bind('rejected', response_note || null, user.userId, requestId).run();

  return c.json({ message: 'Enrollment rejected' });
});

// Get available users for pathway assignment (admin)
pathways.get('/admin/pathways/:pathwayId/available-users', async (c) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const pathwayId = c.req.param('pathwayId');

    console.log('[AVAILABLE] Fetching available users for pathway:', pathwayId);

    // Get all users who are NOT enrolled in this pathway (or have non-approved status)
    const result = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        COALESCE(u.division, '') as division,
        COALESCE(u.region, '') as region,
        COALESCE(u.location, '') as location,
        COALESCE(u.title, '') as title
      FROM users u
      WHERE u.active = 1
        AND u.role != 'admin'
        AND NOT EXISTS (
          SELECT 1 
          FROM pathway_enrollments pe 
          WHERE pe.user_id = u.id 
            AND pe.pathway_id = ?
            AND pe.status = 'approved'
        )
      ORDER BY u.name
    `).bind(pathwayId).all();

    console.log('[AVAILABLE] Found users:', result.results?.length || 0);

    return c.json({ users: result.results || [] });
  } catch (error: any) {
    console.error('[AVAILABLE] Error:', error);
    return c.json({ 
      error: 'Database error', 
      message: error?.message || String(error)
    }, 500);
  }
});

// Get enrolled users for pathway (admin)
pathways.get('/admin/pathways/:pathwayId/enrolled', async (c) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const pathwayId = c.req.param('pathwayId');

    console.log('[ENROLLED] Fetching enrolled users for pathway:', pathwayId);

    // Get all enrolled users for this pathway
    const result = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        COALESCE(u.division, '') as division,
        COALESCE(u.region, '') as region,
        COALESCE(u.location, '') as location,
        COALESCE(u.title, '') as title,
        pe.requested_at as enrolled_at,
        pe.status,
        enroller.name as enrolled_by_name
      FROM pathway_enrollments pe
      JOIN users u ON pe.user_id = u.id
      LEFT JOIN users enroller ON pe.enrolled_by = enroller.id
      WHERE pe.pathway_id = ?
        AND pe.status = 'approved'
      ORDER BY pe.requested_at DESC
    `).bind(pathwayId).all();

    console.log('[ENROLLED] Found users:', result.results?.length || 0);

    return c.json({ users: result.results || [] });
  } catch (error: any) {
    console.error('[ENROLLED] Error:', error);
    return c.json({ error: 'Failed to fetch enrolled users', details: error.message }, 500);
  }
});

// ============================================
// BOSS ROUTES - View Team Progress
// ============================================

// Get team progress by pathway
pathways.get('/boss/team/pathway/:pathwayId', async (c) => {
  const user = c.get('user');
  const pathwayId = c.req.param('pathwayId');

  const result = await c.env.DB.prepare(`
    SELECT u.id, u.name, u.email,
           COUNT(DISTINCT pl.level_id) as total_levels,
           COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.level_id END) as completed_levels,
           CASE 
             WHEN COUNT(DISTINCT pl.level_id) > 0 
             THEN ROUND(COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.level_id END) * 100.0 / COUNT(DISTINCT pl.level_id), 1)
             ELSE 0 
           END as completion_percentage
    FROM users u
    JOIN pathway_enrollments pe ON u.id = pe.user_id
    LEFT JOIN pathway_levels pl ON pe.pathway_id = pl.pathway_id
    LEFT JOIN user_progress up ON pl.level_id = up.level_id AND up.user_id = u.id AND up.pathway_id = pe.pathway_id
    WHERE u.boss_id = ? AND pe.pathway_id = ? AND pe.status = 'approved'
    GROUP BY u.id
    ORDER BY u.name
  `).bind(user.userId, pathwayId).all();

  return c.json({ team: result.results });
});

export default pathways;
