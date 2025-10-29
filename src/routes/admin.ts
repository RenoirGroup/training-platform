import { Hono } from 'hono';
import { adminOnly, authMiddleware } from '../utils/middleware';
import { hashPassword } from '../utils/auth';
import type { Bindings } from '../types';

const admin = new Hono<{ Bindings: Bindings }>();

// Apply authentication and admin-only middleware to all routes
admin.use('/*', authMiddleware, adminOnly);

// ===== USER MANAGEMENT =====

// Get all users
admin.get('/users', async (c) => {
  const users = await c.env.DB.prepare(`
    SELECT u.*, b.name as boss_name 
    FROM users u 
    LEFT JOIN users b ON u.boss_id = b.id 
    ORDER BY u.created_at DESC
  `).all();
  
  return c.json({ users: users.results });
});

// Create user
admin.post('/users', async (c) => {
  try {
    const { email, password, name, role, boss_id } = await c.req.json();

    if (!email || !password || !name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const passwordHash = await hashPassword(password);

    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, name, role, boss_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(email, passwordHash, name, role, boss_id || null).run();

    const userId = result.meta.last_row_id;

    // Initialize streaks
    await c.env.DB.prepare(
      'INSERT INTO user_streaks (user_id) VALUES (?)'
    ).bind(userId).run();

    // Initialize leaderboard
    await c.env.DB.prepare(
      'INSERT INTO leaderboard (user_id, league) VALUES (?, ?)'
    ).bind(userId, 'bronze').run();

    // If consultant, initialize progress for first level
    if (role === 'consultant') {
      const firstLevel = await c.env.DB.prepare(
        'SELECT id FROM levels WHERE active = 1 ORDER BY order_index LIMIT 1'
      ).first();

      if (firstLevel) {
        await c.env.DB.prepare(
          'INSERT INTO user_progress (user_id, level_id, status) VALUES (?, ?, ?)'
        ).bind(userId, firstLevel.id, 'unlocked').run();
      }
    }

    return c.json({ message: 'User created', userId });
  } catch (error) {
    console.error('Create user error:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Update user
admin.put('/users/:id', async (c) => {
  const id = c.req.param('id');
  const { name, role, boss_id, active } = await c.req.json();

  await c.env.DB.prepare(
    'UPDATE users SET name = ?, role = ?, boss_id = ?, active = ? WHERE id = ?'
  ).bind(name, role, boss_id || null, active, id).run();

  return c.json({ message: 'User updated' });
});

// Delete user
admin.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  
  return c.json({ message: 'User deleted' });
});

// ===== LEVEL MANAGEMENT =====

// Get all levels
admin.get('/levels', async (c) => {
  const levels = await c.env.DB.prepare(
    'SELECT * FROM levels ORDER BY order_index'
  ).all();
  
  return c.json({ levels: levels.results });
});

// Create level
admin.post('/levels', async (c) => {
  const { title, description, order_index, is_boss_level } = await c.req.json();

  const result = await c.env.DB.prepare(
    'INSERT INTO levels (title, description, order_index, is_boss_level) VALUES (?, ?, ?, ?)'
  ).bind(title, description || null, order_index, is_boss_level ? 1 : 0).run();

  return c.json({ message: 'Level created', levelId: result.meta.last_row_id });
});

// Update level
admin.put('/levels/:id', async (c) => {
  const id = c.req.param('id');
  const { title, description, order_index, is_boss_level, active } = await c.req.json();

  await c.env.DB.prepare(
    'UPDATE levels SET title = ?, description = ?, order_index = ?, is_boss_level = ?, active = ? WHERE id = ?'
  ).bind(title, description || null, order_index, is_boss_level ? 1 : 0, active, id).run();

  return c.json({ message: 'Level updated' });
});

// Delete level
admin.delete('/levels/:id', async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM levels WHERE id = ?').bind(id).run();
  
  return c.json({ message: 'Level deleted' });
});

// ===== TRAINING MATERIAL MANAGEMENT =====

// Get materials for a level
admin.get('/levels/:levelId/materials', async (c) => {
  const levelId = c.req.param('levelId');
  
  const materials = await c.env.DB.prepare(
    'SELECT * FROM training_materials WHERE level_id = ? ORDER BY order_index'
  ).bind(levelId).all();
  
  return c.json({ materials: materials.results });
});

// Create material
admin.post('/levels/:levelId/materials', async (c) => {
  const levelId = c.req.param('levelId');
  const { title, description, material_type, sharepoint_url, order_index } = await c.req.json();

  const result = await c.env.DB.prepare(
    'INSERT INTO training_materials (level_id, title, description, material_type, sharepoint_url, order_index) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(levelId, title, description || null, material_type, sharepoint_url, order_index).run();

  return c.json({ message: 'Material created', materialId: result.meta.last_row_id });
});

// Update material
admin.put('/materials/:id', async (c) => {
  const id = c.req.param('id');
  const { title, description, material_type, sharepoint_url, order_index } = await c.req.json();

  await c.env.DB.prepare(
    'UPDATE training_materials SET title = ?, description = ?, material_type = ?, sharepoint_url = ?, order_index = ? WHERE id = ?'
  ).bind(title, description || null, material_type, sharepoint_url, order_index, id).run();

  return c.json({ message: 'Material updated' });
});

// Delete material
admin.delete('/materials/:id', async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM training_materials WHERE id = ?').bind(id).run();
  
  return c.json({ message: 'Material deleted' });
});

// ===== TEST MANAGEMENT =====

// Get tests for a level
admin.get('/levels/:levelId/tests', async (c) => {
  const levelId = c.req.param('levelId');
  
  const tests = await c.env.DB.prepare(
    'SELECT * FROM tests WHERE level_id = ?'
  ).bind(levelId).all();
  
  return c.json({ tests: tests.results });
});

// Create test
admin.post('/levels/:levelId/tests', async (c) => {
  const levelId = c.req.param('levelId');
  const { title, description, pass_percentage, time_limit_minutes } = await c.req.json();

  const result = await c.env.DB.prepare(
    'INSERT INTO tests (level_id, title, description, pass_percentage, time_limit_minutes) VALUES (?, ?, ?, ?, ?)'
  ).bind(levelId, title, description || null, pass_percentage || 80, time_limit_minutes || null).run();

  return c.json({ message: 'Test created', testId: result.meta.last_row_id });
});

// Update test
admin.put('/tests/:id', async (c) => {
  const id = c.req.param('id');
  const { title, description, pass_percentage, time_limit_minutes } = await c.req.json();

  await c.env.DB.prepare(
    'UPDATE tests SET title = ?, description = ?, pass_percentage = ?, time_limit_minutes = ? WHERE id = ?'
  ).bind(title, description || null, pass_percentage, time_limit_minutes || null, id).run();

  return c.json({ message: 'Test updated' });
});

// Delete test
admin.delete('/tests/:id', async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM tests WHERE id = ?').bind(id).run();
  
  return c.json({ message: 'Test deleted' });
});

// ===== QUESTION MANAGEMENT =====

// Get questions for a test
admin.get('/tests/:testId/questions', async (c) => {
  const testId = c.req.param('testId');
  
  const questions = await c.env.DB.prepare(`
    SELECT q.*, 
      (SELECT json_group_array(json_object(
        'id', ao.id,
        'option_text', ao.option_text,
        'is_correct', ao.is_correct,
        'order_index', ao.order_index
      ))
      FROM answer_options ao 
      WHERE ao.question_id = q.id 
      ORDER BY ao.order_index) as options
    FROM questions q
    WHERE q.test_id = ?
    ORDER BY q.order_index
  `).bind(testId).all();
  
  return c.json({ questions: questions.results });
});

// Get single question with all details (for editing)
admin.get('/questions/:id', async (c) => {
  const id = c.req.param('id');
  
  const question = await c.env.DB.prepare(
    'SELECT * FROM questions WHERE id = ?'
  ).bind(id).first();
  
  if (!question) {
    return c.json({ error: 'Question not found' }, 404);
  }
  
  const options = await c.env.DB.prepare(
    'SELECT * FROM answer_options WHERE question_id = ? ORDER BY order_index'
  ).bind(id).all();
  
  return c.json({ 
    question: {
      ...question,
      options: options.results 
    }
  });
});

// Create question
admin.post('/tests/:testId/questions', async (c) => {
  const testId = c.req.param('testId');
  const { question_text, question_type, order_index, points, options, answer_data } = await c.req.json();

  const result = await c.env.DB.prepare(
    'INSERT INTO questions (test_id, question_text, question_type, order_index, points, answer_data) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(testId, question_text, question_type, order_index, points || 1, answer_data || null).run();

  const questionId = result.meta.last_row_id;

  // Add answer options
  if (options && Array.isArray(options)) {
    for (const option of options) {
      await c.env.DB.prepare(
        'INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (?, ?, ?, ?)'
      ).bind(questionId, option.option_text, option.is_correct ? 1 : 0, option.order_index).run();
    }
  }

  return c.json({ message: 'Question created', questionId });
});

// Update question
admin.put('/questions/:id', async (c) => {
  const id = c.req.param('id');
  const { question_text, question_type, order_index, points, options, answer_data } = await c.req.json();

  await c.env.DB.prepare(
    'UPDATE questions SET question_text = ?, question_type = ?, order_index = ?, points = ?, answer_data = ? WHERE id = ?'
  ).bind(question_text, question_type, order_index, points, answer_data || null, id).run();

  // Update options if provided
  if (options && Array.isArray(options)) {
    // Delete existing options
    await c.env.DB.prepare(
      'DELETE FROM answer_options WHERE question_id = ?'
    ).bind(id).run();
    
    // Insert new options
    for (const option of options) {
      await c.env.DB.prepare(
        'INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (?, ?, ?, ?)'
      ).bind(id, option.option_text, option.is_correct ? 1 : 0, option.order_index).run();
    }
  }

  return c.json({ message: 'Question updated' });
});

// Delete question
admin.delete('/questions/:id', async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(id).run();
  
  return c.json({ message: 'Question deleted' });
});

// ===== BOSS LEVEL TASK MANAGEMENT =====

// Get tasks for a boss level
admin.get('/levels/:levelId/tasks', async (c) => {
  const levelId = c.req.param('levelId');
  
  const tasks = await c.env.DB.prepare(
    'SELECT * FROM boss_level_tasks WHERE level_id = ? ORDER BY order_index'
  ).bind(levelId).all();
  
  return c.json({ tasks: tasks.results });
});

// Create boss level task
admin.post('/levels/:levelId/tasks', async (c) => {
  const levelId = c.req.param('levelId');
  const { task_description, order_index } = await c.req.json();

  const result = await c.env.DB.prepare(
    'INSERT INTO boss_level_tasks (level_id, task_description, order_index) VALUES (?, ?, ?)'
  ).bind(levelId, task_description, order_index).run();

  return c.json({ message: 'Task created', taskId: result.meta.last_row_id });
});

// Update boss level task
admin.put('/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const { task_description, order_index } = await c.req.json();

  await c.env.DB.prepare(
    'UPDATE boss_level_tasks SET task_description = ?, order_index = ? WHERE id = ?'
  ).bind(task_description, order_index, id).run();

  return c.json({ message: 'Task updated' });
});

// Delete boss level task
admin.delete('/tasks/:id', async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM boss_level_tasks WHERE id = ?').bind(id).run();
  
  return c.json({ message: 'Task deleted' });
});

// ===== BOSS-CONSULTANT RELATIONSHIP MANAGEMENT =====

// Get all boss-consultant relationships
admin.get('/boss-relationships', async (c) => {
  const relationships = await c.env.DB.prepare(`
    SELECT 
      bcr.*,
      b.name as boss_name,
      b.email as boss_email,
      c.name as consultant_name,
      c.email as consultant_email
    FROM boss_consultant_relationships bcr
    JOIN users b ON bcr.boss_id = b.id
    JOIN users c ON bcr.consultant_id = c.id
    ORDER BY bcr.created_at DESC
  `).all();
  
  return c.json({ relationships: relationships.results });
});

// Get relationships for a specific consultant
admin.get('/consultants/:consultantId/bosses', async (c) => {
  const consultantId = c.req.param('consultantId');
  
  const relationships = await c.env.DB.prepare(`
    SELECT 
      bcr.*,
      b.name as boss_name,
      b.email as boss_email
    FROM boss_consultant_relationships bcr
    JOIN users b ON bcr.boss_id = b.id
    WHERE bcr.consultant_id = ? AND bcr.active = 1
    ORDER BY bcr.created_at DESC
  `).bind(consultantId).all();
  
  return c.json({ relationships: relationships.results });
});

// Get relationships for a specific boss
admin.get('/bosses/:bossId/consultants', async (c) => {
  const bossId = c.req.param('bossId');
  
  const relationships = await c.env.DB.prepare(`
    SELECT 
      bcr.*,
      c.name as consultant_name,
      c.email as consultant_email
    FROM boss_consultant_relationships bcr
    JOIN users c ON bcr.consultant_id = c.id
    WHERE bcr.boss_id = ? AND bcr.active = 1
    ORDER BY bcr.created_at DESC
  `).bind(bossId).all();
  
  return c.json({ relationships: relationships.results });
});

// Create boss-consultant relationship
admin.post('/boss-relationships', async (c) => {
  try {
    const { boss_id, consultant_id, project_name } = await c.req.json();

    if (!boss_id || !consultant_id) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Verify boss and consultant exist and have correct roles
    const boss = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ? AND role = ? AND active = 1'
    ).bind(boss_id, 'boss').first();

    const consultant = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ? AND role = ? AND active = 1'
    ).bind(consultant_id, 'consultant').first();

    if (!boss) {
      return c.json({ error: 'Boss not found or invalid role' }, 400);
    }

    if (!consultant) {
      return c.json({ error: 'Consultant not found or invalid role' }, 400);
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO boss_consultant_relationships (boss_id, consultant_id, project_name) VALUES (?, ?, ?)'
    ).bind(boss_id, consultant_id, project_name || null).run();

    return c.json({ message: 'Relationship created', relationshipId: result.meta.last_row_id });
  } catch (error: any) {
    console.error('Create relationship error:', error);
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'This relationship already exists' }, 400);
    }
    return c.json({ error: 'Failed to create relationship' }, 500);
  }
});

// Update boss-consultant relationship
admin.put('/boss-relationships/:id', async (c) => {
  const id = c.req.param('id');
  const { project_name, active } = await c.req.json();

  await c.env.DB.prepare(
    'UPDATE boss_consultant_relationships SET project_name = ?, active = ? WHERE id = ?'
  ).bind(project_name || null, active, id).run();

  return c.json({ message: 'Relationship updated' });
});

// Delete boss-consultant relationship
admin.delete('/boss-relationships/:id', async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM boss_consultant_relationships WHERE id = ?').bind(id).run();
  
  return c.json({ message: 'Relationship deleted' });
});

// ===== REPORTING =====

// Get progress report
admin.get('/reports/progress', async (c) => {
  const report = await c.env.DB.prepare(`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.role,
      COUNT(DISTINCT up.level_id) as levels_completed,
      us.total_points,
      us.current_login_streak,
      l.rank,
      l.league
    FROM users u
    LEFT JOIN user_progress up ON u.id = up.user_id AND up.status = 'completed'
    LEFT JOIN user_streaks us ON u.id = us.user_id
    LEFT JOIN leaderboard l ON u.id = l.user_id
    WHERE u.role = 'consultant' AND u.active = 1
    GROUP BY u.id
    ORDER BY levels_completed DESC, us.total_points DESC
  `).all();
  
  return c.json({ report: report.results });
});

// Get completion rates
admin.get('/reports/completion', async (c) => {
  const stats = await c.env.DB.prepare(`
    SELECT 
      l.id,
      l.title,
      COUNT(DISTINCT up.user_id) as users_completed,
      (SELECT COUNT(*) FROM users WHERE role = 'consultant' AND active = 1) as total_users,
      ROUND(COUNT(DISTINCT up.user_id) * 100.0 / 
        (SELECT COUNT(*) FROM users WHERE role = 'consultant' AND active = 1), 2) as completion_rate
    FROM levels l
    LEFT JOIN user_progress up ON l.id = up.level_id AND up.status = 'completed'
    WHERE l.active = 1
    GROUP BY l.id
    ORDER BY l.order_index
  `).all();
  
  return c.json({ stats: stats.results });
});

export default admin;
