import React, { useEffect, useState } from 'react';

import {
    BrowserRouter as Router,
    Routes,
    Route,
    Link,
    Navigate,
    useLocation
} from 'react-router-dom';

// --- Page Imports ---
import InstantLogs from './pages/instantLogs';
import AttendanceViewer from './pages/AttendanceViewer';
import DepartmentSummary from './pages/DepartmentSummary';
import IndividualAttendanceTable from './pages/IndividualAttendanceTable';
import IndividualStaffReport from './pages/IndividualStaffReport';
import ExemptionApplyPage from './pages/applyExemption';
import LoginPage from './pages/LoginPage';
import HRExcemptions from './pages/HRExcemptions';
import UserManager from './pages/UserManager';
import CategoryManager from './pages/CategoryManager';
import DeptDesigManager from './pages/DeptDesigManager';
import DevicesManager from './pages/DevicesManager';
import HRLeaveManager from './pages/HRLeaveManager';
import ResetPasswordPage from './pages/ResetPassword';
import DashboardPage from './pages/Dashboard';
import FlaggedRecords from './pages/FlaggedRecords';
import AdminAccessControl from './pages/AdminAccessControl';
import NotFound from './pages/NotFound';
import HODDashboard from './pages/HODDashboard';
// import LeaveManager from './pages/LeaveManager';

// --- Auth & Context Imports ---
import { useAuth, AuthProvider } from './auth/authProvider';
import { AlertProvider } from './components/AlertProvider';
import DynamicNavigation from './components/DynamicNavigation';
import { RequirePageAccess } from './auth/RequireAuth';



// Dynamic redirect component - redirects to first accessible page
function DynamicRedirect({ accessRole }) {
    const [redirectTo, setRedirectTo] = useState(null);

    useEffect(() => {
        const getRedirect = async () => {
            if (!accessRole) {
                setRedirectTo('/login');
                return;
            }

            try {
                const axios = await import('./axios').then(m => m.default);

                // 1) Try role's default redirect if set
                let candidate = null;
                try {
                    const roleRes = await axios.get(`/access-roles/${accessRole}`);
                    const role = roleRes.data?.role;
                    if (role?.default_redirect) {
                        // Verify access to the default route
                        const check = await axios.post('/page-access/check-access', { pageRoute: role.default_redirect });
                        if (check.data?.success && check.data?.hasAccess) {
                            candidate = role.default_redirect;
                        }
                    }
                } catch (e) {
                    // Ignore role fetch errors; we'll fallback
                }

                if (candidate) {
                    setRedirectTo(candidate);
                    return;
                }

                // 2) Fallback to first accessible page
                const response = await axios.get(`/page-access/pages/accessible/${accessRole}`);
                if (response.data.success && response.data.pages.length > 0) {
                    const firstPage = response.data.pages.find(
                        page => page.page_route !== '/login' &&
                            page.page_route !== '/reset-password'
                    );
                    setRedirectTo(firstPage ? firstPage.page_route : '/staffIndividualReport');
                } else {
                    setRedirectTo('/staffIndividualReport');
                }
            } catch (error) {
                console.error('Error fetching redirect page:', error);
                setRedirectTo('/staffIndividualReport');
            }
        };

        getRedirect();
    }, [accessRole]);

    if (!redirectTo) {
        return (
            <div className="container mt-5 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return <Navigate to={redirectTo} replace />;
}

function AppContent() {
    const { isAuthenticated, logout, accessRole } = useAuth();
    const [pendingExemptions, setPendingExemptions] = useState(0);
    const [pendingLeaves, setPendingLeaves] = useState(0);

    // Utility to close navbar on mobile
    const closeNavbar = () => {
        const nav = document.getElementById('navbarNav');
        if (nav && nav.classList.contains('show')) {
            nav.classList.remove('show');
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (isAuthenticated && accessRole === 3) {
                // Fetch pending exemptions
                try {
                    const resExemptions = await import('./axios').then(m => m.default.get('/attendance/hr_exemptions_all'));
                    if (resExemptions.data && Array.isArray(resExemptions.data.exemptions)) {
                        const pendingEx = resExemptions.data.exemptions.filter(e => e.exemptionStatus === 'pending').length;
                        setPendingExemptions(pendingEx);
                    }
                } catch {
                    setPendingExemptions(0);
                }

                // Fetch pending leaves
                try {
                    const resLeaves = await import('./axios').then(m => m.default.get('/leave'));
                    if (resLeaves.data && Array.isArray(resLeaves.data)) {
                        const pendingL = resLeaves.data.filter(l => l.status === 'pending').length;
                        setPendingLeaves(pendingL);
                    }
                } catch {
                    setPendingLeaves(0);
                }
            }
        };

        fetchData();
        window.addEventListener('exemptionStatusChanged', fetchData);

        return () => {
            window.removeEventListener('exemptionStatusChanged', fetchData); //  
        };

    }, [isAuthenticated, accessRole]);




    return (
        <Router>
            <div className="glassy-navbar-wrapper">
                <nav className="navbar navbar-expand-lg glassy-navbar">
                    <div className="container-fluid flex-column p-0">

                        <div className="d-flex align-items-center justify-content-between w-100 px-4">
                            <Link className="navbar-brand d-flex align-items-center fw-bold" to="/" title="Dashboard" onClick={closeNavbar}>
                                <img src="/psgitarlogo.jpg" alt="Logo" className="psgitarlogo me-3" />
                                <span className="header-title float-end">Faculty Biometric Attendance</span>
                            </Link>
                            <button
                                className="navbar-toggler border-0"
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target="#navbarNav"
                            >
                                <span className="navbar-toggler-icon"></span>
                            </button>
                        </div>

                        <div className="collapse navbar-collapse w-100 mt-2 p-3 py-2 shadow-md" id="navbarNav">
                            {isAuthenticated && (
                                <DynamicNavigation
                                    accessRole={accessRole}
                                    pendingExemptions={pendingExemptions}
                                    pendingLeaves={pendingLeaves}
                                    onNavClick={closeNavbar}
                                />
                            )}

                            <div className="ms-auto">
                                {isAuthenticated ? (
                                    <button
                                        className="nav-link d-flex align-items-center btn btn-link"
                                        onClick={() => { closeNavbar(); logout(); }}
                                        title="Logout"
                                    >
                                        <i className="bi bi-box-arrow-right fs-4 me-1" aria-hidden="true"></i>
                                        Logout
                                    </button>
                                ) : (
                                    <Link
                                        className="nav-link d-flex align-items-center"
                                        to="/login"
                                        title="Login"
                                        onClick={closeNavbar}
                                    >
                                        <i className="bi bi-box-arrow-in-right fs-4 me-1" aria-hidden="true"></i>
                                        Login
                                    </Link>
                                )}
                            </div>

                        </div>
                    </div>
                </nav>
            </div>

            <div className="container-lg m-large">
                <Routes>
                    <Route path="/login" element={
                        isAuthenticated ? <DynamicRedirect accessRole={accessRole} /> : <LoginPage />
                    } />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* All routes now use dynamic page access control from database */}

                    {/* Admin Routes */}
                    <Route path="/admin/access-control" element={
                        <RequirePageAccess pageRoute="/admin/access-control">
                            <AdminAccessControl />
                        </RequirePageAccess>
                    } />

                    {/* HR Routes */}
                    <Route path="/view" element={
                        <RequirePageAccess pageRoute="/view">
                            <AttendanceViewer />
                        </RequirePageAccess>
                    } />
                    <Route path="/summary" element={
                        <RequirePageAccess pageRoute="/summary">
                            <DepartmentSummary />
                        </RequirePageAccess>
                    } />
                    <Route path="/individual/:staffId?" element={
                        <RequirePageAccess pageRoute="/individual">
                            <IndividualAttendanceTable />
                        </RequirePageAccess>
                    } />
                    <Route path="/exemptions" element={
                        <RequirePageAccess pageRoute="/exemptions">
                            <HRExcemptions />
                        </RequirePageAccess>
                    } />
                    <Route path="/users" element={
                        <RequirePageAccess pageRoute="/users">
                            <UserManager />
                        </RequirePageAccess>
                    } />
                    <Route path="/categories" element={
                        <RequirePageAccess pageRoute="/categories">
                            <CategoryManager />
                        </RequirePageAccess>
                    } />
                    <Route path="/deptdesig" element={
                        <RequirePageAccess pageRoute="/deptdesig">
                            <DeptDesigManager />
                        </RequirePageAccess>
                    } />
                    <Route path="/devicemanager" element={
                        <RequirePageAccess pageRoute="/devicemanager">
                            <DevicesManager />
                        </RequirePageAccess>
                    } />
                    <Route path="/leave" element={
                        <RequirePageAccess pageRoute="/leave">
                            <HRLeaveManager />
                        </RequirePageAccess>
                    } />
                    <Route path="/instant" element={
                        <RequirePageAccess pageRoute="/instant">
                            <InstantLogs />
                        </RequirePageAccess>
                    } />
                    <Route path="/flags" element={
                        <RequirePageAccess pageRoute="/flags">
                            <FlaggedRecords />
                        </RequirePageAccess>
                    } />

                    {/* Principal Routes */}
                    <Route path="/dashboard" element={
                        <RequirePageAccess pageRoute="/dashboard">
                            <DashboardPage />
                        </RequirePageAccess>
                    } />

                    {/* HOD Routes */}
                    <Route path="/hod-dashboard" element={
                        <RequirePageAccess pageRoute="/hod-dashboard">
                            <HODDashboard />
                        </RequirePageAccess>
                    } />

                    {/* Staff Routes */}
                    <Route path="/staffIndividualReport" element={
                        <RequirePageAccess pageRoute="/staffIndividualReport">
                            <IndividualStaffReport />
                        </RequirePageAccess>
                    } />
                    <Route path="/applyExemption" element={
                        <RequirePageAccess pageRoute="/applyExemption">
                            <ExemptionApplyPage />
                        </RequirePageAccess>
                    } />

                    <Route
                        path="/"
                        element={
                            isAuthenticated
                                ? <DynamicRedirect accessRole={accessRole} />
                                : <Navigate to="/login" replace />
                        }
                    />

                    {/* 404 - Not Found */}
                    <Route path="*" element={<NotFound />} />

                </Routes>
            </div>
        </Router>
    );
}

function App() {
    return (
        <AuthProvider>
            <AlertProvider>
                <AppContent />
            </AlertProvider>
        </AuthProvider>
    );
}

export default App;