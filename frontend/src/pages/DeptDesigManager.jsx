import React, { useEffect, useState } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import { useAlert } from '../components/AlertProvider';
import Table from '../components/Table';

function DeptDesigManager() {
    const { showAlert } = useAlert();
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [newDept, setNewDept] = useState('');
    const [newDesig, setNewDesig] = useState('');
    const [newAbbr, setNewAbbr] = useState('');
    const [loadingDept, setLoadingDept] = useState(false);
    const [loadingDesig, setLoadingDesig] = useState(false);

    useEffect(() => {
        fetchDepartments();
        fetchDesignations();
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

    const handleAddDept = async (e) => {
        e.preventDefault();
        if (!newDept.trim()) return;
        try {
            const res = await axios.post('/attendance/add_department', { dept: newDept ,  dept_abbr: newAbbr});
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

    return (
        <PageWrapper title="Department & Designation Manager">
            <div className="row g-4">
                <div className="col-md-6">
                    <div className="p-4 rounded-4 bg-light border">
                        <h5 className="mb-3 text-c-primary fw-bold">Departments</h5>
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
                            <small className="text-muted">
                                The abbreviation is used in reports and quick references (e.g., MECHANICAL ENGINEERING → MECH).
                            </small>
                        </form>

                        {loadingDept ? (
                            <div className="text-center py-3">
                                <div className="spinner-border text-c-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <Table
                                columns={['dept',]}
                                data={departments}
                            />
                        )}
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="p-4 rounded-4 bg-light border">
                        <h5 className="mb-3 text-c-primary fw-bold">Designations</h5>
                        <form className="mb-3 d-flex gap-2" onSubmit={handleAddDesig}>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Add new designation"
                                value={newDesig}
                                onChange={e => setNewDesig(e.target.value)}
                                required
                            />
                            <button className="btn btn-c-primary" type="submit" disabled={loadingDesig}>
                                Add
                            </button>
                        </form>
                        {loadingDesig ? (
                            <div className="text-center py-3">
                                <div className="spinner-border text-c-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <Table
                                columns={['designation',]}
                                data={designations}
                            />
                        )}
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
}

export default DeptDesigManager;
