const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const db = require('./database');
const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google-login', async (req, res) => {
    const { token } = req.body;
    
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const { name, email, picture } = ticket.getPayload();

        db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            if (results.length > 0) {
                return res.json({ message: "Login successful", user: results[0] });
            } else {
                const pin = Math.floor(100000 + Math.random() * 900000); // 6-digit PIN
                db.query("INSERT INTO users (name, email, picture, pin) VALUES (?, ?, ?, ?)", 
                [name, email, picture, pin], (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });

                    res.json({ message: "Signup successful", user: { name, email, picture, pin } });
                });
            }
        });

    } catch (error) {
        res.status(400).json({ error: "Invalid token" });
    }
});

module.exports = router;
