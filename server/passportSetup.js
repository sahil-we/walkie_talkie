const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./config');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    db.query('SELECT * FROM users WHERE google_id = ?', [profile.id], (err, result) => {
        if (err) return done(err);

        if (result.length > 0) {
            return done(null, result[0]);
        } else {
            const pin = Math.floor(100000 + Math.random() * 900000).toString();
            db.query('INSERT INTO users (google_id, email, name, pin) VALUES (?, ?, ?, ?)',
                [profile.id, profile.emails[0].value, profile.displayName, pin],
                (err, res) => {
                    if (err) return done(err);
                    done(null, { id: res.insertId, email: profile.emails[0].value, name: profile.displayName, pin });
                }
            );
        }
    });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
