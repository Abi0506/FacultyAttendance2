const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Get all access roles
router.get('/', verifyToken, async (req, res) => {
    try {
        const [roles] = await db.query(
            'SELECT * FROM access_roles ORDER BY role_id ASC'
        );
        res.json({ success: true, roles });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch roles' });
    }
});

// Get a specific role by ID
router.get('/:roleId', verifyToken, async (req, res) => {
    try {
        const { roleId } = req.params;
        const [roles] = await db.query(
            'SELECT * FROM access_roles WHERE role_id = ?',
            [roleId]
        );

        if (roles.length === 0) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        res.json({ success: true, role: roles[0] });
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch role' });
    }
});

// Admin only: Create new access role
router.post('/', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const { role_id, role_name, role_description, default_redirect, role_color } = req.body;

        // Validate required fields
        if (role_id === undefined || !role_name) {
            return res.status(400).json({
                success: false,
                message: 'Role ID and name are required'
            });
        }

        // Validate role_id is a number between 0 and 999
        const roleIdNum = parseInt(role_id);
        if (isNaN(roleIdNum) || roleIdNum < 0 || roleIdNum > 999) {
            return res.status(400).json({
                success: false,
                message: 'Role ID must be a number between 0 and 999'
            });
        }

        // Check if role_id already exists
        const [existing] = await db.query(
            'SELECT role_id FROM access_roles WHERE role_id = ?',
            [roleIdNum]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Role ID already exists'
            });
        }

        // Insert new role
        const [result] = await db.query(
            `INSERT INTO access_roles (role_id, role_name, role_description, default_redirect, role_color)
             VALUES (?, ?, ?, ?, ?)`,
            [roleIdNum, role_name, role_description || null, default_redirect || null, role_color || null]
        );

        res.json({
            success: true,
            message: 'Role created successfully',
            role: {
                role_id: roleIdNum,
                role_name,
                role_description,
                default_redirect: default_redirect || null,
                role_color: role_color || null
            }
        });
    } catch (error) {
        console.error('Error creating role:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Role name already exists'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to create role' });
    }
});

// Admin only: Update access role
router.put('/:roleId', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const { roleId } = req.params;
        const { role_name, role_description, default_redirect, role_color } = req.body;

        // Check if role exists
        const [existing] = await db.query(
            'SELECT * FROM access_roles WHERE role_id = ?',
            [roleId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        // Update role (all roles are now editable)
        const [result] = await db.query(
            `UPDATE access_roles 
             SET role_name = ?, role_description = ?, default_redirect = ?, role_color = ?
             WHERE role_id = ?`,
            [
                role_name || existing[0].role_name,
                role_description,
                default_redirect ?? existing[0].default_redirect ?? null,
                role_color ?? existing[0].role_color ?? null,
                roleId
            ]
        );

        res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        console.error('Error updating role:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Role name already exists'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to update role' });
    }
});

// Admin only: Delete access role
router.delete('/:roleId', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const { roleId } = req.params;

        // Check if role exists
        const [existing] = await db.query(
            'SELECT * FROM access_roles WHERE role_id = ?',
            [roleId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        // Check if role is currently in use by any staff
        const [staffCount] = await db.query(
            'SELECT COUNT(*) as count FROM staff WHERE access_role = ?',
            [roleId]
        );

        if (staffCount[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete role: ${staffCount[0].count} staff member(s) currently have this role. Reassign them first.`
            });
        }

        // Check if role is used in any page access rules
        const [pagesWithRole] = await db.query(
            'SELECT COUNT(*) as count FROM page_access WHERE JSON_CONTAINS(allowed_roles, ?)',
            [JSON.stringify(parseInt(roleId))]
        );

        if (pagesWithRole[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete role: It is assigned to ${pagesWithRole[0].count} page(s). Remove it from all pages first.`
            });
        }

        // Delete role
        const [result] = await db.query(
            'DELETE FROM access_roles WHERE role_id = ?',
            [roleId]
        );

        res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ success: false, message: 'Failed to delete role' });
    }
});

// Get all staff with their current roles
router.get('/users/list', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT 
                s.staff_id,
                s.name AS staff_name,
                s.email,
                s.access_role,
                ar.role_name,
                s.designation,
                s.dept AS department
            FROM staff s
            LEFT JOIN access_roles ar ON s.access_role = ar.role_id
            ORDER BY s.name ASC
        `);
        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

// Update user's access role
router.put('/users/:staffId/role', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const { staffId } = req.params;
        const { access_role } = req.body;

        // Validate role exists
        const [roleExists] = await db.query(
            'SELECT role_id FROM access_roles WHERE role_id = ?',
            [access_role]
        );

        if (roleExists.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID'
            });
        }

        // Get current access role before updating
        const [currentUser] = await db.query(
            'SELECT access_role FROM staff WHERE staff_id = ?',
            [staffId]
        );

        if (currentUser.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const oldAccessRole = currentUser[0].access_role;

        // Update user's role
        const [result] = await db.query(
            'UPDATE staff SET access_role = ? WHERE staff_id = ?',
            [access_role, staffId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // If user is being demoted from HOD (5) to any other role, remove all HOD department assignments
        if (oldAccessRole === 5 && access_role !== 5) {
            await db.query(
                'DELETE FROM hod_department_access WHERE staff_id = ?',
                [staffId]
            );
        }

        res.json({ success: true, message: 'User role updated successfully' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ success: false, message: 'Failed to update user role' });
    }
});

// Bulk update user roles
router.post('/users/bulk-update', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const { updates } = req.body; // Array of { staff_id, access_role }

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Updates must be a non-empty array'
            });
        }

        // Start transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            for (const update of updates) {
                await connection.query(
                    'UPDATE staff SET access_role = ? WHERE staff_id = ?',
                    [update.access_role, update.staff_id]
                );
            }

            await connection.commit();
            connection.release();

            res.json({
                success: true,
                message: `Successfully updated ${updates.length} user(s)`
            });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Error bulk updating user roles:', error);
        res.status(500).json({ success: false, message: 'Failed to bulk update user roles' });
    }
});

// Get available roles for dropdowns (formatted for UI)
router.get('/dropdown/options', verifyToken, async (req, res) => {
    try {
        const [roles] = await db.query(
            'SELECT role_id as value, role_name as label, role_description as description FROM access_roles ORDER BY role_id ASC'
        );
        res.json({ success: true, roles });
    } catch (error) {
        console.error('Error fetching role options:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch role options' });
    }
});

module.exports = router;