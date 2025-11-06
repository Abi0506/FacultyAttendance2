import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../axios';

const DynamicNavigation = ({ accessRole, pendingExemptions = 0, pendingLeaves = 0, onNavClick }) => {
    const [accessiblePages, setAccessiblePages] = useState([]);
    const [loading, setLoading] = useState(true);

    // Define the navigation structure with dropdowns
    const navStructure = {
        'Access Control': {
            type: 'single',
            icon: 'bi-shield-lock',
            route: '/admin/access-control'
        },
        'Dashboard': {
            type: 'single',
            route: '/dashboard'
        },
        'HOD Dashboard': {
            type: 'single',
            route: '/hod-dashboard',
            displayName: 'Dashboard'
        },
        'Logs': {
            type: 'dropdown',
            dropdownId: 'logsDropdown',
            items: [
                { route: '/view', label: 'Live' },
                { route: '/flags', label: 'Possible Flags' },
                { route: '/summary', label: 'Cumulative' },
                { route: '/individual', label: 'Individual' },
                { route: '/staffIndividualReport', label: 'My record' }
            ]
        },
        'Exemptions': {
            type: 'single',
            route: '/exemptions',
            badge: pendingExemptions > 0 ? { count: pendingExemptions, class: 'bg-warning text-dark' } : null
        },
        'Leaves': {
            type: 'single',
            route: '/leave',
            badge: pendingLeaves > 0 ? { count: pendingLeaves, class: 'bg-info text-dark' } : null
        },
        'Users': {
            type: 'dropdown',
            dropdownId: 'usersDropdown',
            items: [
                { route: '/users', label: 'User' },
                { route: '/categories', label: 'Category' },
                { route: '/deptdesig', label: 'Dept & Designation' }
            ]
        },
        'Devices': {
            type: 'dropdown',
            dropdownId: 'devicesDropdown',
            items: [
                { route: '/instant', label: 'Attendance Sync & Process' },
                { route: '/devicemanager', label: 'Device Manager' }
            ]
        },
        'Apply Exemption': {
            type: 'single',
            route: '/applyExemption'
        }
    };

    // Map page routes to their display names
    const routeToNavMap = {
        '/admin/access-control': 'Access Control',
        '/dashboard': 'Dashboard',
        '/hod-dashboard': 'HOD Dashboard',
        '/view': 'Logs',
        '/flags': 'Logs',
        '/summary': 'Logs',
        '/individual': 'Logs',
        '/staffIndividualReport': 'Logs',
        '/exemptions': 'Exemptions',
        '/leave': 'Leaves',
        '/users': 'Users',
        '/categories': 'Users',
        '/deptdesig': 'Users',
        '/instant': 'Devices',
        '/devicemanager': 'Devices',
        '/applyExemption': 'Apply Exemption'
    };

    useEffect(() => {
        const fetchAccessiblePages = async () => {
            if (!accessRole) {
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get(`/page-access/pages/accessible/${accessRole}`);
                if (response.data.success) {
                    setAccessiblePages(response.data.pages);
                }
            } catch (error) {
                console.error('Error fetching accessible pages:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAccessiblePages();
    }, [accessRole]);

    if (loading) {
        return null;
    }

    // Build a set of accessible routes
    const accessibleRoutes = new Set(
        accessiblePages.map(page => page.page_route)
    );

    // Determine which navigation items to show
    const visibleNavItems = [];
    const processedNavItems = new Set();

    accessiblePages.forEach(page => {
        const navItemName = routeToNavMap[page.page_route];
        if (navItemName && !processedNavItems.has(navItemName)) {
            processedNavItems.add(navItemName);
            const navItem = navStructure[navItemName];

            if (navItem) {
                if (navItem.type === 'dropdown') {
                    // For dropdowns, only include accessible items
                    const accessibleDropdownItems = navItem.items.filter(
                        item => accessibleRoutes.has(item.route)
                    );

                    if (accessibleDropdownItems.length > 0) {
                        visibleNavItems.push({
                            name: navItemName,
                            ...navItem,
                            items: accessibleDropdownItems
                        });
                    }
                } else {
                    visibleNavItems.push({
                        name: navItemName,
                        ...navItem
                    });
                }
            }
        }
    });

    // Sort to maintain consistent order
    const navOrder = [
        'Access Control',
        'Dashboard',
        'HOD Dashboard',
        'Logs',
        'Exemptions',
        'Leaves',
        'Users',
        'Devices',
        'Apply Exemption'
    ];

    visibleNavItems.sort((a, b) => {
        const indexA = navOrder.indexOf(a.name);
        const indexB = navOrder.indexOf(b.name);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return (
        <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-3">
            {visibleNavItems.map((navItem, index) => {
                if (navItem.type === 'single') {
                    return (
                        <li key={index} className={`nav-item ${navItem.badge ? 'position-relative' : ''}`}>
                            <Link className="nav-link" to={navItem.route} onClick={onNavClick}>
                                {navItem.icon && <i className={`bi ${navItem.icon} me-1`}></i>}
                                {navItem.displayName || navItem.name}
                            </Link>
                            {navItem.badge && (
                                <span className={`position-absolute top-0 start-100 translate-middle badge rounded-pill ${navItem.badge.class}`}>
                                    {navItem.badge.count}
                                </span>
                            )}
                        </li>
                    );
                } else if (navItem.type === 'dropdown') {
                    return (
                        <li
                            key={index}
                            className="nav-item dropdown"
                            onMouseEnter={e => e.currentTarget.classList.add("show")}
                            onMouseLeave={e => e.currentTarget.classList.remove("show")}
                        >
                            <button
                                type="button"
                                className="nav-link dropdown-toggle btn btn-link"
                                id={navItem.dropdownId}
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                                style={{ textDecoration: "none" }}
                            >
                                {navItem.name}
                            </button>
                            <ul className="dropdown-menu show-on-hover" aria-labelledby={navItem.dropdownId}>
                                {navItem.items.map((item, itemIndex) => (
                                    <React.Fragment key={itemIndex}>
                                        <li>
                                            <Link className="dropdown-item" to={item.route} onClick={onNavClick}>
                                                {item.label}
                                            </Link>
                                        </li>
                                        {itemIndex < navItem.items.length - 1 && (
                                            <li><hr className="dropdown-divider" /></li>
                                        )}
                                    </React.Fragment>
                                ))}
                            </ul>
                        </li>
                    );
                }
                return null;
            })}
        </ul>
    );
};

export default DynamicNavigation;
