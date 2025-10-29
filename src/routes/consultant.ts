import { Hono } from 'hono';
import { authMiddleware, consultantOnly } from '../utils/middleware';
import type { Bindings, JWTPayload } from '../types';

const consultant = new Hono<{ Bindings: Bindings; Variables: { user: JWTPayload } }>();

// Apply authentication middleware
consultant.use('/*', authMiddleware);

// ===== LADDER / PROGRESS =====

// Get ladder (all levels with progress status)
consultant.get('/ladder', async (c) => {
  const user = c.get('user');
  
  const ladder = await c.env.DB.prepare(`
    SELECT 
      l.*,
      up.status,
      up.started_at,
      up.completed_at,
      (SELECT COUNT(*) FROM training_materials WHERE level_id = l.id) as materials_count,
      (SELECT COUNT(*) FROM tests WHERE level_id = l.id) as tests_count,
      (SELECT COUNT(*) FROM boss_level_tasks WHERE level_id = l.id) as tasks_count
    FROM levels l
    LEFT JOIN user_progress up ON l.id = up.level_id AND up.user_id = ?
    WHERE l.active = 1
    ORDER BY l.order_index
  `).bind(user.userId).all();

  return c.json({ ladder: ladder.results });
});

// Get level details with materials
consultant.get('/levels/:levelId', async (c) => {
  const levelId = c.req.param('levelId');
  const user = c.get('user');
  
  // Get level info
  const level = await c.env.DB.prepare(`
    SELECT l.*, up.status
    FROM levels l
    LEFT JOIN user_progress up ON l.id = up.level_id AND up.user_id = ?
    WHERE l.id = ? AND l.active = 1
  `).bind(user.userId, levelId).first();

  if (!level) {
    return c.json({ error: 'Level not found' }, 404);
  }

  // Get training materials
  const materials = await c.env.DB.prepare(
    'SELECT * FROM training_materials WHERE level_id = ? ORDER BY order_index'
  ).bind(levelId).all();

  // Get tests
  const tests = await c.env.DB.prepare(
    'SELECT * FROM tests WHERE level_id = ?'
  ).bind(levelId).all();

  // Get boss level tasks if applicable
  let tasks = null;
  if (level.is_boss_level) {
    const tasksResult = await c.env.DB.prepare(
      'SELECT * FROM boss_level_tasks WHERE level_id = ? ORDER BY order_index'
    ).bind(levelId).all();
    tasks = tasksResult.results;
  }

  return c.json({
    level,
    materials: materials.results,
    tests: tests.results,
    tasks,
  });
});

// Start a level (mark as in_progress)
consultant.post('/levels/:levelId/start', async (c) => {
  const levelId = c.req.param('levelId');
  const user = c.get('user');

  // Check if progress record exists
  const existing = await c.env.DB.prepare(
    'SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?'
  ).bind(user.userId, levelId).first();

  if (!existing) {
    // Check if this is the next level
    const canAccess = await canAccessLevel(c.env.DB, user.userId, parseInt(levelId));
    if (!canAccess) {
      return c.json({ error: 'Cannot access this level yet' }, 403);
    }

    await c.env.DB.prepare(
      'INSERT INTO user_progress (user_id, level_id, status, started_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(user.userId, levelId, 'in_progress').run();
  } else if (existing.status === 'unlocked') {
    await c.env.DB.prepare(
      'UPDATE user_progress SET status = ?, started_at = CURRENT_TIMESTAMP WHERE user_id = ? AND level_id = ?'
    ).bind('in_progress', user.userId, levelId).run();
  }

  return c.json({ message: 'Level started' });
});

// ===== TESTS =====

// Get test with questions (but no correct answers)
consultant.get('/tests/:testId', async (c) => {
  const testId = c.req.param('testId');
  
  const test = await c.env.DB.prepare(
    'SELECT * FROM tests WHERE id = ?'
  ).bind(testId).first();

  if (!test) {
    return c.json({ error: 'Test not found' }, 404);
  }

  // Get questions with options and answer_data (but don't show which options are correct)
  const questions = await c.env.DB.prepare(`
    SELECT q.id, q.question_text, q.question_type, q.order_index, q.points, q.answer_data
    FROM questions q
    WHERE q.test_id = ?
    ORDER BY q.order_index
  `).bind(testId).all();

  // Get options for each question and parse answer_data
  const questionsWithOptions = await Promise.all(
    (questions.results as any[]).map(async (q) => {
      const options = await c.env.DB.prepare(
        'SELECT id, option_text, order_index FROM answer_options WHERE question_id = ? ORDER BY order_index'
      ).bind(q.id).all();
      
      // Parse answer_data for new question types
      let answerData = null;
      if (q.answer_data) {
        answerData = JSON.parse(q.answer_data);
      }
      
      return {
        ...q,
        options: options.results,
        answer_data: answerData,
      };
    })
  );

  return c.json({
    test,
    questions: questionsWithOptions,
  });
});

// Submit test
consultant.post('/tests/:testId/submit', async (c) => {
  const testId = c.req.param('testId');
  const user = c.get('user');
  const { answers } = await c.req.json(); // { questionId: answerOptionId or answerText }

  // Get test info
  const test = await c.env.DB.prepare(
    'SELECT * FROM tests WHERE id = ?'
  ).bind(testId).first();

  if (!test) {
    return c.json({ error: 'Test not found' }, 404);
  }

  // Get all questions
  const questions = await c.env.DB.prepare(
    'SELECT * FROM questions WHERE test_id = ?'
  ).bind(testId).all();

  let totalScore = 0;
  let maxScore = 0;
  const results: any[] = [];

  for (const question of questions.results as any[]) {
    maxScore += question.points;
    const userAnswer = answers[question.id];
    let isCorrect = false;

    switch(question.question_type) {
      case 'multiple_choice':
      case 'true_false':
        // Check if selected option is correct
        const selectedOption = await c.env.DB.prepare(
          'SELECT * FROM answer_options WHERE id = ?'
        ).bind(userAnswer).first();
        isCorrect = selectedOption ? selectedOption.is_correct === 1 : false;
        break;
      
      case 'multiple_response':
        // Get all correct answer IDs
        const correctOptions = await c.env.DB.prepare(
          'SELECT id FROM answer_options WHERE question_id = ? AND is_correct = 1'
        ).bind(question.id).all();
        const correctIds = new Set(correctOptions.results.map((o: any) => o.id.toString()));
        
        // Parse user's selected answers (comes as array)
        const userSelectedIds = new Set(
          Array.isArray(userAnswer) ? userAnswer.map((id: any) => id.toString()) : 
          typeof userAnswer === 'string' ? [userAnswer] : []
        );
        
        // All-or-nothing: must select exactly the correct answers (no more, no less)
        isCorrect = correctIds.size === userSelectedIds.size &&
                    [...correctIds].every(id => userSelectedIds.has(id));
        break;

      case 'open_text':
        // For open text, fuzzy matching (case-insensitive)
        const correctAnswer = await c.env.DB.prepare(
          'SELECT option_text FROM answer_options WHERE question_id = ? AND is_correct = 1'
        ).bind(question.id).first();
        const userText = (userAnswer || '').toString().toLowerCase().trim();
        const correctText = (correctAnswer?.option_text || '').toString().toLowerCase().trim();
        // Check if user answer contains key terms from correct answer
        isCorrect = correctText.split(' ').filter(w => w.length > 3).every(word => 
          userText.includes(word)
        );
        break;

      case 'matching':
        // Parse answer_data and user answer
        const matchingData = JSON.parse(question.answer_data || '{}');
        const userMatches = JSON.parse(userAnswer || '{}');
        
        // Check if all pairs match correctly
        isCorrect = matchingData.pairs && matchingData.pairs.every((pair: any) => 
          userMatches[pair.left] === pair.right
        );
        break;

      case 'fill_blank':
        // Parse answer_data and user answers
        const fillData = JSON.parse(question.answer_data || '{}');
        const userBlanks = JSON.parse(userAnswer || '[]');
        
        // Check all blanks (case-insensitive, trimmed)
        isCorrect = fillData.blanks && fillData.blanks.length === userBlanks.length &&
          fillData.blanks.every((correct: string, idx: number) => 
            correct.toLowerCase().trim() === (userBlanks[idx] || '').toLowerCase().trim()
          );
        break;

      case 'ranking':
        // Parse answer_data and user order
        const rankingData = JSON.parse(question.answer_data || '{}');
        const userOrder = JSON.parse(userAnswer || '[]');
        
        // Check if order matches exactly
        const correctOrder = rankingData.items?.map((item: any) => item.text) || [];
        isCorrect = correctOrder.length === userOrder.length &&
          correctOrder.every((item: string, idx: number) => item === userOrder[idx]);
        break;

      case 'odd_one_out':
        // Parse answer_data and check if user selected the odd one
        const oddData = JSON.parse(question.answer_data || '{}');
        const userSelection = parseInt(userAnswer || '-1');
        isCorrect = userSelection === oddData.oddIndex;
        break;

      case 'hotspot':
        // Parse answer_data and user placements
        const hotspotData = JSON.parse(question.answer_data || '{}');
        const userPlacements = JSON.parse(userAnswer || '[]');
        const tolerance = hotspotData.tolerance || 50; // pixels of tolerance
        
        // Check if all labels are placed within tolerance of correct positions
        isCorrect = hotspotData.placements && userPlacements.length === hotspotData.placements.length &&
          userPlacements.every((userPlacement: any) => {
            const correctPlacement = hotspotData.placements.find((p: any) => p.label === userPlacement.label);
            if (!correctPlacement) return false;
            
            // Check if placement is within tolerance distance of correct position
            const distance = Math.sqrt(
              Math.pow(userPlacement.x - correctPlacement.x, 2) + 
              Math.pow(userPlacement.y - correctPlacement.y, 2)
            );
            return distance <= tolerance;
          });
        break;

      default:
        isCorrect = false;
    }

    const pointsEarned = isCorrect ? question.points : 0;
    totalScore += pointsEarned;

    results.push({
      questionId: question.id,
      isCorrect,
      pointsEarned,
      userAnswer: userAnswer,
      selectedOptionId: question.question_type === 'multiple_choice' || question.question_type === 'true_false' ? userAnswer : null,
    });
  }

  const percentage = (totalScore / maxScore) * 100;
  const passed = percentage >= (test.pass_percentage as number);

  // Save attempt
  const attemptResult = await c.env.DB.prepare(
    'INSERT INTO test_attempts (user_id, test_id, score, max_score, percentage, passed, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
  ).bind(user.userId, testId, totalScore, maxScore, percentage, passed ? 1 : 0).run();

  const attemptId = attemptResult.meta.last_row_id;

  // Save individual answers
  for (const result of results) {
    await c.env.DB.prepare(
      'INSERT INTO user_answers (attempt_id, question_id, answer_option_id, answer_text, is_correct, points_earned) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      attemptId,
      result.questionId,
      result.selectedOptionId || null,
      result.userAnswer || null,
      result.isCorrect ? 1 : 0,
      result.pointsEarned
    ).run();
  }

  // Update test streak
  await updateTestStreak(c.env.DB, user.userId, passed);

  // If passed, check if all tests for this level are passed
  if (passed) {
    const levelId = test.level_id as number;
    const allTestsPassed = await checkAllTestsPassed(c.env.DB, user.userId, levelId);

    if (allTestsPassed) {
      // Check if this is a boss level
      const level = await c.env.DB.prepare(
        'SELECT is_boss_level FROM levels WHERE id = ?'
      ).bind(levelId).first();

      if (level && level.is_boss_level === 1) {
        // Boss level - mark as awaiting signoff
        await c.env.DB.prepare(
          'UPDATE user_progress SET status = ? WHERE user_id = ? AND level_id = ?'
        ).bind('awaiting_signoff', user.userId, levelId).run();
      } else {
        // Regular level - mark as completed and unlock next
        await completeLevel(c.env.DB, user.userId, levelId);
      }
    }

    // Award achievements
    await checkAchievements(c.env.DB, user.userId, {
      testPassed: true,
      perfectScore: percentage === 100,
    });
  }

  return c.json({
    passed,
    score: totalScore,
    maxScore,
    percentage,
    results,
  });
});

// Get test history
consultant.get('/test-history', async (c) => {
  const user = c.get('user');
  
  const attempts = await c.env.DB.prepare(`
    SELECT 
      ta.*,
      t.title as test_title,
      l.title as level_title
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    JOIN levels l ON t.level_id = l.id
    WHERE ta.user_id = ?
    ORDER BY ta.completed_at DESC
    LIMIT 50
  `).bind(user.userId).all();

  return c.json({ attempts: attempts.results });
});

// ===== BOSS LEVEL SIGN-OFFS =====

// Request sign-off for boss level (supports multiple bosses)
consultant.post('/levels/:levelId/request-signoff', async (c) => {
  const levelId = c.req.param('levelId');
  const user = c.get('user');
  const { evidence_notes, evidence_url, boss_id } = await c.req.json();

  // Check if level is a boss level
  const level = await c.env.DB.prepare(
    'SELECT * FROM levels WHERE id = ? AND is_boss_level = 1'
  ).bind(levelId).first();

  if (!level) {
    return c.json({ error: 'Not a boss level' }, 400);
  }

  // Check if all tests passed
  const allPassed = await checkAllTestsPassed(c.env.DB, user.userId, parseInt(levelId));
  if (!allPassed) {
    return c.json({ error: 'Must pass all tests first' }, 400);
  }

  // Get consultant's bosses from many-to-many relationship
  const bosses = await c.env.DB.prepare(`
    SELECT bcr.boss_id, u.name as boss_name, bcr.project_name
    FROM boss_consultant_relationships bcr
    JOIN users u ON bcr.boss_id = u.id
    WHERE bcr.consultant_id = ? AND bcr.active = 1
  `).bind(user.userId).all();

  if (!bosses.results || bosses.results.length === 0) {
    return c.json({ error: 'No boss assigned' }, 400);
  }

  // If boss_id provided, verify it's valid for this consultant
  let targetBossId = boss_id;
  if (targetBossId) {
    const validBoss = bosses.results.find((b: any) => b.boss_id === targetBossId);
    if (!validBoss) {
      return c.json({ error: 'Invalid boss selection' }, 400);
    }
  } else {
    // If no boss specified and consultant has only one boss, use that
    if (bosses.results.length === 1) {
      targetBossId = (bosses.results[0] as any).boss_id;
    } else {
      return c.json({ 
        error: 'Please select a boss',
        bosses: bosses.results 
      }, 400);
    }
  }

  // Create sign-off request
  await c.env.DB.prepare(
    'INSERT INTO signoff_requests (user_id, level_id, boss_id, evidence_notes, evidence_url, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, levelId, targetBossId, evidence_notes || null, evidence_url || null, 'pending').run();

  return c.json({ message: 'Sign-off request submitted' });
});

// Get consultant's bosses
consultant.get('/my-bosses', async (c) => {
  const user = c.get('user');
  
  const bosses = await c.env.DB.prepare(`
    SELECT 
      bcr.boss_id,
      bcr.project_name,
      u.name as boss_name,
      u.email as boss_email
    FROM boss_consultant_relationships bcr
    JOIN users u ON bcr.boss_id = u.id
    WHERE bcr.consultant_id = ? AND bcr.active = 1
    ORDER BY u.name
  `).bind(user.userId).all();

  return c.json({ bosses: bosses.results });
});

// Get sign-off requests
consultant.get('/signoff-requests', async (c) => {
  const user = c.get('user');
  
  const requests = await c.env.DB.prepare(`
    SELECT 
      sr.*,
      l.title as level_title,
      b.name as boss_name
    FROM signoff_requests sr
    JOIN levels l ON sr.level_id = l.id
    JOIN users b ON sr.boss_id = b.id
    WHERE sr.user_id = ?
    ORDER BY sr.requested_at DESC
  `).bind(user.userId).all();

  return c.json({ requests: requests.results });
});

// ===== GAMIFICATION =====

// Get streaks and stats
consultant.get('/stats', async (c) => {
  const user = c.get('user');
  
  const stats = await c.env.DB.prepare(`
    SELECT * FROM user_streaks WHERE user_id = ?
  `).bind(user.userId).first();

  const achievements = await c.env.DB.prepare(`
    SELECT a.*, ua.earned_at
    FROM user_achievements ua
    JOIN achievements a ON ua.achievement_id = a.id
    WHERE ua.user_id = ?
    ORDER BY ua.earned_at DESC
  `).bind(user.userId).all();

  const leaderboard = await c.env.DB.prepare(`
    SELECT * FROM leaderboard WHERE user_id = ?
  `).bind(user.userId).first();

  return c.json({
    streaks: stats,
    achievements: achievements.results,
    leaderboard,
  });
});

// Get leaderboard
consultant.get('/leaderboard', async (c) => {
  const leaderboard = await c.env.DB.prepare(`
    SELECT 
      l.*,
      u.name,
      u.email
    FROM leaderboard l
    JOIN users u ON l.user_id = u.id
    WHERE u.active = 1
    ORDER BY l.total_points DESC, l.rungs_completed DESC
    LIMIT 100
  `).all();

  // Update ranks
  let rank = 1;
  for (const entry of leaderboard.results as any[]) {
    await c.env.DB.prepare(
      'UPDATE leaderboard SET rank = ? WHERE user_id = ?'
    ).bind(rank++, entry.user_id).run();
  }

  return c.json({ leaderboard: leaderboard.results });
});

// ===== HELPER FUNCTIONS =====

async function canAccessLevel(db: D1Database, userId: number, levelId: number): Promise<boolean> {
  const level = await db.prepare(
    'SELECT order_index FROM levels WHERE id = ?'
  ).bind(levelId).first();

  if (!level) return false;

  if (level.order_index === 1) return true;

  // Check if previous level is completed
  const previousLevel = await db.prepare(
    'SELECT id FROM levels WHERE order_index = ? AND active = 1'
  ).bind((level.order_index as number) - 1).first();

  if (!previousLevel) return true;

  const progress = await db.prepare(
    'SELECT status FROM user_progress WHERE user_id = ? AND level_id = ?'
  ).bind(userId, previousLevel.id).first();

  return progress && progress.status === 'completed';
}

async function checkAllTestsPassed(db: D1Database, userId: number, levelId: number): Promise<boolean> {
  const tests = await db.prepare(
    'SELECT id FROM tests WHERE level_id = ?'
  ).bind(levelId).all();

  if (tests.results.length === 0) return true;

  for (const test of tests.results as any[]) {
    const passed = await db.prepare(
      'SELECT id FROM test_attempts WHERE user_id = ? AND test_id = ? AND passed = 1'
    ).bind(userId, test.id).first();

    if (!passed) return false;
  }

  return true;
}

async function completeLevel(db: D1Database, userId: number, levelId: number) {
  // Mark current level as completed
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

  // Check for level-based achievements
  await checkAchievements(db, userId, { levelCompleted: true });
}

async function updateTestStreak(db: D1Database, userId: number, passed: boolean) {
  const today = new Date().toISOString().split('T')[0];
  
  // Log activity
  await db.prepare(
    'INSERT INTO activity_log (user_id, activity_type, activity_date) VALUES (?, ?, ?)'
  ).bind(userId, 'test_attempt', today).run();

  if (!passed) return;

  const streak = await db.prepare(
    'SELECT * FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();

  if (!streak) return;

  const lastTestDate = streak.last_test_date as string | null;
  let newStreak = streak.current_test_streak as number;

  if (lastTestDate === today) {
    // Already tested today
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastTestDate === yesterdayStr) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  const longestStreak = Math.max(newStreak, streak.longest_test_streak as number);
  const newPoints = (streak.total_points as number) + 10;

  await db.prepare(
    'UPDATE user_streaks SET current_test_streak = ?, longest_test_streak = ?, last_test_date = ?, total_points = ? WHERE user_id = ?'
  ).bind(newStreak, longestStreak, today, newPoints, userId).run();
}

async function checkAchievements(db: D1Database, userId: number, context: any) {
  const achievements: string[] = [];

  if (context.testPassed) {
    // Check if first test
    const firstTest = await db.prepare(
      'SELECT COUNT(*) as count FROM test_attempts WHERE user_id = ? AND passed = 1'
    ).bind(userId).first();

    if (firstTest && firstTest.count === 1) {
      achievements.push('first_test');
    }

    if (context.perfectScore) {
      achievements.push('perfect_score');
    }
  }

  if (context.levelCompleted) {
    const levelsCompleted = await db.prepare(
      'SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND status = ?'
    ).bind(userId, 'completed').first();

    const count = levelsCompleted?.count as number || 0;

    if (count === 10) achievements.push('level_10');
    if (count === 25) achievements.push('level_25');
    if (count === 50) achievements.push('level_50');
  }

  // Check streaks
  const streaks = await db.prepare(
    'SELECT * FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();

  if (streaks) {
    if (streaks.current_login_streak === 10) achievements.push('streak_10');
    if (streaks.current_login_streak === 50) achievements.push('streak_50');
    if (streaks.current_login_streak === 100) achievements.push('streak_100');
  }

  // Award achievements
  for (const code of achievements) {
    const achievement = await db.prepare(
      'SELECT id, points FROM achievements WHERE code = ?'
    ).bind(code).first();

    if (!achievement) continue;

    // Check if already earned
    const existing = await db.prepare(
      'SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?'
    ).bind(userId, achievement.id).first();

    if (!existing) {
      await db.prepare(
        'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
      ).bind(userId, achievement.id).run();

      // Add points
      await db.prepare(
        'UPDATE user_streaks SET total_points = total_points + ? WHERE user_id = ?'
      ).bind(achievement.points, userId).run();
    }
  }
}

export default consultant;
