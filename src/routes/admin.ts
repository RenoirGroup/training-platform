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
    const { email, password, name, role, boss_id, division, region, location, title } = await c.req.json();

    // Validate required fields
    if (!email || !password || !name || !role) {
      return c.json({ error: 'Missing required fields: email, password, name, and role are required' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Validate password length (minimum 6 characters)
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters long' }, 400);
    }

    // Check if email already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json({ error: 'A user with this email already exists' }, 409);
    }

    const passwordHash = await hashPassword(password);

    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, name, role, boss_id, division, region, location, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(email, passwordHash, name, role, boss_id || null, division || null, region || null, location || null, title || null).run();

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

    return c.json({ message: 'User created successfully', userId });
  } catch (error: any) {
    console.error('Create user error:', error);
    
    // Provide specific error messages
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'A user with this email already exists' }, 409);
    }
    
    return c.json({ error: `Failed to create user: ${error.message || 'Unknown error'}` }, 500);
  }
});

// Update user
admin.put('/users/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, email, role, boss_id, active, password, division, region, location, title } = await c.req.json();

    // Validate email format
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return c.json({ error: 'Invalid email format' }, 400);
      }
    }

    // If password is provided, validate and hash it
    if (password) {
      // Validate password length (minimum 6 characters)
      if (password.length < 6) {
        return c.json({ error: 'Password must be at least 6 characters long' }, 400);
      }
      
      const passwordHash = await hashPassword(password);
      await c.env.DB.prepare(
        'UPDATE users SET name = ?, email = ?, role = ?, boss_id = ?, active = ?, password_hash = ?, division = ?, region = ?, location = ?, title = ? WHERE id = ?'
      ).bind(name, email, role, boss_id || null, active !== undefined ? active : 1, passwordHash, division || null, region || null, location || null, title || null, id).run();
    } else {
      // Update without changing password
      await c.env.DB.prepare(
        'UPDATE users SET name = ?, email = ?, role = ?, boss_id = ?, active = ?, division = ?, region = ?, location = ?, title = ? WHERE id = ?'
      ).bind(name, email, role, boss_id || null, active !== undefined ? active : 1, division || null, region || null, location || null, title || null, id).run();
    }

    return c.json({ message: 'User updated successfully' });
  } catch (error: any) {
    console.error('Update user error:', error);
    
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'A user with this email already exists' }, 409);
    }
    
    return c.json({ error: `Failed to update user: ${error.message || 'Unknown error'}` }, 500);
  }
});

// Delete user
admin.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  
  return c.json({ message: 'User deleted' });
});

// Bulk upload users from CSV
admin.post('/users/bulk-upload', async (c) => {
  try {
    const { users, cohort_id } = await c.req.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return c.json({ error: 'Invalid data: users array is required' }, 400);
    }

    const results = {
      success: [],
      errors: [],
      total: users.length
    };

    const defaultPassword = 'Welcome123!'; // Users must change on first login
    const hashedDefaultPassword = await hashPassword(defaultPassword);

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const rowNum = i + 2; // CSV row number (accounting for header)

      try {
        // Validate required fields
        if (!user.name || !user.email) {
          results.errors.push({
            row: rowNum,
            email: user.email || 'N/A',
            error: 'Missing required fields (name and email are required)'
          });
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email)) {
          results.errors.push({
            row: rowNum,
            email: user.email,
            error: 'Invalid email format'
          });
          continue;
        }

        // Check if user already exists
        const existingUser = await c.env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(user.email).first();

        let userId;

        if (existingUser) {
          // Update existing user
          userId = (existingUser as any).id;
          
          await c.env.DB.prepare(`
            UPDATE users 
            SET name = ?, 
                role = ?, 
                division = ?, 
                region = ?, 
                location = ?, 
                title = ?
            WHERE id = ?
          `).bind(
            user.name,
            user.role || 'consultant',
            user.division || null,
            user.region || null,
            user.location || null,
            user.title || null,
            userId
          ).run();

          results.success.push({
            row: rowNum,
            email: user.email,
            name: user.name,
            action: 'updated'
          });
        } else {
          // Create new user
          const result = await c.env.DB.prepare(`
            INSERT INTO users (email, password, name, role, division, region, location, title, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).bind(
            user.email,
            hashedDefaultPassword,
            user.name,
            user.role || 'consultant',
            user.division || null,
            user.region || null,
            user.location || null,
            user.title || null
          ).run();

          userId = result.meta.last_row_id;

          results.success.push({
            row: rowNum,
            email: user.email,
            name: user.name,
            action: 'created'
          });
        }

        // Add to cohort if cohort_id provided
        if (cohort_id && userId) {
          await c.env.DB.prepare(`
            INSERT OR IGNORE INTO cohort_members (cohort_id, user_id)
            VALUES (?, ?)
          `).bind(cohort_id, userId).run();
        }

      } catch (error: any) {
        console.error(`Error processing user at row ${rowNum}:`, error);
        results.errors.push({
          row: rowNum,
          email: user.email || 'N/A',
          error: error.message || 'Unknown error'
        });
      }
    }

    return c.json({
      message: 'Bulk upload completed',
      results,
      default_password: defaultPassword
    });

  } catch (error: any) {
    console.error('Error in bulk upload:', error);
    return c.json({ 
      error: 'Bulk upload failed', 
      details: error.message 
    }, 500);
  }
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

  // Get the current question to find its test_id and current order
  const currentQuestion = await c.env.DB.prepare(
    'SELECT test_id, order_index FROM questions WHERE id = ?'
  ).bind(id).first();

  if (!currentQuestion) {
    return c.json({ error: 'Question not found' }, 404);
  }

  const oldOrder = currentQuestion.order_index as number;
  const newOrder = order_index;
  const testId = currentQuestion.test_id;

  // If order changed, reorder other questions
  if (oldOrder !== newOrder) {
    if (newOrder < oldOrder) {
      // Moving up: increment order of questions between new and old position
      await c.env.DB.prepare(
        'UPDATE questions SET order_index = order_index + 1 WHERE test_id = ? AND order_index >= ? AND order_index < ? AND id != ?'
      ).bind(testId, newOrder, oldOrder, id).run();
    } else {
      // Moving down: decrement order of questions between old and new position
      await c.env.DB.prepare(
        'UPDATE questions SET order_index = order_index - 1 WHERE test_id = ? AND order_index > ? AND order_index <= ? AND id != ?'
      ).bind(testId, oldOrder, newOrder, id).run();
    }
  }

  // Update the question
  await c.env.DB.prepare(
    'UPDATE questions SET question_text = ?, question_type = ?, order_index = ?, points = ?, answer_data = ? WHERE id = ?'
  ).bind(question_text, question_type, newOrder, points, answer_data || null, id).run();

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

// ===== PATHWAY ASSIGNMENT =====

// Assign consultant to pathway
admin.post('/pathways/:pathwayId/assign', async (c) => {
  try {
    const pathwayId = c.req.param('pathwayId');
    const { user_id } = await c.req.json();

    console.log('[ASSIGN] Starting assignment:', { pathwayId, user_id });

    if (!user_id) {
      console.log('[ASSIGN] Error: Missing user_id');
      return c.json({ error: 'User ID is required' }, 400);
    }

    // Check if ANY enrollment exists (regardless of status)
    console.log('[ASSIGN] Checking for existing enrollment...');
    const existing = await c.env.DB.prepare(
      'SELECT id, status FROM pathway_enrollments WHERE user_id = ? AND pathway_id = ?'
    ).bind(user_id, pathwayId).first();

    // Get enrolled_by user ID (may be null)
    const currentUser = c.get('user');
    const enrolledBy = currentUser?.userId || null;
    console.log('[ASSIGN] Enrolled by:', enrolledBy);

    if (existing) {
      console.log('[ASSIGN] Found existing enrollment with status:', existing.status);
      
      if (existing.status === 'approved') {
        console.log('[ASSIGN] User already approved for this pathway');
        return c.json({ error: 'User already enrolled in this pathway' }, 409);
      }
      
      // Update existing enrollment to approved
      console.log('[ASSIGN] Updating existing enrollment to approved...');
      await c.env.DB.prepare(
        'UPDATE pathway_enrollments SET status = ?, requested_at = datetime(\'now\'), enrolled_by = ? WHERE id = ?'
      ).bind('approved', enrolledBy, existing.id).run();
    } else {
      // Create new enrollment
      console.log('[ASSIGN] Creating new enrollment...');
      await c.env.DB.prepare(
        'INSERT INTO pathway_enrollments (user_id, pathway_id, status, requested_at, enrolled_by) VALUES (?, ?, ?, datetime(\'now\'), ?)'
      ).bind(user_id, pathwayId, 'approved', enrolledBy).run();
    }

    console.log('[ASSIGN] Enrollment created successfully');

    // Unlock first level of pathway
    console.log('[ASSIGN] Getting first level...');
    const firstLevel = await c.env.DB.prepare(
      'SELECT level_id FROM pathway_levels WHERE pathway_id = ? ORDER BY order_index LIMIT 1'
    ).bind(pathwayId).first();

    if (firstLevel) {
      console.log('[ASSIGN] Unlocking first level:', firstLevel.level_id);
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO user_progress (user_id, level_id, status, pathway_id) VALUES (?, ?, ?, ?)'
      ).bind(user_id, firstLevel.level_id, 'unlocked', pathwayId).run();
      console.log('[ASSIGN] First level unlocked');
    } else {
      console.log('[ASSIGN] No levels found for this pathway');
    }

    console.log('[ASSIGN] Assignment complete!');
    return c.json({ message: 'User assigned to pathway successfully' });
  } catch (error: any) {
    console.error('[ASSIGN] Error:', error);
    console.error('[ASSIGN] Error stack:', error.stack);
    return c.json({ 
      error: 'Failed to assign pathway', 
      details: error.message,
      stack: error.stack 
    }, 500);
  }
});

// Remove user from pathway
admin.delete('/pathways/:pathwayId/assign/:userId', async (c) => {
  try {
    const pathwayId = c.req.param('pathwayId');
    const userId = c.req.param('userId');

    await c.env.DB.prepare(
      'DELETE FROM pathway_enrollments WHERE user_id = ? AND pathway_id = ?'
    ).bind(userId, pathwayId).run();

    return c.json({ message: 'User removed from pathway' });
  } catch (error: any) {
    console.error('Remove pathway assignment error:', error);
    return c.json({ error: 'Failed to remove assignment', details: error.message }, 500);
  }
});

// Get consultants for pathway assignment (filtered by division/region if manager)
admin.get('/pathways/:pathwayId/available-consultants', async (c) => {
  try {
    const pathwayId = c.req.param('pathwayId');
    const currentUser = c.var.user;

    let query = `
      SELECT 
        u.id, u.name, u.email, u.division, u.region, u.location, u.title,
        pe.id as enrollment_id, pe.status as enrollment_status
      FROM users u
      LEFT JOIN pathway_enrollments pe ON u.id = pe.consultant_id AND pe.pathway_id = ?
      WHERE u.role = 'consultant' AND u.active = 1
    `;

    const bindings: any[] = [pathwayId];

    // Filter by hierarchy
    if (currentUser.role === 'business_unit_manager') {
      query += ' AND u.division = ?';
      bindings.push(currentUser.division);
    } else if (currentUser.role === 'region_manager') {
      query += ' AND u.region = ?';
      bindings.push(currentUser.region);
    } else if (currentUser.role === 'boss') {
      query += ` AND u.id IN (
        SELECT consultant_id FROM boss_consultant_relationships 
        WHERE boss_id = ? AND active = 1
      )`;
      bindings.push(currentUser.id);
    }

    query += ' ORDER BY u.name';

    const result = await c.env.DB.prepare(query).bind(...bindings).all();

    return c.json({ consultants: result.results });
  } catch (error: any) {
    console.error('Get available consultants error:', error);
    return c.json({ error: 'Failed to fetch consultants' }, 500);
  }
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
