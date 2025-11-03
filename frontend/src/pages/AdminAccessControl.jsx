import React, { useEffect, useState } from 'react';
import axios from '../axios';
import { useAlert } from '../components/AlertProvider';

const AdminAccessControl = () => {
    const [activeTab, setActiveTab] = useState('pages'); // 'pages', 'roles', or 'users'
    const [pages, setPages] = useState([]);
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPage, setEditingPage] = useState(null);
    const [editingRole, setEditingRole] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [isAddingNewRole, setIsAddingNewRole] = useState(false);
    const [formData, setFormData] = useState({
        page_name: '',
        page_route: '',
        allowed_roles: [1],
        description: ''
    });
    const [roleFormData, setRoleFormData] = useState({
        role_id: '',
        role_name: '',
        role_description: '',
        default_redirect: '',
    role_color: 'var(--color-4)'
    });
    const [searchTerm, setSearchTerm] = useState('');
    const { showAlert } = useAlert();

    useEffect(() => {
        fetchPages();
        fetchRoles();
        fetchUsers();
    }, []);

    const fetchPages = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/page-access/pages');
            if (response.data.success) {
                setPages(response.data.pages);
            }
        } catch (error) {
            console.error('Error fetching pages:', error);
            showAlert('Failed to fetch pages', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await axios.get('/access-roles/');
            if (response.data.success) {
                const mappedRoles = response.data.roles.map(role => ({
                    value: role.role_id,
                    label: role.role_name,
                    description: role.role_description,
                    default_redirect: role.default_redirect || '',
                    role_color: role.role_color || 'var(--color-4)'
                }));
                setRoles(mappedRoles);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/access-roles/users/list');
            if (response.data.success) {
                setUsers(response.data.users);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // Page management functions
    const handleEdit = (page) => {
        setEditingPage(page.id);
        const allowedRoles = typeof page.allowed_roles === 'string'
            ? JSON.parse(page.allowed_roles)
            : page.allowed_roles;
        setFormData({
            page_name: page.page_name,
            page_route: page.page_route,
            allowed_roles: allowedRoles,
            description: page.description || ''
        });
        setIsAddingNew(false);
    };

    const handleCancelEdit = () => {
        setEditingPage(null);
        setIsAddingNew(false);
        setFormData({
            page_name: '',
            page_route: '',
            allowed_roles: [1],
            description: ''
        });
    };

    const handleSave = async (pageId) => {
        try {
            const response = await axios.put(`/page-access/pages/${pageId}`, formData);
            if (response.data.success) {
                showAlert('Page access updated successfully', 'success');
                fetchPages();
                handleCancelEdit();
            }
        } catch (error) {
            console.error('Error updating page:', error);
            showAlert(error.response?.data?.message || 'Failed to update page', 'error');
        }
    };

    const handleAddNew = () => {
        setIsAddingNew(true);
        setEditingPage(null);
        setFormData({
            page_name: '',
            page_route: '',
            allowed_roles: [1],
            description: ''
        });
    };

    const handleRoleToggle = (roleValue) => {
        const currentRoles = [...formData.allowed_roles];
        if (currentRoles.includes(roleValue)) {
            setFormData({
                ...formData,
                allowed_roles: currentRoles.filter(r => r !== roleValue)
            });
        } else {
            setFormData({
                ...formData,
                allowed_roles: [...currentRoles, roleValue]
            });
        }
    };

    const getRolesDisplay = (allowedRoles) => {
        const rolesArray = typeof allowedRoles === 'string'
            ? JSON.parse(allowedRoles)
            : allowedRoles;

        return rolesArray.map(roleValue => {
            const role = roles.find(r => r.value === roleValue);
            const color = role?.role_color || 'var(--color-4)';
            return (
                <span key={roleValue} className={`badge me-1`} style={{ backgroundColor: color, color: 'var(--color-6)' }}>
                    {role ? role.label : `Role ${roleValue}`}
                </span>
            );
        });
    };

    const handleCreateNew = async () => {
        try {
            const response = await axios.post('/page-access/pages', formData);
            if (response.data.success) {
                showAlert('Page added successfully', 'success');
                fetchPages();
                handleCancelEdit();
            }
        } catch (error) {
            console.error('Error creating page:', error);
            showAlert(error.response?.data?.message || 'Failed to add page', 'error');
        }
    };

    const handleDelete = async (pageId, pageName) => {
        if (!window.confirm(`Are you sure you want to delete "${pageName}"?`)) {
            return;
        }

        try {
            const response = await axios.delete(`/page-access/pages/${pageId}`);
            if (response.data.success) {
                showAlert('Page deleted successfully', 'success');
                fetchPages();
            }
        } catch (error) {
            console.error('Error deleting page:', error);
            showAlert(error.response?.data?.message || 'Failed to delete page', 'error');
        }
    };

    const getRoleLabel = (roleValue) => {
        const role = roles.find(r => r.value === roleValue);
        return role ? role.label : `Role ${roleValue}`;
    };

    const getRoleByValue = (val) => roles.find(r => r.value === val);

    // Role Management Functions
    const handleAddNewRole = () => {
        setIsAddingNewRole(true);
        setEditingRole(null);
        setRoleFormData({
            role_id: '',
            role_name: '',
            role_description: '',
            default_redirect: '',
            role_color: 'var(--color-4)'
        });
    };

    const handleEditRole = (role) => {
        setEditingRole(role.role_id);
        setRoleFormData({
            role_id: role.role_id,
            role_name: role.role_name,
            role_description: role.role_description || '',
            default_redirect: role.default_redirect || '',
            role_color: role.role_color || 'var(--color-4)'
        });
        setIsAddingNewRole(false);
    };

    const handleCancelRoleEdit = () => {
        setEditingRole(null);
        setIsAddingNewRole(false);
        setRoleFormData({
            role_id: '',
            role_name: '',
            role_description: '',
            default_redirect: '',
            role_color: 'var(--color-4)'
        });
    };

    const handleSaveRole = async (roleId) => {
        try {
            const response = await axios.put(`/access-roles/${roleId}`, {
                role_name: roleFormData.role_name,
                role_description: roleFormData.role_description,
                default_redirect: roleFormData.default_redirect,
                role_color: roleFormData.role_color
            });
            if (response.data.success) {
                showAlert('Role updated successfully', 'success');
                fetchRoles();
                fetchPages();
                fetchUsers();
                handleCancelRoleEdit();
            }
        } catch (error) {
            console.error('Error updating role:', error);
            showAlert(error.response?.data?.message || 'Failed to update role', 'error');
        }
    };

    const handleCreateNewRole = async () => {
        try {
            const response = await axios.post('/access-roles', roleFormData);
            if (response.data.success) {
                showAlert('Role created successfully', 'success');
                fetchRoles();
                handleCancelRoleEdit();
            }
        } catch (error) {
            console.error('Error creating role:', error);
            showAlert(error.response?.data?.message || 'Failed to create role', 'error');
        }
    };

    const handleDeleteRole = async (roleId, roleName) => {
        if (!window.confirm(`Are you sure you want to delete "${roleName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await axios.delete(`/access-roles/${roleId}`);
            if (response.data.success) {
                showAlert('Role deleted successfully', 'success');
                fetchRoles();
                fetchPages();
                fetchUsers();
            }
        } catch (error) {
            console.error('Error deleting role:', error);
            showAlert(error.response?.data?.message || 'Failed to delete role', 'error');
        }
    };

    // User Role Management Functions
    const handleEditUserRole = (user) => {
        setEditingUser(user.staff_id);
    };

    const handleCancelUserEdit = () => {
        setEditingUser(null);
    };

    const handleUpdateUserRole = async (staffId, newRoleId) => {
        try {
            const response = await axios.put(`/access-roles/users/${staffId}/role`, {
                access_role: newRoleId
            });
            if (response.data.success) {
                showAlert('User role updated successfully', 'success');
                fetchUsers();
                setEditingUser(null);
            }
        } catch (error) {
            console.error('Error updating user role:', error);
            showAlert(error.response?.data?.message || 'Failed to update user role', 'error');
        }
    };

    // Filters and pagination for Users
    const [filterDept, setFilterDept] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const uniqueDepartments = Array.from(new Set(users.map(u => u.department).filter(Boolean))).sort();

    const filteredUsersAll = users.filter(user => {
        const matchesSearch = (
            user.staff_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(user.staff_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.department?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesDept = filterDept ? user.department === filterDept : true;
        const matchesRole = filterRole ? String(user.access_role) === String(filterRole) : true;
        return matchesSearch && matchesDept && matchesRole;
    });

    const totalPages = Math.max(1, Math.ceil(filteredUsersAll.length / pageSize));
    const currentPageSafe = Math.min(currentPage, totalPages);
    const startIdx = (currentPageSafe - 1) * pageSize;
    const paginatedUsers = filteredUsersAll.slice(startIdx, startIdx + pageSize);

    if (loading) {
        return (
            <div className="container mt-4">
                <div className="text-center">
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mt-4">
            <h2 className="mb-4">Access Control Management</h2>

            {/* Tabs */}
            <ul className="nav nav-tabs mb-4">
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === 'pages' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pages')}
                    >
                        <i className="bi bi-file-earmark-text me-2"></i>
                        Page Access
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === 'roles' ? 'active' : ''}`}
                        onClick={() => setActiveTab('roles')}
                    >
                        <i className="bi bi-shield-check me-2"></i>
                        Access Roles
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        <i className="bi bi-people me-2"></i>
                        User Roles
                    </button>
                </li>
            </ul>

            {/* Pages Tab - Keep existing implementation */}
            {activeTab === 'pages' && (
                <>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h4>Manage Page Access</h4>
                        <button
                            className="btn btn-success"
                            onClick={handleAddNew}
                            disabled={isAddingNew}
                        >
                            <i className="bi bi-plus-circle me-2"></i>
                            Add New Page
                        </button>
                    </div>

                    <div className="card">
                        <div className="card-body">
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '20%' }}>Page Name</th>
                                            <th style={{ width: '20%' }}>Route</th>
                                            <th style={{ width: '25%' }}>Allowed Roles</th>
                                            <th style={{ width: '25%' }}>Description</th>
                                            <th style={{ width: '10%' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isAddingNew && (
                                            <tr className="table-active">
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={formData.page_name}
                                                        onChange={(e) => setFormData({ ...formData, page_name: e.target.value })}
                                                        placeholder="Page Name"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={formData.page_route}
                                                        onChange={(e) => setFormData({ ...formData, page_route: e.target.value })}
                                                        placeholder="/route"
                                                    />
                                                </td>
                                                <td>
                                                    <div className="d-flex flex-wrap gap-2">
                                                        {roles.map(role => (
                                                            <div key={role.value} className="form-check form-check-inline">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    id={`new-role-${role.value}`}
                                                                    checked={formData.allowed_roles.includes(role.value)}
                                                                    onChange={() => handleRoleToggle(role.value)}
                                                                />
                                                                <label className="form-check-label" htmlFor={`new-role-${role.value}`}>
                                                                    <small>{role.label}</small>
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={formData.description}
                                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                        placeholder="Description"
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-success btn-sm me-1"
                                                        onClick={handleCreateNew}
                                                        title="Save"
                                                    >
                                                        <i className="bi bi-check-lg"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={handleCancelEdit}
                                                        title="Cancel"
                                                    >
                                                        <i className="bi bi-x-lg"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        {pages.map((page) => (
                                            <tr key={page.id}>
                                                {editingPage === page.id ? (
                                                    <>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={formData.page_name}
                                                                onChange={(e) => setFormData({ ...formData, page_name: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={formData.page_route}
                                                                onChange={(e) => setFormData({ ...formData, page_route: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {roles.map(role => (
                                                                    <div key={role.value} className="form-check form-check-inline">
                                                                        <input
                                                                            className="form-check-input"
                                                                            type="checkbox"
                                                                            id={`edit-role-${role.value}-${page.id}`}
                                                                            checked={formData.allowed_roles.includes(role.value)}
                                                                            onChange={() => handleRoleToggle(role.value)}
                                                                        />
                                                                        <label className="form-check-label" htmlFor={`edit-role-${role.value}-${page.id}`}>
                                                                            <small>{role.label}</small>
                                                                        </label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={formData.description}
                                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-success btn-sm me-1"
                                                                onClick={() => handleSave(page.id)}
                                                                title="Save"
                                                            >
                                                                <i className="bi bi-check-lg"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={handleCancelEdit}
                                                                title="Cancel"
                                                            >
                                                                <i className="bi bi-x-lg"></i>
                                                            </button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td><strong>{page.page_name}</strong></td>
                                                        <td><code>{page.page_route}</code></td>
                                                        <td>{getRolesDisplay(page.allowed_roles)}</td>
                                                        <td><small className="text-muted">{page.description}</small></td>
                                                        <td>
                                                            <button
                                                                className="btn btn-primary btn-sm me-1"
                                                                onClick={() => handleEdit(page)}
                                                                title="Edit"
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                onClick={() => handleDelete(page.id, page.page_name)}
                                                                title="Delete"
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="card mt-4">
                        <div className="card-body">
                            <h5 className="card-title">Access Role Legend</h5>
                            <div className="row">
                                {roles.map(role => (
                                    <div key={role.value} className="col-md-4 mb-2">
                                        <span className="badge" style={{ fontSize: '0.9rem', backgroundColor: role.role_color, color: 'var(--color-6)' }}>
                                            {role.label}
                                        </span>
                                        <small className="text-muted ms-2">{role.description}</small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
                <>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h4>Manage Access Roles</h4>
                        <button
                            className="btn btn-success"
                            onClick={handleAddNewRole}
                            disabled={isAddingNewRole}
                        >
                            <i className="bi bi-plus-circle me-2"></i>
                            Add New Role
                        </button>
                    </div>

                    <div className="card">
                        <div className="card-body">
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '10%' }}>Role ID</th>
                                            <th style={{ width: '20%' }}>Role Name</th>
                                            <th style={{ width: '35%' }}>Description</th>
                                            <th style={{ width: '20%' }}>Default Redirect</th>
                                            <th style={{ width: '10%' }}>Color</th>
                                            <th style={{ width: '5%' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isAddingNewRole && (
                                            <tr className="table-active">
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="form-control form-control-sm"
                                                        value={roleFormData.role_id}
                                                        onChange={(e) => setRoleFormData({ ...roleFormData, role_id: e.target.value })}
                                                        placeholder="Role ID (0-999)"
                                                        min="0"
                                                        max="999"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={roleFormData.role_name}
                                                        onChange={(e) => setRoleFormData({ ...roleFormData, role_name: e.target.value })}
                                                        placeholder="Role Name"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={roleFormData.role_description}
                                                        onChange={(e) => setRoleFormData({ ...roleFormData, role_description: e.target.value })}
                                                        placeholder="Description"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={roleFormData.default_redirect}
                                                        onChange={(e) => setRoleFormData({ ...roleFormData, default_redirect: e.target.value })}
                                                        placeholder="/default-route"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="color"
                                                        className="form-control form-control-sm form-control-color"
                                                        value={roleFormData.role_color}
                                                        onChange={(e) => setRoleFormData({ ...roleFormData, role_color: e.target.value })}
                                                        title="Choose role color"
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-success btn-sm me-1"
                                                        onClick={handleCreateNewRole}
                                                        title="Save"
                                                    >
                                                        <i className="bi bi-check-lg"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={handleCancelRoleEdit}
                                                        title="Cancel"
                                                    >
                                                        <i className="bi bi-x-lg"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        {roles.map((role) => (
                                            <tr key={role.value}>
                                                {editingRole === role.value ? (
                                                    <>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-control form-control-sm"
                                                                value={roleFormData.role_id}
                                                                disabled
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={roleFormData.role_name}
                                                                onChange={(e) => setRoleFormData({ ...roleFormData, role_name: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={roleFormData.role_description}
                                                                onChange={(e) => setRoleFormData({ ...roleFormData, role_description: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={roleFormData.default_redirect}
                                                                onChange={(e) => setRoleFormData({ ...roleFormData, default_redirect: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="color"
                                                                className="form-control form-control-sm form-control-color"
                                                                value={roleFormData.role_color}
                                                                onChange={(e) => setRoleFormData({ ...roleFormData, role_color: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-success btn-sm me-1"
                                                                onClick={() => handleSaveRole(role.value)}
                                                                title="Save"
                                                            >
                                                                <i className="bi bi-check-lg"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={handleCancelRoleEdit}
                                                                title="Cancel"
                                                            >
                                                                <i className="bi bi-x-lg"></i>
                                                            </button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td>
                                                            <span className="badge" style={{ backgroundColor: role.role_color, color: 'var(--color-6)' }}>
                                                                {role.value}
                                                            </span>
                                                        </td>
                                                        <td><strong>{role.label}</strong></td>
                                                        <td>{role.description}</td>
                                                        <td><code>{role.default_redirect || '-'}</code></td>
                                                        <td>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="badge" style={{ backgroundColor: role.role_color, color: 'var(--color-6)' }}>
                                                                    {role.role_color}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-primary btn-sm me-1"
                                                                onClick={() => handleEditRole({
                                                                    role_id: role.value,
                                                                    role_name: role.label,
                                                                    role_description: role.description,
                                                                    default_redirect: role.default_redirect,
                                                                    role_color: role.role_color
                                                                })}
                                                                title="Edit"
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                onClick={() => handleDeleteRole(role.value, role.label)}
                                                                title="Delete"
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <>
                    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                        <h4>Manage User Roles</h4>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <div className="input-group" style={{ width: '260px' }}>
                                <span className="input-group-text">
                                    <i className="bi bi-search"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                />
                            </div>
                            <select className="form-select" style={{ minWidth: '180px' }} value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setCurrentPage(1); }}>
                                <option value="">All Departments</option>
                                {uniqueDepartments.map(dep => (
                                    <option key={dep} value={dep}>{dep}</option>
                                ))}
                            </select>
                            <select className="form-select" style={{ minWidth: '160px' }} value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setCurrentPage(1); }}>
                                <option value="">All Roles</option>
                                {roles.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                            <select className="form-select" style={{ minWidth: '120px' }} value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}>
                                <option value={10}>10 / page</option>
                                <option value={25}>25 / page</option>
                                <option value={50}>50 / page</option>
                            </select>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body">
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '15%' }}>Staff ID</th>
                                            <th style={{ width: '25%' }}>Name</th>
                                            <th style={{ width: '20%' }}>Email</th>
                                            <th style={{ width: '15%' }}>Department</th>
                                            <th style={{ width: '15%' }}>Current Role</th>
                                            <th style={{ width: '10%' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center text-muted">
                                                    No users found
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedUsers.map((user) => (
                                                <tr key={user.staff_id}>
                                                    <td><code>{user.staff_id}</code></td>
                                                    <td><strong>{user.staff_name}</strong></td>
                                                    <td><small>{user.email}</small></td>
                                                    <td><small>{user.department}</small></td>
                                                    <td>
                                                        {editingUser === user.staff_id ? (
                                                            <select
                                                                className="form-select form-select-sm"
                                                                defaultValue={user.access_role}
                                                                onChange={(e) => handleUpdateUserRole(user.staff_id, parseInt(e.target.value))}
                                                                autoFocus
                                                            >
                                                                {roles.map(role => (
                                                                    <option key={role.value} value={role.value}>
                                                                        {role.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <span className="badge" style={{ backgroundColor: getRoleByValue(user.access_role)?.role_color || 'var(--color-4)', color: 'var(--color-6)' }}>
                                                                {user.role_name || getRoleLabel(user.access_role)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {editingUser === user.staff_id ? (
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={handleCancelUserEdit}
                                                                title="Cancel"
                                                            >
                                                                <i className="bi bi-x-lg"></i>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => handleEditUserRole(user)}
                                                                title="Change Role"
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mt-3">
                                <small className="text-muted">Showing {paginatedUsers.length === 0 ? 0 : (startIdx + 1)}-{Math.min(startIdx + pageSize, filteredUsersAll.length)} of {filteredUsersAll.length} users</small>
                                <nav>
                                    <ul className="pagination pagination-sm mb-0">
                                        <li className={`page-item ${currentPageSafe === 1 ? 'disabled' : ''}`}>
                                            <button className="page-link" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</button>
                                        </li>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPageSafe - 3), currentPageSafe + 2).map(p => (
                                            <li key={p} className={`page-item ${p === currentPageSafe ? 'active' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(p)}>{p}</button>
                                            </li>
                                        ))}
                                        <li className={`page-item ${currentPageSafe === totalPages ? 'disabled' : ''}`}>
                                            <button className="page-link" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</button>
                                        </li>
                                    </ul>
                                </nav>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminAccessControl;
