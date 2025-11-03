const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Get all pages with their access requirements
router.get('/pages', verifyToken, async (req, res) => {
    try {
        const [pages] = await db.query(
            'SELECT * FROM page_access ORDER BY page_name ASC'
        );
        res.json({ success: true, pages });
    } catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pages' });
    }
});

// Get pages accessible to a specific access role
router.get('/pages/accessible/:accessRole', verifyToken, async (req, res) => {
    try {
        const { accessRole } = req.params;
        // Convert accessRole to JSON string for JSON_CONTAINS
        const roleJson = JSON.stringify(parseInt(accessRole));
        const [pages] = await db.query(
            'SELECT * FROM page_access WHERE JSON_CONTAINS(allowed_roles, ?) ORDER BY page_name ASC',
            [roleJson]
        );
        res.json({ success: true, pages });
    } catch (error) {
        console.error('Error fetching accessible pages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch accessible pages' });
    }
});

// Check if user has access to a specific page
router.post('/check-access', verifyToken, async (req, res) => {
    try {
        const { pageRoute } = req.body;
        const userAccessRole = req.user.access_role || 1;

        const [pages] = await db.query(
            'SELECT * FROM page_access WHERE page_route = ?',
            [pageRoute]
        );

        if (pages.length === 0) {
            // Page not found in database, allow access by default
            return res.json({ success: true, hasAccess: true, message: 'Page not found in access control' });
        }

        const page = pages[0];
        // Handle different formats: already parsed array, string, or JSON string
        let allowedRoles;
        if (Array.isArray(page.allowed_roles)) {
            allowedRoles = page.allowed_roles;
        } else if (typeof page.allowed_roles === 'string') {
            try {
                allowedRoles = JSON.parse(page.allowed_roles);
            } catch (e) {
                console.error('Failed to parse allowed_roles:', page.allowed_roles);
                allowedRoles = [];
            }
        } else {
            allowedRoles = [];
        }

        const hasAccess = allowedRoles.includes(userAccessRole);

        res.json({
            success: true,
            hasAccess,
            userAccessRole,
            allowedRoles: allowedRoles,
            pageName: page.page_name
        });
    } catch (error) {
        console.error('Error checking page access:', error);
        res.status(500).json({ success: false, message: 'Failed to check page access' });
    }
});

// Admin only: Update page access requirements
router.put('/pages/:id', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const { id } = req.params;
        const { page_name, page_route, allowed_roles, description } = req.body;

        // Validate allowed_roles
        if (!Array.isArray(allowed_roles) || allowed_roles.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'allowed_roles must be a non-empty array'
            });
        }

        // Validate each role is between 0 and 10
        const invalidRoles = allowed_roles.filter(role => role < 0 || role > 10);
        if (invalidRoles.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'All access roles must be between 0 and 10'
            });
        }

        const [result] = await db.query(
            `UPDATE page_access 
             SET page_name = ?, page_route = ?, allowed_roles = ?, description = ?
             WHERE id = ?`,
            [page_name, page_route, JSON.stringify(allowed_roles), description, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Page not found' });
        }

        res.json({ success: true, message: 'Page access updated successfully' });
    } catch (error) {
        console.error('Error updating page access:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Page name or route already exists'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to update page access' });
    }
});// Admin only: Add new page
router.post('/pages', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const { page_name, page_route, allowed_roles, description } = req.body;

        // Validate required fields
        if (!page_name || !page_route || !allowed_roles) {
            return res.status(400).json({
                success: false,
                message: 'Page name, route, and allowed roles are required'
            });
        }

        // Validate allowed_roles
        if (!Array.isArray(allowed_roles) || allowed_roles.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'allowed_roles must be a non-empty array'
            });
        }

        // Validate each role is between 0 and 10
        const invalidRoles = allowed_roles.filter(role => role < 0 || role > 10);
        if (invalidRoles.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'All access roles must be between 0 and 10'
            });
        }

        const [result] = await db.query(
            `INSERT INTO page_access (page_name, page_route, allowed_roles, description)
             VALUES (?, ?, ?, ?)`,
            [page_name, page_route, JSON.stringify(allowed_roles), description]
        );

        res.json({
            success: true,
            message: 'Page added successfully',
            pageId: result.insertId
        });
    } catch (error) {
        console.error('Error adding page:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Page name or route already exists'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to add page' });
    }
});

// Admin only: Delete page
router.delete('/pages/:id', verifyToken, authorizeRoles(10), async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query('DELETE FROM page_access WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Page not found' });
        }

        res.json({ success: true, message: 'Page deleted successfully' });
    } catch (error) {
        console.error('Error deleting page:', error);
        res.status(500).json({ success: false, message: 'Failed to delete page' });
    }
});

// Get access role information (now fetches from database)
router.get('/roles', verifyToken, async (req, res) => {
    try {
        const [roles] = await db.query(
            'SELECT role_id as value, role_name as label, role_description as description FROM access_roles ORDER BY role_id ASC'
        );
        res.json({ success: true, roles });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch roles' });
    }
});

module.exports = router;
