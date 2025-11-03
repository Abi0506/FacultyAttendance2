import React from 'react';
import { useState, useEffect } from 'react';

function PageWrapper({ title, children }) {
    const [isFlagMode, setIsFlagMode] = useState(false);
    useEffect(() => {
        const handleFlagChange = () => {
            setIsFlagMode(prev => {
                const newValue = !prev;
                return newValue;
            });
        };

        window.addEventListener("flagModeChanged", handleFlagChange);
        return () => window.removeEventListener("flagModeChanged", handleFlagChange);
    }, []);

    return (
        <div className={`mt-5 mb-5 p-4 rounded-4 shadow-lg bg-white bg-opacity-75${isFlagMode ? ' border border-danger border-2' : ''}`}>
            {title && (
                <>
                    <h2 className="mb-4 fw-bold text-c-primary text-center">{title}</h2>
                    <hr className="hr w-75 m-auto my-4" />
                </>
            )}
            {children}
        </div>
    );
}

export default PageWrapper;
