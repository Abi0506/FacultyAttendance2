import React, { useState, useEffect } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import { useAlert } from '../components/AlertProvider';

function UserManager() {
  const { showAlert } = useAlert();
  const Departments = ['CSE', 'ECE', 'MECH', 'ADMIN', 'LIBRARY'];
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [addUser, setAddUser] = useState({
    id: '',
    name: '',
    dept: '',
    designation: '',
    email: '',
  });
  const [editUser, setEditUser] = useState(null);
  const [editSearchId, setEditSearchId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [staff, setStaff] = useState([]); // State for staff list
  const [staffLoading, setStaffLoading] = useState(false); // Loading state for staff
  const [showStaffTable, setShowStaffTable] = useState(false); // Toggle table visibility

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/attendance/categories');
        if (res.data.success) setCategories(res.data.categories);
        else showAlert('Failed to fetch categories', 'error');
      } catch (err) {
        console.error(err);
        showAlert('Error fetching categories', 'danger');
      }
    };
    fetchCategories();
  }, []);

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await axios.get('/attendance/staff');
      console.log('Fetched staff response:', res.data); // Debug log for email autofill
      if (res.data.success) {
        setStaff(res.data.staff);
        setStaffLoading(false);
      } else {
        showAlert('Failed to fetch staff', 'error');
      }
    } catch (error) {
      showAlert('Failed to fetch staff', 'error');
      console.error("Error fetching staff:", error);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleToggleStaffTable = () => {
    if (!showStaffTable && staff.length === 0) {
      fetchStaff(); // Fetch data only on first toggle
    }
    setShowStaffTable(!showStaffTable);
  };

  const formatTime = (timeStr) => {
    if (timeStr === '0' || !timeStr) return '—';
    const [hh, mm] = timeStr.split(':');
    return `${hh}:${mm}`;
  };

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    setSelectedCategory(val);
    setAddUser((prev) => ({ ...prev, dept: '' }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addUser.email)) {
      showAlert('Invalid email format', 'danger');
      return;
    }

    const payload = {
      ...addUser,
      category: Number(selectedCategory),
    };

    setLoading(true);
    try {
      const res = await axios.post('/essl/add_user', payload);
      if (res.data.success) {
        showAlert(res.data.message, 'success');
        setAddUser({ id: '', name: '', dept: '', designation: '', email: '' });
        setSelectedCategory('');
        if (showStaffTable) {
          // Refresh staff list if table is visible
          await fetchStaff();
        }
      }
    } catch (err) {
      showAlert('Add user failed', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchEditUser = async () => {
    if (!editSearchId.trim()) {
      showAlert('Please enter a Staff ID', 'danger');
      return;
    }
    try {
      const res = await axios.get(`/attendance/get_user/${editSearchId}`);
      console.log('Fetched user response:', res.data); // Debug full response
      if (res.data.success) {
        const user = res.data.user;
        const newEditUser = {
          id: user.staff_id || '',
          name: user.name || '',
          dept: user.dept || '',
          email: user.email || '',
          designation: user.designation || '',
          category: user.category ? user.category.toString() : '',
        };
        setEditUser(newEditUser);
        console.log('Set editUser state:', newEditUser); // Debug state after setting
      } else {
        showAlert(res.data.message || 'User not found', 'danger');
        setEditUser(null);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      showAlert('Fetch user failed', 'danger');
      setEditUser(null);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUser.email)) {
      showAlert('Invalid email format', 'danger');
      return;
    }

    const payload = {
      id: editUser.id,
      name: editUser.name,
      dept: editUser.dept,
      email: editUser.email || null,
      designation: editUser.designation,
      email: editUser.email,
      category: Number(editUser.category),
    };

    setEditLoading(true);
    try {
      const res = await axios.post('/essl/edit_user', payload);
      if (res.data.success) {
        showAlert(res.data.message, 'success');
        setEditUser(null);
        setEditSearchId('');
        if (showStaffTable) {
          // Refresh staff list if table is visible
          await fetchStaff();
        }
      } else {
        showAlert(res.data.message || 'Update failed', 'danger');
      }
    } catch (err) {
      console.error(err);
      showAlert('Update failed', 'danger');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (e) => {
    e.preventDefault();
    setLoading1(true);
    try {
      const res = await axios.post('/essl/delete_user', { id: deleteId });
      showAlert(res.data.message, 'success');
      setDeleteId('');
      if (showStaffTable) {
        // Refresh staff list if table is visible
        await fetchStaff();
      }
    } catch (err) {
      showAlert('User deletion failed', 'danger');
    } finally {
      setLoading1(false);
    }
  };

  return (
    <PageWrapper title="User Manager">
      {/* View Staff */}
      <div className="mb-5 p-4 rounded-4 bg-light border">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="text-c-primary fw-bold mb-0">View Staff</h4>
          <button
            className="btn btn-c-primary"
            onClick={handleToggleStaffTable}
          >
            {showStaffTable ? 'Hide Staff' : 'View Staff'}
          </button>
        </div>
        {showStaffTable && (
          <>
            {staffLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-c-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : staff.length === 0 ? (
              <p className="text-muted text-center py-3">No staff found.</p>
            ) : (
              <div className="table-responsive rounded-3">
                <table className="table table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Staff ID</th>
                      <th>Name</th>
                      <th>Dept</th>
                      <th>Designation</th>
                      <th>Email</th>
                      <th>Category</th>
                      <th>Category Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => (
                      <tr key={member.staff_id}>
                        <td>{member.staff_id}</td>
                        <td>{member.name || '—'}</td>
                        <td>{member.dept || '—'}</td>
                        <td>{member.designation || '—'}</td>
                        <td>{member.email || '—'}</td>
                        <td>{member.category || '—'}</td>
                        <td>{member.category_description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add User */}
      <div className="mb-5 p-4 rounded-4 bg-light border">
        <h4 className="mb-4 text-c-primary fw-bold">Add User</h4>
        <form onSubmit={handleAddUser}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Staff ID</label>
              <input
                type="text"
                className="form-control"
                value={addUser.id}
                onChange={(e) => setAddUser({ ...addUser, id: e.target.value })}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-control"
                value={addUser.name}
                onChange={(e) => setAddUser({ ...addUser, name: e.target.value })}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={addUser.email}
                onChange={(e) => setAddUser({ ...addUser, email: e.target.value })}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={handleCategoryChange}
                required
              >
                <option value="">Choose Category</option>
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat.category_no}>
                    {cat.category_no} - {cat.category_description} - {formatTime(cat.in_time)} -{' '}
                    {formatTime(cat.break_in)} - {formatTime(cat.break_out)} -{' '}
                    {formatTime(cat.out_time)} - {cat.break_time_mins}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Designation</label>
              <select
                className="form-select"
                value={addUser.designation}
                onChange={(e) => setAddUser({ ...addUser, designation: e.target.value })}
                required
              >
                <option value="">Choose Designation</option>
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Professor">Professor</option>
                <option value="HOD">HOD</option>
                <option value="HR">HR</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={addUser.dept}
                onChange={(e) => setAddUser({ ...addUser, dept: e.target.value })}
                required
              >
                <option value="">Choose Department</option>
                {Departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" className="btn btn-c-primary px-5" disabled={loading}>
              {loading ? 'Adding...' : 'Add User'}
            </button>
          </div>
        </form>
      </div>

      {/* Edit User */}
      <div className="mb-5 p-4 rounded-3 bg-light border">
        <h4 className="mb-3 text-c-primary fw-bold">Edit User</h4>
        <div className="mb-3 d-flex gap-2">
          <input
            className="form-control"
            placeholder="Enter Staff ID"
            value={editSearchId}
            onChange={(e) => setEditSearchId(e.target.value)}
          />
          <button className="btn btn-outline-primary" onClick={handleSearchEditUser}>
            Search
          </button>
        </div>
        {editUser ? (
          <form onSubmit={handleEditUser}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editUser.name ?? ''}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={editUser.email || ''}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Designation</label>
                <select className="form-select" value={editUser.designation ?? ''} onChange={(e) => setEditUser({ ...editUser, designation: e.target.value })} required>
                  <option value="">Choose Designation</option>
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Professor">Professor</option>
                  <option value="HOD">HOD</option>
                  <option value="HR">HR</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={editUser.dept}
                  onChange={(e) => setEditUser({ ...editUser, dept: e.target.value })}
                  required
                >
                  <option value="">Choose Department</option>
                  {Departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input
                  type="text"
                  className="form-control"
                  value={editUser.email ?? ''}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value || null })}
                  placeholder="Email (optional)"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Category</label>
                <select className="form-select" value={editUser.category ?? ''} onChange={(e) => setEditUser({ ...editUser, category: e.target.value })} required>
                  <option value="">Choose Category</option>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat.category_no}>
                      {cat.category_no} - {cat.category_description} - {formatTime(cat.in_time)} -{' '}
                      {formatTime(cat.break_in)} - {formatTime(cat.break_out)} -{' '}
                      {formatTime(cat.out_time)} - {cat.break_time_mins}
                    </option>
                  ))}
                </select>
                <p>
                  <a href="/categories">Click here</a> to add a new category
                </p>
              </div>
            </div>
            <div className="mt-4">
              <button type="submit" className="btn btn-c-primary px-5" disabled={editLoading}>
                {editLoading ? 'Editing...' : 'Edit User'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-muted">No user selected for editing.</p>
        )}
      </div>

      {/* Delete User */}
      <div className="mb-5 p-4 rounded-3 bg-light border">
        <h4 className="text-c-primary mb-3 fw-bold">Delete User</h4>
        <form onSubmit={handleDeleteUser}>
          <div className="mb-2">
            <input
              type="text"
              className="form-control"
              placeholder="Staff ID (e.g., S123)"
              value={deleteId}
              onChange={(e) => setDeleteId(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-c-secondary" type="submit" disabled={loading1}>
            {loading1 ? 'Deleting...' : 'Delete User'}
          </button>
        </form>
      </div>

    </PageWrapper >
  );
}

export default UserManager;