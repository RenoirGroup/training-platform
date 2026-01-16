import { Hono } from 'hono'

type Bindings = {
  DB: D1Database;
}

const cohorts = new Hono<{ Bindings: Bindings }>()

// ============================================
// ADMIN COHORT MANAGEMENT ENDPOINTS
// ============================================

// Get all cohorts
cohorts.get('/admin/cohorts', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  try {
    // Get cohorts with member counts and pathway counts
    const cohorts = await c.env.DB.prepare(`
      SELECT 
        cg.id,
        cg.name,
        cg.description,
        cg.manager_id,
        cg.created_at,
        cg.updated_at,
        cg.active,
        u.name as manager_name,
        COUNT(DISTINCT cm.user_id) as member_count,
        COUNT(DISTINCT cp.pathway_id) as pathway_count
      FROM cohort_groups cg
      LEFT JOIN users u ON cg.manager_id = u.id
      LEFT JOIN cohort_members cm ON cg.id = cm.cohort_id AND 1=1
      LEFT JOIN cohort_pathways cp ON cg.id = cp.cohort_id AND cp.active = 1
      WHERE cg.active = 1
      GROUP BY cg.id
      ORDER BY cg.name
    `).all()

    return c.json({ cohorts: cohorts.results })
  } catch (error: any) {
    console.error('Error fetching cohorts:', error)
    return c.json({ error: 'Failed to fetch cohorts', details: error.message }, 500)
  }
})

// Get single cohort with details
cohorts.get('/admin/cohorts/:id', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')

  try {
    // Get cohort details
    const cohort = await c.env.DB.prepare(`
      SELECT 
        cg.*,
        u.name as manager_name,
        u.email as manager_email
      FROM cohort_groups cg
      LEFT JOIN users u ON cg.manager_id = u.id
      WHERE cg.id = ? AND cg.active = 1
    `).bind(cohortId).first()

    if (!cohort) {
      return c.json({ error: 'Cohort not found' }, 404)
    }

    // Get members
    const members = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.division,
        u.region,
        cm.joined_at
      FROM cohort_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.cohort_id = ? AND 1=1
      ORDER BY u.name
    `).bind(cohortId).all()

    // Get assigned pathways with deadlines
    const pathways = await c.env.DB.prepare(`
      SELECT 
        p.id,
        p.title,
        p.description,
        p.icon,
        p.color_primary,
        cp.deadline,
        cp.assigned_at,
        u.name as assigned_by_name
      FROM cohort_pathways cp
      JOIN pathways p ON cp.pathway_id = p.id
      LEFT JOIN users u ON cp.assigned_by = u.id
      WHERE cp.cohort_id = ? AND cp.active = 1
      ORDER BY p.title
    `).bind(cohortId).all()

    return c.json({
      cohort,
      members: members.results,
      pathways: pathways.results
    })
  } catch (error: any) {
    console.error('Error fetching cohort details:', error)
    return c.json({ error: 'Failed to fetch cohort details', details: error.message }, 500)
  }
})

// Create new cohort
cohorts.post('/admin/cohorts', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  try {
    const { name, description, manager_id } = await c.req.json()

    if (!name) {
      return c.json({ error: 'Cohort name is required' }, 400)
    }

    // Check if cohort name already exists
    const existing = await c.env.DB.prepare(`
      SELECT id FROM cohort_groups WHERE name = ? AND active = 1
    `).bind(name).first()

    if (existing) {
      return c.json({ error: 'Cohort name already exists' }, 409)
    }

    // Create cohort
    const result = await c.env.DB.prepare(`
      INSERT INTO cohort_groups (name, description, manager_id)
      VALUES (?, ?, ?)
    `).bind(name, description || null, manager_id || null).run()

    return c.json({
      message: 'Cohort created successfully',
      cohort_id: result.meta.last_row_id
    })
  } catch (error: any) {
    console.error('Error creating cohort:', error)
    return c.json({ error: 'Failed to create cohort', details: error.message }, 500)
  }
})

// Update cohort
cohorts.put('/admin/cohorts/:id', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')

  try {
    const { name, description, manager_id } = await c.req.json()

    if (!name) {
      return c.json({ error: 'Cohort name is required' }, 400)
    }

    // Check if cohort exists
    const existing = await c.env.DB.prepare(`
      SELECT id FROM cohort_groups WHERE id = ? AND active = 1
    `).bind(cohortId).first()

    if (!existing) {
      return c.json({ error: 'Cohort not found' }, 404)
    }

    // Check if new name conflicts with another cohort
    const nameConflict = await c.env.DB.prepare(`
      SELECT id FROM cohort_groups WHERE name = ? AND id != ? AND active = 1
    `).bind(name, cohortId).first()

    if (nameConflict) {
      return c.json({ error: 'Cohort name already exists' }, 409)
    }

    // Update cohort
    await c.env.DB.prepare(`
      UPDATE cohort_groups
      SET name = ?, description = ?, manager_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name, description || null, manager_id || null, cohortId).run()

    return c.json({ message: 'Cohort updated successfully' })
  } catch (error: any) {
    console.error('Error updating cohort:', error)
    return c.json({ error: 'Failed to update cohort', details: error.message }, 500)
  }
})

// Delete cohort (soft delete)
cohorts.delete('/admin/cohorts/:id', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')

  try {
    // Don't allow deleting Legacy cohort
    if (cohortId === '1') {
      return c.json({ error: 'Cannot delete Legacy cohort' }, 400)
    }

    // Soft delete cohort
    await c.env.DB.prepare(`
      UPDATE cohort_groups SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(cohortId).run()

    return c.json({ message: 'Cohort deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting cohort:', error)
    return c.json({ error: 'Failed to delete cohort', details: error.message }, 500)
  }
})

// ============================================
// COHORT MEMBER MANAGEMENT
// ============================================

// Add users to cohort
cohorts.post('/admin/cohorts/:id/members', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')

  try {
    const { user_ids } = await c.req.json()

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return c.json({ error: 'user_ids array is required' }, 400)
    }

    // Add members (using INSERT OR IGNORE to handle duplicates)
    for (const userId of user_ids) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO cohort_members (cohort_id, user_id)
        VALUES (?, ?)
      `).bind(cohortId, userId).run()
    }

    return c.json({ message: 'Members added successfully' })
  } catch (error: any) {
    console.error('Error adding members:', error)
    return c.json({ error: 'Failed to add members', details: error.message }, 500)
  }
})

// Remove user from cohort
cohorts.delete('/admin/cohorts/:id/members/:userId', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')
  const userId = c.req.param('userId')

  try {
    // Soft delete member
    await c.env.DB.prepare(`
      UPDATE cohort_members SET active = 0 WHERE cohort_id = ? AND user_id = ?
    `).bind(cohortId, userId).run()

    return c.json({ message: 'Member removed successfully' })
  } catch (error: any) {
    console.error('Error removing member:', error)
    return c.json({ error: 'Failed to remove member', details: error.message }, 500)
  }
})

// ============================================
// COHORT PATHWAY ASSIGNMENT
// ============================================

// Assign pathway to cohort
cohorts.post('/admin/cohorts/:id/pathways', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')

  try {
    const { pathway_id, deadline } = await c.req.json()

    if (!pathway_id) {
      return c.json({ error: 'pathway_id is required' }, 400)
    }

    // Check if pathway is already assigned
    const existing = await c.env.DB.prepare(`
      SELECT id FROM cohort_pathways 
      WHERE cohort_id = ? AND pathway_id = ? AND active = 1
    `).bind(cohortId, pathway_id).first()

    if (existing) {
      return c.json({ error: 'Pathway already assigned to this cohort' }, 409)
    }

    // Assign pathway
    await c.env.DB.prepare(`
      INSERT INTO cohort_pathways (cohort_id, pathway_id, deadline, assigned_by)
      VALUES (?, ?, ?, ?)
    `).bind(cohortId, pathway_id, deadline || null, user.userId).run()

    // Get all cohort members
    const members = await c.env.DB.prepare(`
      SELECT user_id FROM cohort_members WHERE cohort_id = ? AND active = 1
    `).bind(cohortId).all()

    // Enroll all members in the pathway
    for (const member of members.results as any[]) {
      // Check if already enrolled
      const enrollment = await c.env.DB.prepare(`
        SELECT id FROM pathway_enrollments 
        WHERE user_id = ? AND pathway_id = ? AND cohort_id = ?
      `).bind(member.user_id, pathway_id, cohortId).first()

      if (!enrollment) {
        // Create enrollment
        await c.env.DB.prepare(`
          INSERT INTO pathway_enrollments 
          (user_id, pathway_id, cohort_id, status, requested_at, enrolled_by)
          VALUES (?, ?, ?, 'approved', CURRENT_TIMESTAMP, ?)
        `).bind(member.user_id, pathway_id, cohortId, user.userId).run()

        // Unlock first level
        const firstLevel = await c.env.DB.prepare(`
          SELECT level_id FROM pathway_levels 
          WHERE pathway_id = ? 
          ORDER BY order_index 
          LIMIT 1
        `).bind(pathway_id).first()

        if (firstLevel) {
          await c.env.DB.prepare(`
            INSERT OR IGNORE INTO user_progress 
            (user_id, level_id, pathway_id, cohort_id, status)
            VALUES (?, ?, ?, ?, 'unlocked')
          `).bind(member.user_id, (firstLevel as any).level_id, pathway_id, cohortId).run()
        }
      }
    }

    return c.json({ message: 'Pathway assigned to cohort successfully' })
  } catch (error: any) {
    console.error('Error assigning pathway:', error)
    return c.json({ error: 'Failed to assign pathway', details: error.message }, 500)
  }
})

// Update cohort pathway deadline
cohorts.put('/admin/cohorts/:id/pathways/:pathwayId', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')
  const pathwayId = c.req.param('pathwayId')

  try {
    const { deadline } = await c.req.json()

    await c.env.DB.prepare(`
      UPDATE cohort_pathways
      SET deadline = ?
      WHERE cohort_id = ? AND pathway_id = ?
    `).bind(deadline || null, cohortId, pathwayId).run()

    return c.json({ message: 'Deadline updated successfully' })
  } catch (error: any) {
    console.error('Error updating deadline:', error)
    return c.json({ error: 'Failed to update deadline', details: error.message }, 500)
  }
})

// Remove pathway from cohort
cohorts.delete('/admin/cohorts/:id/pathways/:pathwayId', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')
  const pathwayId = c.req.param('pathwayId')

  try {
    // Soft delete pathway assignment
    await c.env.DB.prepare(`
      UPDATE cohort_pathways SET active = 0 
      WHERE cohort_id = ? AND pathway_id = ?
    `).bind(cohortId, pathwayId).run()

    return c.json({ message: 'Pathway removed from cohort successfully' })
  } catch (error: any) {
    console.error('Error removing pathway:', error)
    return c.json({ error: 'Failed to remove pathway', details: error.message }, 500)
  }
})

// ============================================
// PROGRESS REPORTING
// ============================================

// Get cohort progress for a specific pathway
cohorts.get('/admin/cohorts/:id/pathways/:pathwayId/progress', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'boss') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')
  const pathwayId = c.req.param('pathwayId')

  try {
    // Get pathway details with deadline
    const pathway = await c.env.DB.prepare(`
      SELECT 
        p.*,
        cp.deadline,
        COUNT(DISTINCT pl.level_id) as total_levels
      FROM pathways p
      JOIN cohort_pathways cp ON p.id = cp.pathway_id
      LEFT JOIN pathway_levels pl ON p.id = pl.pathway_id
      WHERE cp.cohort_id = ? AND p.id = ? AND cp.active = 1
      GROUP BY p.id
    `).bind(cohortId, pathwayId).first()

    if (!pathway) {
      return c.json({ error: 'Pathway not found for this cohort' }, 404)
    }

    // Get individual member progress
    const memberProgress = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.division,
        u.region,
        pe.requested_at as enrolled_at,
        COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.level_id END) as completed_levels,
        ROUND(COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.level_id END) * 100.0 / ?, 0) as completion_percentage
      FROM cohort_members cm
      JOIN users u ON cm.user_id = u.id
      LEFT JOIN pathway_enrollments pe ON u.id = pe.user_id AND pe.pathway_id = ? AND pe.cohort_id = ?
      LEFT JOIN user_progress up ON u.id = up.user_id AND up.pathway_id = ? AND up.cohort_id = ?
      WHERE cm.cohort_id = ? AND 1=1
      GROUP BY u.id
      ORDER BY completion_percentage DESC, u.name
    `).bind(
      (pathway as any).total_levels || 1,
      pathwayId,
      cohortId,
      pathwayId,
      cohortId,
      cohortId
    ).all()

    return c.json({
      pathway,
      members: memberProgress.results
    })
  } catch (error: any) {
    console.error('Error fetching cohort progress:', error)
    return c.json({ error: 'Failed to fetch progress', details: error.message }, 500)
  }
})

// Get all cohort progress summary
cohorts.get('/admin/cohorts/:id/progress', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'boss') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const cohortId = c.req.param('id')

  try {
    // Get all pathways assigned to this cohort with progress
    const pathways = await c.env.DB.prepare(`
      SELECT 
        p.id,
        p.title,
        p.icon,
        p.color_primary,
        cp.deadline,
        COUNT(DISTINCT pl.level_id) as total_levels,
        COUNT(DISTINCT cm.user_id) as total_members,
        COUNT(DISTINCT CASE WHEN pe.status = 'approved' THEN pe.user_id END) as enrolled_members,
        COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.user_id END) as completed_members
      FROM cohort_pathways cp
      JOIN pathways p ON cp.pathway_id = p.id
      LEFT JOIN pathway_levels pl ON p.id = pl.pathway_id
      LEFT JOIN cohort_members cm ON cp.cohort_id = cm.cohort_id AND 1=1
      LEFT JOIN pathway_enrollments pe ON cm.user_id = pe.user_id AND p.id = pe.pathway_id AND pe.cohort_id = ?
      LEFT JOIN user_progress up ON cm.user_id = up.user_id AND p.id = up.pathway_id AND up.cohort_id = ?
      WHERE cp.cohort_id = ? AND cp.active = 1
      GROUP BY p.id
      ORDER BY p.title
    `).bind(cohortId, cohortId, cohortId).all()

    return c.json({ pathways: pathways.results })
  } catch (error: any) {
    console.error('Error fetching cohort progress:', error)
    return c.json({ error: 'Failed to fetch progress', details: error.message }, 500)
  }
})

export default cohorts
