import { Hono } from 'hono';
import { authMiddleware, bossOnly } from '../utils/middleware';
import type { Bindings, JWTPayload } from '../types';

const boss = new Hono<{ Bindings: Bindings; Variables: { user: JWTPayload } }>();

// Apply authentication and boss-only middleware
boss.use('/*', authMiddleware, bossOnly);

// ===== TEAM MANAGEMENT =====

// Get team members (direct reports via many-to-many relationships)
boss.get('/team', async (c) => {
  const user = c.get('user');
  
  const team = await c.env.DB.prepare(`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.created_at,
      u.last_login,
      bcr.project_name,
      COUNT(DISTINCT up.level_id) as levels_completed,
      us.total_points,
      us.current_login_streak,
      l.rank,
      l.league
    FROM boss_consultant_relationships bcr
    JOIN users u ON bcr.consultant_id = u.id
    LEFT JOIN user_progress up ON u.id = up.user_id AND up.status = 'completed'
    LEFT JOIN user_streaks us ON u.id = us.user_id
    LEFT JOIN leaderboard l ON u.id = l.user_id
    WHERE bcr.boss_id = ? AND bcr.active = 1 AND u.role = 'consultant' AND u.active = 1
    GROUP BY u.id, bcr.project_name
    ORDER BY levels_completed DESC, us.total_points DESC
  `).bind(user.userId).all();

  return c.json({ team: team.results });
});

// Get individual team member progress
boss.get('/team/:userId/progress', async (c) => {
  const userId = c.req.param('userId');
  const bossUser = c.get('user');
  
  // Verify this user is a direct report via relationship table
  const relationship = await c.env.DB.prepare(
    'SELECT * FROM boss_consultant_relationships WHERE consultant_id = ? AND boss_id = ? AND active = 1'
  ).bind(userId, bossUser.userId).first();

  if (!relationship) {
    return c.json({ error: 'Not authorized to view this user' }, 403);
  }
  
  // Get team member details
  const teamMember = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!teamMember) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get progress
  const progress = await c.env.DB.prepare(`
    SELECT 
      l.*,
      up.status,
      up.started_at,
      up.completed_at
    FROM levels l
    LEFT JOIN user_progress up ON l.id = up.level_id AND up.user_id = ?
    WHERE l.active = 1
    ORDER BY l.order_index
  `).bind(userId).all();

  // Get recent test attempts
  const recentTests = await c.env.DB.prepare(`
    SELECT 
      ta.*,
      t.title as test_title,
      l.title as level_title
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    JOIN levels l ON t.level_id = l.id
    WHERE ta.user_id = ?
    ORDER BY ta.completed_at DESC
    LIMIT 10
  `).bind(userId).all();

  // Get stats
  const stats = await c.env.DB.prepare(
    'SELECT * FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();

  return c.json({
    user: teamMember,
    progress: progress.results,
    recentTests: recentTests.results,
    stats,
  });
});

// ===== SIGN-OFF MANAGEMENT =====

// Get pending sign-off requests
boss.get('/signoff-requests', async (c) => {
  const user = c.get('user');
  
  const requests = await c.env.DB.prepare(`
    SELECT 
      sr.*,
      u.name as consultant_name,
      u.email as consultant_email,
      l.title as level_title,
      l.description as level_description
    FROM signoff_requests sr
    JOIN users u ON sr.user_id = u.id
    JOIN levels l ON sr.level_id = l.id
    WHERE sr.boss_id = ? AND sr.status = 'pending'
    ORDER BY sr.requested_at DESC
  `).bind(user.userId).all();

  return c.json({ requests: requests.results });
});

// Get all sign-off requests (including completed)
boss.get('/signoff-requests/all', async (c) => {
  const user = c.get('user');
  
  const requests = await c.env.DB.prepare(`
    SELECT 
      sr.*,
      u.name as consultant_name,
      u.email as consultant_email,
      l.title as level_title
    FROM signoff_requests sr
    JOIN users u ON sr.user_id = u.id
    JOIN levels l ON sr.level_id = l.id
    WHERE sr.boss_id = ?
    ORDER BY sr.requested_at DESC
    LIMIT 100
  `).bind(user.userId).all();

  return c.json({ requests: requests.results });
});

// Get sign-off request details
boss.get('/signoff-requests/:requestId', async (c) => {
  const requestId = c.req.param('requestId');
  const user = c.get('user');
  
  const request = await c.env.DB.prepare(`
    SELECT 
      sr.*,
      u.name as consultant_name,
      u.email as consultant_email,
      l.title as level_title,
      l.description as level_description
    FROM signoff_requests sr
    JOIN users u ON sr.user_id = u.id
    JOIN levels l ON sr.level_id = l.id
    WHERE sr.id = ? AND sr.boss_id = ?
  `).bind(requestId, user.userId).first();

  if (!request) {
    return c.json({ error: 'Request not found' }, 404);
  }

  // Get boss level tasks
  const tasks = await c.env.DB.prepare(
    'SELECT * FROM boss_level_tasks WHERE level_id = ? ORDER BY order_index'
  ).bind(request.level_id).all();

  // Get consultant's test performance for this level
  const testPerformance = await c.env.DB.prepare(`
    SELECT 
      t.title,
      ta.score,
      ta.max_score,
      ta.percentage,
      ta.passed,
      ta.completed_at
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    WHERE t.level_id = ? AND ta.user_id = ? AND ta.passed = 1
    ORDER BY ta.completed_at DESC
  `).bind(request.level_id, request.user_id).all();

  return c.json({
    request,
    tasks: tasks.results,
    testPerformance: testPerformance.results,
  });
});

// Approve sign-off request
boss.post('/signoff-requests/:requestId/approve', async (c) => {
  const requestId = c.req.param('requestId');
  const user = c.get('user');
  const { feedback } = await c.req.json();

  // Verify request belongs to this boss
  const request = await c.env.DB.prepare(
    'SELECT * FROM signoff_requests WHERE id = ? AND boss_id = ?'
  ).bind(requestId, user.userId).first();

  if (!request) {
    return c.json({ error: 'Request not found' }, 404);
  }

  if (request.status !== 'pending') {
    return c.json({ error: 'Request already processed' }, 400);
  }

  // Update request
  await c.env.DB.prepare(
    'UPDATE signoff_requests SET status = ?, boss_feedback = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind('approved', feedback || null, requestId).run();

  // Complete the level for the consultant
  await completeLevel(c.env.DB, request.user_id as number, request.level_id as number);

  // Award boss level achievement
  await checkBossLevelAchievements(c.env.DB, request.user_id as number);

  // TODO: Send email notification to consultant

  return c.json({ message: 'Sign-off approved' });
});

// Reject sign-off request
boss.post('/signoff-requests/:requestId/reject', async (c) => {
  const requestId = c.req.param('requestId');
  const user = c.get('user');
  const { feedback } = await c.req.json();

  if (!feedback) {
    return c.json({ error: 'Feedback required for rejection' }, 400);
  }

  // Verify request belongs to this boss
  const request = await c.env.DB.prepare(
    'SELECT * FROM signoff_requests WHERE id = ? AND boss_id = ?'
  ).bind(requestId, user.userId).first();

  if (!request) {
    return c.json({ error: 'Request not found' }, 404);
  }

  if (request.status !== 'pending') {
    return c.json({ error: 'Request already processed' }, 400);
  }

  // Update request
  await c.env.DB.prepare(
    'UPDATE signoff_requests SET status = ?, boss_feedback = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind('rejected', feedback, requestId).run();

  // Set level back to in_progress
  await c.env.DB.prepare(
    'UPDATE user_progress SET status = ? WHERE user_id = ? AND level_id = ?'
  ).bind('in_progress', request.user_id, request.level_id).run();

  // TODO: Send email notification to consultant

  return c.json({ message: 'Sign-off rejected' });
});

// ===== ANALYTICS =====

// Get team analytics
boss.get('/analytics', async (c) => {
  const user = c.get('user');
  
  // Get team overview using many-to-many relationships
  const teamStats = await c.env.DB.prepare(`
    SELECT 
      COUNT(DISTINCT u.id) as total_members,
      AVG(CAST(l.rungs_completed AS FLOAT)) as avg_levels_completed,
      AVG(CAST(us.total_points AS FLOAT)) as avg_points,
      AVG(CAST(us.current_login_streak AS FLOAT)) as avg_streak
    FROM boss_consultant_relationships bcr
    JOIN users u ON bcr.consultant_id = u.id
    LEFT JOIN leaderboard l ON u.id = l.user_id
    LEFT JOIN user_streaks us ON u.id = us.user_id
    WHERE bcr.boss_id = ? AND bcr.active = 1 AND u.role = 'consultant' AND u.active = 1
  `).bind(user.userId).first();

  // Get level completion breakdown using many-to-many relationships
  const levelCompletion = await c.env.DB.prepare(`
    SELECT 
      l.id,
      l.title,
      COUNT(DISTINCT up.user_id) as completed_count,
      (SELECT COUNT(DISTINCT consultant_id) FROM boss_consultant_relationships WHERE boss_id = ? AND active = 1) as total_members
    FROM levels l
    LEFT JOIN user_progress up ON l.id = up.level_id 
      AND up.status = 'completed'
      AND up.user_id IN (SELECT consultant_id FROM boss_consultant_relationships WHERE boss_id = ? AND active = 1)
    WHERE l.active = 1
    GROUP BY l.id
    ORDER BY l.order_index
  `).bind(user.userId, user.userId).all();

  // Get recent activity using many-to-many relationships
  const recentActivity = await c.env.DB.prepare(`
    SELECT 
      u.name as consultant_name,
      l.title as level_title,
      up.completed_at
    FROM user_progress up
    JOIN users u ON up.user_id = u.id
    JOIN levels l ON up.level_id = l.id
    JOIN boss_consultant_relationships bcr ON u.id = bcr.consultant_id
    WHERE bcr.boss_id = ? AND bcr.active = 1 AND up.status = 'completed'
    ORDER BY up.completed_at DESC
    LIMIT 20
  `).bind(user.userId).all();

  // Get pending sign-offs count
  const pendingSignoffs = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM signoff_requests
    WHERE boss_id = ? AND status = 'pending'
  `).bind(user.userId).first();

  return c.json({
    teamStats,
    levelCompletion: levelCompletion.results,
    recentActivity: recentActivity.results,
    pendingSignoffs: pendingSignoffs?.count || 0,
  });
});

// Export team report (CSV data)
boss.get('/export/team-report', async (c) => {
  const user = c.get('user');
  
  const teamData = await c.env.DB.prepare(`
    SELECT 
      u.name,
      u.email,
      bcr.project_name,
      COUNT(DISTINCT up.level_id) as levels_completed,
      us.total_points,
      us.current_login_streak,
      us.longest_login_streak,
      l.rank,
      l.league,
      u.last_login
    FROM boss_consultant_relationships bcr
    JOIN users u ON bcr.consultant_id = u.id
    LEFT JOIN user_progress up ON u.id = up.user_id AND up.status = 'completed'
    LEFT JOIN user_streaks us ON u.id = us.user_id
    LEFT JOIN leaderboard l ON u.id = l.user_id
    WHERE bcr.boss_id = ? AND bcr.active = 1 AND u.role = 'consultant' AND u.active = 1
    GROUP BY u.id, bcr.project_name
    ORDER BY levels_completed DESC
  `).bind(user.userId).all();

  // Convert to CSV
  const headers = ['Name', 'Email', 'Project', 'Levels Completed', 'Total Points', 'Current Streak', 'Longest Streak', 'Rank', 'League', 'Last Login'];
  const rows = (teamData.results as any[]).map(row => [
    row.name,
    row.email,
    row.project_name || 'N/A',
    row.levels_completed,
    row.total_points,
    row.current_login_streak,
    row.longest_login_streak,
    row.rank || 'N/A',
    row.league || 'N/A',
    row.last_login || 'Never',
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

  return c.json({ 
    csv,
    data: teamData.results // Include raw data for PDF generation
  });
});

// ===== HELPER FUNCTIONS =====

async function completeLevel(db: D1Database, userId: number, levelId: number) {
  // Mark level as completed
  await db.prepare(
    'UPDATE user_progress SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND level_id = ?'
  ).bind('completed', userId, levelId).run();

  // Log activity
  const today = new Date().toISOString().split('T')[0];
  await db.prepare(
    'INSERT INTO activity_log (user_id, activity_type, activity_date) VALUES (?, ?, ?)'
  ).bind(userId, 'level_complete', today).run();

  // Update leaderboard
  const completed = await db.prepare(
    'SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND status = ?'
  ).bind(userId, 'completed').first();

  const streaks = await db.prepare(
    'SELECT total_points FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();

  await db.prepare(
    'UPDATE leaderboard SET rungs_completed = ?, total_points = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
  ).bind(completed?.count || 0, streaks?.total_points || 0, userId).run();

  // Add points for completing boss level
  await db.prepare(
    'UPDATE user_streaks SET total_points = total_points + 100 WHERE user_id = ?'
  ).bind(userId).run();

  // Unlock next level
  const nextLevel = await db.prepare(
    'SELECT id FROM levels WHERE order_index = (SELECT order_index + 1 FROM levels WHERE id = ?) AND active = 1'
  ).bind(levelId).first();

  if (nextLevel) {
    const existingProgress = await db.prepare(
      'SELECT id FROM user_progress WHERE user_id = ? AND level_id = ?'
    ).bind(userId, nextLevel.id).first();

    if (!existingProgress) {
      await db.prepare(
        'INSERT INTO user_progress (user_id, level_id, status) VALUES (?, ?, ?)'
      ).bind(userId, nextLevel.id, 'unlocked').run();
    } else {
      await db.prepare(
        'UPDATE user_progress SET status = ? WHERE user_id = ? AND level_id = ?'
      ).bind('unlocked', userId, nextLevel.id).run();
    }
  }
}

async function checkBossLevelAchievements(db: D1Database, userId: number) {
  // Check if first boss level
  const bossLevelsCompleted = await db.prepare(`
    SELECT COUNT(*) as count
    FROM user_progress up
    JOIN levels l ON up.level_id = l.id
    WHERE up.user_id = ? AND up.status = 'completed' AND l.is_boss_level = 1
  `).bind(userId).first();

  if (bossLevelsCompleted && bossLevelsCompleted.count === 1) {
    const achievement = await db.prepare(
      'SELECT id, points FROM achievements WHERE code = ?'
    ).bind('boss_complete').first();

    if (achievement) {
      const existing = await db.prepare(
        'SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?'
      ).bind(userId, achievement.id).first();

      if (!existing) {
        await db.prepare(
          'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
        ).bind(userId, achievement.id).run();

        await db.prepare(
          'UPDATE user_streaks SET total_points = total_points + ? WHERE user_id = ?'
        ).bind(achievement.points, userId).run();
      }
    }
  }

  // Check if all boss levels approved without rejection
  const rejectedBossLevels = await db.prepare(`
    SELECT COUNT(*) as count
    FROM signoff_requests sr
    JOIN levels l ON sr.level_id = l.id
    WHERE sr.user_id = ? AND l.is_boss_level = 1 AND sr.status = 'rejected'
  `).bind(userId).first();

  if (rejectedBossLevels && rejectedBossLevels.count === 0) {
    const allBossLevels = await db.prepare(`
      SELECT COUNT(*) as total
      FROM levels
      WHERE is_boss_level = 1 AND active = 1
    `).first();

    const completedBossLevels = await db.prepare(`
      SELECT COUNT(*) as count
      FROM signoff_requests sr
      JOIN levels l ON sr.level_id = l.id
      WHERE sr.user_id = ? AND l.is_boss_level = 1 AND sr.status = 'approved'
    `).bind(userId).first();

    if (allBossLevels && completedBossLevels && 
        allBossLevels.total === completedBossLevels.count) {
      const achievement = await db.prepare(
        'SELECT id, points FROM achievements WHERE code = ?'
      ).bind('boss_perfect').first();

      if (achievement) {
        const existing = await db.prepare(
          'SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?'
        ).bind(userId, achievement.id).first();

        if (!existing) {
          await db.prepare(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
          ).bind(userId, achievement.id).run();

          await db.prepare(
            'UPDATE user_streaks SET total_points = total_points + ? WHERE user_id = ?'
          ).bind(achievement.points, userId).run();
        }
      }
    }
  }
}

export default boss;
