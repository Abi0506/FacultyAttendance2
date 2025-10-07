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
import DevicesManager from './pages/DevicesManager';
import HRLeaveManager from './pages/HRLeaveManager';
import ResetPasswordPage from './pages/ResetPassword';
// import LeaveManager from './pages/LeaveManager';

// --- Auth & Context Imports ---
import { useAuth, AuthProvider } from './auth/authProvider';
import { AlertProvider } from './components/AlertProvider';

// --- Route Guards ---
function RequireHR({ children }) {
    const { isAuthenticated, designation } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    if (designation !== "HR") {
        return <Navigate to="/staffIndividualReport" replace />;
    }
    return children;
}

function RequireStaff({ children }) {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return children;
}


// --- Main Application Content ---
function AppContent() {
    const { isAuthenticated, logout, designation } = useAuth();
    const [pendingExemptions, setPendingExemptions] = useState(0);
    const [pendingLeaves, setPendingLeaves] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            if (isAuthenticated && designation === 'HR') {
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

    }, [isAuthenticated, designation]);



    return (
        <Router>
            <div className="glassy-navbar-wrapper">
                <nav className="navbar navbar-expand-lg glassy-navbar">
                    <div className="container-fluid flex-column p-0">

                        <div className="d-flex align-items-center justify-content-between w-100 px-4">
                            <a className="navbar-brand d-flex align-items-center fw-bold" href="/" title="Dashboard">
                                <img src="/psgitarlogo.jpg" alt="Logo" className="psgitarlogo me-3" />
                                <span className="header-title float-end">Faculty Biometric Attendance</span>
                            </a>
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
                            {isAuthenticated && designation === "HR" && (
                                <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-3">
                                    <li className="nav-item dropdown"
                                        onMouseEnter={e => e.currentTarget.classList.add("show")}
                                        onMouseLeave={e => e.currentTarget.classList.remove("show")}>
                                        <button
                                            type="button"
                                            className="nav-link dropdown-toggle btn btn-link"
                                            id="attendanceDropdown"
                                            data-bs-toggle="dropdown"
                                            aria-expanded="false"
                                            style={{ textDecoration: "none" }}
                                        >
                                            Logs
                                        </button>
                                        <ul className="dropdown-menu show-on-hover" aria-labelledby="attendanceDropdown">
                                            <li><Link className="dropdown-item" to="/view">Live</Link></li>
                                            <li><hr className="dropdown-divider" /></li>
                                            <li><Link className="dropdown-item" to="/summary">Department</Link></li>
                                            <li><hr className="dropdown-divider" /></li>
                                            <li><Link className="dropdown-item" to="/individual">Individual</Link></li>
                                            <li> <hr className='dropdown-divider' /></li>
                                            <li><Link className="dropdown-item" to="/staffIndividualReport">Your record</Link></li>
                                              <li> <hr className='dropdown-divider' /></li> 
                                                <li><Link className="dropdown-item" to="/instant">Instant</Link></li> {/* new link */}
                                        </ul>
                                    </li>
                                    <li className="nav-item position-relative">
                                        <Link className="nav-link" to="/exemptions">Exemptions</Link>
                                        {pendingExemptions > 0 && (
                                            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark">
                                                {pendingExemptions}
                                            </span>
                                        )}
                                    </li>
                                    <li className="nav-item position-relative">
                                        <Link className="nav-link" to="/leave">Leaves</Link>
                                        {pendingLeaves > 0 && (
                                            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-info text-dark">
                                                {pendingLeaves}
                                            </span>
                                        )}
                                    </li>
                                    <li className="nav-item dropdown"
                                        onMouseEnter={e => e.currentTarget.classList.add("show")}
                                        onMouseLeave={e => e.currentTarget.classList.remove("show")}>
                                        <button
                                            type="button"
                                            className="nav-link dropdown-toggle btn btn-link"
                                            id="usersDropdown"
                                            data-bs-toggle="dropdown"
                                            aria-expanded="false"
                                            style={{ textDecoration: "none" }}
                                        >
                                            Users
                                        </button>
                                        <ul className="dropdown-menu show-on-hover" aria-labelledby="usersDropdown">
                                            <li><Link className="dropdown-item" to="/users">User</Link></li>
                                            <li><hr className="dropdown-divider" /></li>
                                            <li><Link className="dropdown-item" to="/categories">Category</Link></li>
                                        </ul>
                                    </li>
                                    <li className="nav-item">
                                        <Link className="nav-link" to="/devicemanager">Device Manager</Link>
                                    </li>
                                </ul>
                            )}

                            {isAuthenticated && designation !== "HR" && (
                                <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-3">
                                    <li className="nav-item">
                                        <Link className="nav-link" to="/staffIndividualReport">Attendance Report</Link>
                                    </li>
                                    <li className="nav-item">
                                        <Link className="nav-link" to="/applyExemption">Apply Exemption</Link>
                                    </li>
                                </ul>
                            )}

                            <div className="ms-auto">
                                {isAuthenticated ? (
                                    <button
                                        className="nav-link d-flex align-items-center btn btn-link"
                                        onClick={logout}
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

            <div className="container m-large">
                <Routes>
                    <Route path="/login" element={
                        isAuthenticated
                            ? (designation === "HR"
                                ? <Navigate to="/view" replace />
                                : <Navigate to="/staffIndividualReport" replace />)
                            : <LoginPage />
                    } />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* HR Routes */}
                    <Route path="/view" element={<RequireHR><AttendanceViewer /></RequireHR>} />
                    <Route path="/summary" element={<RequireHR><DepartmentSummary /></RequireHR>} />
                    <Route path="/individual/:staffId?" element={<RequireHR><IndividualAttendanceTable /></RequireHR>} />
                    <Route path="/exemptions" element={<RequireHR><HRExcemptions /></RequireHR>} />
                    <Route path="/users" element={<RequireHR><UserManager /></RequireHR>} />
                    <Route path="/categories" element={<RequireHR><CategoryManager /></RequireHR>} />
                    <Route path="/devicemanager" element={<RequireHR><DevicesManager /></RequireHR>} />
                    <Route path="/leave" element={<RequireHR><HRLeaveManager /></RequireHR>} />
                    <Route path="/instant" element={<RequireHR><InstantLogs /></RequireHR>} />


                    {/* Staff Routes */}
                    <Route path="/staffIndividualReport" element={<RequireStaff><IndividualStaffReport /></RequireStaff>} />
                    <Route path="/applyExemption" element={<RequireStaff><ExemptionApplyPage /></RequireStaff>} />

                    <Route
                        path="/"
                        element={
                            (() => {
                                const search = window.location.search;
                                return isAuthenticated
                                    ? (designation === "HR"
                                        ? <Navigate to={`/view${search}`} replace />
                                        : <Navigate to={`/staffIndividualReport${search}`} replace />)
                                    : <Navigate to={`/login${search}`} replace />;
                            })()
                        }
                    />

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