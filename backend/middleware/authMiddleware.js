const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;

// Verify login and attach user to request
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // { staff_id, access_role }
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// Role-based access control using numeric access_role
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.access_role;
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: 'Access denied. Insufficient privileges.' });
        }
        next();
    };
};

module.exports = { verifyToken, authorizeRoles };
