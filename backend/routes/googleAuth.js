const GoogleStrategy = require('passport-google-oauth20').Strategy;
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const router = express.Router();



// Passport Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5050/auth/google/callback"
},
    async function (accessToken, refreshToken, profile, done) {
        try {
            const email = profile.emails && profile.emails[0] && profile.emails[0].value;
            if (!email) return done(null, false, { message: 'No email found in Google profile' });
            const [rows] = await db.query('SELECT staff_id, name, designation FROM staff WHERE email = ?', [email]);
            if (rows.length === 0) {
                return done(null, false, { message: 'No staff found with this email' });
            }

            const user = { ...profile, staff: rows[0] };
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// Google login route
router.get('/google', (req, res, next) => {
    // Store redirect URL in session or pass as query param to callback
    req.session.redirectUrl = req.query.redirect;
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google callback route
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: true }),
    (req, res) => {
        const redirectUrl = req.session.redirectUrl || 'http://localhost:3000';

        if (!req.user || !req.user.staff) {
            return res.redirect(`${redirectUrl}/?message=${encodeURIComponent('No staff found with this Google account. Please contact admin.')}`);
        }

        const { staff_id, designation } = req.user.staff;
        const SECRET_KEY = process.env.SECRET_KEY;
        const token = jwt.sign({ staff_id, designation }, SECRET_KEY, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.redirect(`${redirectUrl}/?message=${encodeURIComponent('Google login successful')}`);
    }
);


// Google logout
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('http://localhost:3000');
    });
});

module.exports = router;
