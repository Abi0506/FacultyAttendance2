import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../axios';


/**
 * Custom hook to check if user has access to a specific page
 * @param {string} pageRoute - The route of the page to check
 * @returns {object} - { hasAccess, loading, checkAccess }
 */
export const usePageAccess = (pageRoute) => {
    const [hasAccess, setHasAccess] = useState(true); // Default to true to avoid blocking during check
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const checkAccess = async () => {
        try {
            setLoading(true);
            const response = await axios.post('/page-access/check-access', { pageRoute });

            if (response.data.success) {
                setHasAccess(response.data.hasAccess);

                if (!response.data.hasAccess) {
                    // Redirect to appropriate page based on user role
                    console.warn(`Access denied to ${pageRoute}. User role: ${response.data.userAccessRole}, Allowed roles: ${response.data.allowedRoles?.join(', ')}`);
                    navigate('/staffIndividualReport', { replace: true });
                }
            }
        } catch (error) {
            console.error('Error checking page access:', error);
            // On error, allow access to avoid blocking users
            setHasAccess(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAccess();
    }, [pageRoute]);

    return { hasAccess, loading, checkAccess };
};

/**
 * Get all accessible pages for the current user
 * @returns {object} - { pages, loading, fetchAccessiblePages }
 */
export const useAccessiblePages = () => {
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAccessiblePages = async (accessRole) => {
        try {
            setLoading(true);
            const response = await axios.get(`/page-access/pages/accessible/${accessRole}`);

            if (response.data.success) {
                setPages(response.data.pages);
            }
        } catch (error) {
            console.error('Error fetching accessible pages:', error);
            setPages([]);
        } finally {
            setLoading(false);
        }
    };

    return { pages, loading, fetchAccessiblePages };
};

/**
 * Higher-order component to protect routes based on page access
 * @param {React.Component} Component - Component to wrap
 * @param {string} pageRoute - Route to check access for
 * @returns {React.Component}
 */
export const withPageAccess = (Component, pageRoute) => {
    return (props) => {
        const { hasAccess, loading } = usePageAccess(pageRoute);

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

        if (!hasAccess) {
            return null; // Component will redirect in usePageAccess hook
        }

        return <Component {...props} />;
    };
};
