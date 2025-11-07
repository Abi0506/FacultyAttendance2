import React, { useEffect, useState } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import { useAlert } from '../components/AlertProvider';
import Table from '../components/Table';

function DeptDesigManager() {
    const { showAlert } = useAlert();
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [hodList, setHodList] = useState([]);
    const [newDept, setNewDept] = useState('');
    const [newDesig, setNewDesig] = useState('');
    const [newAbbr, setNewAbbr] = useState('');
    const [loadingDept, setLoadingDept] = useState(false);
    const [loadingDesig, setLoadingDesig] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [editDeptForm, setEditDeptForm] = useState({ dept: '', dept_abbr: '' });
    const [deptSearch, setDeptSearch] = useState('');
    const [desigSearch, setDesigSearch] = useState('');

    useEffect(() => {
        fetchDepartments();
        fetchDesignations();
        fetchHodList();
    }, []);

    const fetchDepartments = async () => {
        setLoadingDept(true);
        try {
            const res = await axios.post('/attendance/department');
            if (res.data.success) setDepartments(res.data.departments);
            else showAlert('Failed to fetch departments', 'error');
        } catch (err) {
            showAlert('Error fetching departments', 'danger');
        } finally {
            setLoadingDept(false);
        }
    };

    const fetchDesignations = async () => {
        setLoadingDesig(true);
        try {
            const res = await axios.post('/attendance/designation');
            if (res.data.success) setDesignations(res.data.designations);
            else showAlert('Failed to fetch designations', 'error');
        } catch (err) {
            showAlert('Error fetching designations', 'danger');
        } finally {
            setLoadingDesig(false);
        }
    };

    const fetchHodList = async () => {
        try {
            const res = await axios.get('/attendance/hod_list');
            if (res.data.success) setHodList(res.data.hods);
        } catch (err) {
            console.error('Error fetching HOD list:', err);
        }
    };

    const handleUpdateDepartment = async (oldDept) => {
        if (!editDeptForm.dept.trim()) {
            showAlert('Department name cannot be empty', 'danger');
            return;
        }

        try {
            const res = await axios.post('/attendance/update_department', {
                oldDept,
                newDept: editDeptForm.dept,
                newAbbr: editDeptForm.dept_abbr
            });

            if (res.data.success) {
                showAlert('Department updated successfully', 'success');
                setEditingRow(null);
                setEditDeptForm({ dept: '', dept_abbr: '' });
                fetchDepartments();
            } else {
                showAlert(res.data.message || 'Failed to update department', 'danger');
            }
        } catch (err) {
            showAlert(err.response?.data?.message || 'Error updating department', 'danger');
        }
    };

    const handleAddDept = async (e) => {
        e.preventDefault();
        if (!newDept.trim()) return;
        try {
            const res = await axios.post('/attendance/add_department', { dept: newDept });
            if (res.data.success) {
                showAlert('Department added', 'success');
                setNewDept('');
                fetchDepartments();
            } else {
                showAlert(res.data.message || 'Failed to add department', 'danger');
            }
        } catch (err) {
            showAlert('Error adding department', 'danger');
        }
    };

    const handleAddDesig = async (e) => {
        e.preventDefault();
        if (!newDesig.trim()) return;
        try {
            const res = await axios.post('/attendance/add_designation', { designation: newDesig });
            if (res.data.success) {
                showAlert('Designation added', 'success');
                setNewDesig('');
                fetchDesignations();
            } else {
                showAlert(res.data.message || 'Failed to add designation', 'danger');
            }
        } catch (err) {
            showAlert('Error adding designation', 'danger');
        }
    };

    const handleHodChange = async (department, hodId) => {
        try {
            const res = await axios.post('/attendance/update_department_hod', {
                department,
                hod_id: hodId
            });
            if (res.data.success) {
                showAlert('HOD assignment updated', 'success');
                fetchDepartments();
                setEditingRow(null);
            } else {
                showAlert(res.data.message || 'Failed to update HOD', 'danger');
            }
        } catch (err) {
            showAlert('Error updating HOD assignment', 'danger');
        }
    };

    return (
        <PageWrapper title="Department & Designation Manager">
            <div className="row g-4">
                <div className="col-md-6">
                    <div className="p-4 rounded-4 bg-light border">
                        <h5 className="mb-3 text-c-primary fw-bold">Departments</h5>
                        <div className="p-3 mb-4 rounded-4 bg-white border">
                            <h6>Add Department</h6>

                            <form className="mb-3 d-flex flex-column gap-2" onSubmit={handleAddDept}>
                                <div className="d-flex gap-2">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Department name"
                                        value={newDept}
                                        onChange={e => setNewDept(e.target.value)}
                                        required
                                    />
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Abbreviation (e.g., MECH)"
                                        value={newAbbr}
                                        onChange={e => setNewAbbr(e.target.value)}
                                        required
                                    />
                                    <button className="btn btn-c-primary" type="submit" disabled={loadingDept}>
                                        Add
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="mb-3">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search departments..."
                                value={deptSearch}
                                onChange={e => setDeptSearch(e.target.value)}
                            />
                        </div>

                        {loadingDept ? (
                            <div className="text-center py-3">
                                <div className="spinner-border text-c-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Department</th>
                                            <th>Abbreviation</th>
                                            <th>HOD</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {departments.filter(dept =>
                                            dept.dept.toLowerCase().includes(deptSearch.toLowerCase()) ||
                                            (dept.dept_abbr && dept.dept_abbr.toLowerCase().includes(deptSearch.toLowerCase()))
                                        ).map((dept) => (
                                            <tr key={dept.dept}>
                                                <td>
                                                    {editingRow === dept.dept ? (
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm"
                                                            value={editDeptForm.dept}
                                                            onChange={(e) => setEditDeptForm(prev => ({
                                                                ...prev,
                                                                dept: e.target.value
                                                            }))}
                                                            placeholder="Department Name"
                                                        />
                                                    ) : (
                                                        dept.dept
                                                    )}
                                                </td>
                                                <td>
                                                    {editingRow === dept.dept ? (
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm"
                                                            value={editDeptForm.dept_abbr}
                                                            onChange={(e) => setEditDeptForm(prev => ({
                                                                ...prev,
                                                                dept_abbr: e.target.value
                                                            }))}
                                                            placeholder="Abbreviation"
                                                        />
                                                    ) : (
                                                        dept.dept_abbr || '-'
                                                    )}
                                                </td>
                                                <td>
                                                    {editingRow === dept.dept ? (
                                                        <select
                                                            className="form-select form-select-sm"
                                                            defaultValue={dept.hods.length > 0 ? dept.hods[0].staff_id : ''}
                                                            onChange={(e) => handleHodChange(dept.dept, e.target.value)}
                                                        >
                                                            <option value="">-- No HOD --</option>
                                                            {hodList.map((staff) => (
                                                                <option key={staff.staff_id} value={staff.staff_id}>
                                                                    {staff.name} ({staff.staff_id}) - {staff.dept}
                                                                    {staff.access_role === 5 ? ' [Current HOD]' : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span>
                                                            {dept.hods.length > 0
                                                                ? `${dept.hods[0].name} (${dept.hods[0].staff_id})`
                                                                : <span className="text-muted">Not assigned</span>
                                                            }
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="btn-group">
                                                        {editingRow === dept.dept ? (
                                                            <>
                                                                <button
                                                                    className="btn btn-sm btn-c-outline-primary"
                                                                    onClick={() => handleUpdateDepartment(dept.dept)}
                                                                >
                                                                    <i className="bi bi-check-lg"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-c-outline-secondary"
                                                                    onClick={() => {
                                                                        setEditingRow(null);
                                                                        setEditDeptForm({ dept: '', dept_abbr: '' });
                                                                    }}
                                                                >
                                                                    <i className='bi bi-x-lg'></i>
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                className="btn btn-sm btn-outline-primary"
                                                                onClick={() => {
                                                                    setEditingRow(dept.dept);
                                                                    setEditDeptForm({
                                                                        dept: dept.dept,
                                                                        dept_abbr: dept.dept_abbr || ''
                                                                    });
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="p-4 rounded-4 bg-light border">
                        <h5 className="mb-3 text-c-primary fw-bold">Designations</h5>
                        <div className="p-3 mb-4 rounded-4 bg-white border">
                            <h6>Add Designation</h6>
                            <form className="mb-0 d-flex gap-2" onSubmit={handleAddDesig}>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Designation name"
                                    value={newDesig}
                                    onChange={e => setNewDesig(e.target.value)}
                                    required
                                />
                                <button className="btn btn-c-primary" type="submit" disabled={loadingDesig}>
                                    Add
                                </button>
                            </form>
                        </div>

                        <div className="mb-3">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search designations..."
                                value={desigSearch}
                                onChange={e => setDesigSearch(e.target.value)}
                            />
                        </div>

                        {loadingDesig ? (
                            <div className="text-center py-3">
                                <div className="spinner-border text-c-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <Table
                                columns={['designation',]}
                                data={designations.filter(desig =>
                                    desig.designation.toLowerCase().includes(desigSearch.toLowerCase())
                                )}
                            />
                        )}
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
}

export default DeptDesigManager;
