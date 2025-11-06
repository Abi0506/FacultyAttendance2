import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './authProvider';
import axios from '../axios';
import { useAlert } from '../components/AlertProvider';

/**
 * Basic authentication check - only verifies if user is logged in
 */
export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Dynamic route protection component that checks page access from database
 * Replaces hardcoded RequireAdmin, RequireHR, RequirePRINCIPAL, RequireStaff
 */
export function RequirePageAccess({ children, pageRoute }) {
  const { isAuthenticated, accessRole } = useAuth();
  const location = useLocation();
  const [hasAccess, setHasAccess] = useState(null); // null = loading, true = allowed, false = denied
  const [redirectPath, setRedirectPath] = useState('/staffIndividualReport');
  const { showAlert } = useAlert();
  const alertedRef = useRef(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!isAuthenticated) {
        setHasAccess(false);
        return;
      }

      try {
        const response = await axios.post('/page-access/check-access', {
          pageRoute
        });

        if (response.data.success) {
          setHasAccess(response.data.hasAccess);

          if (!response.data.hasAccess) {
            const accessibleResponse = await axios.get(
              `/page-access/pages/accessible/${accessRole}`
            );

            if (accessibleResponse.data.success && accessibleResponse.data.pages.length > 0) {
              // Find the first accessible page that's not login/reset-password
              const firstPage = accessibleResponse.data.pages.find(
                page => page.page_route !== '/login' &&
                  page.page_route !== '/reset-password'
              );
              if (firstPage) {
                setRedirectPath(firstPage.page_route);
              }
            }
          }
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking page access:', error);
        setHasAccess(false);
      }
    };

    checkAccess();
  }, [isAuthenticated, pageRoute, accessRole]);

  useEffect(() => {
    if (isAuthenticated && hasAccess === false && !alertedRef.current) {
      alertedRef.current = true;
      showAlert('Access denied to that page', 'error');
    }
  }, [hasAccess, isAuthenticated, showAlert]);

  if (hasAccess === null) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasAccess) {
    return <Navigate to={redirectPath} replace />;
  }
  return children;
}

export default RequireAuth;
