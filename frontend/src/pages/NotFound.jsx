import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authProvider';

export default function NotFound() {
    const { isAuthenticated } = useAuth();

    return (
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
            <div className="text-center">
                <style>{`
                    @keyframes float404 {
                        0% { transform: translateY(0px); }
                        50% { transform: translateY(-8px); }
                        100% { transform: translateY(0px); }
                    }
                    @keyframes glow {
                        0% { text-shadow: 0 0 0 var(--primary); }
                        50% { text-shadow: 0 0 1px var(--primary); }
                        100% { text-shadow: 0 0 0 var(--primary); }
                    }
                `}</style>
                <div
                    style={{
                        fontSize: '86px',
                        fontWeight: 800,
                        letterSpacing: '-2px',
                        lineHeight: 1,
                        animation: 'float404 3s ease-in-out infinite, glow 3s ease-in-out infinite',
                        color: 'var(--primary)'
                    }}
                >
                    404
                </div>
                <p className="text-muted mb-4" style={{ maxWidth: 480, margin: '12px auto 24px' }}>
                    The page you’re looking for doesn’t exist or may have moved.
                </p>
                <div className="d-flex gap-2 justify-content-center">
                    <Link to="/" className="btn btn-c-primary">Go Home</Link>
                    {!isAuthenticated && (
                        <Link to="/login" className="btn btn-c-secondary">Login</Link>
                    )}
                </div>
            </div>
        </div>
    );
}
