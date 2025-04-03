const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");
const multer = require("multer");
const path = require("path");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
    session({
        secret: "secretKey",
        resave: false,
        saveUninitialized: false,
    })
);

app.use(passport.initialize());
app.use(passport.session());


const users = {}; // Stores online users: { userPin: socketId }

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect((err) => {
    if (err) throw err;
    console.log("✅ MySQL Connected...");
});

// **MULTER STORAGE CONFIGURATION**
const storage = multer.diskStorage({
    destination: "public/uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();

// **Passport Google OAuth Setup**
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "https://walkie-talkie-1.onrender.com/auth/google/callback",
        },
        (accessToken, refreshToken, profile, done) => {
            db.query("SELECT * FROM users WHERE google_id = ?", [profile.id], (err, results) => {
                if (err) return done(err);

                if (results.length > 0) {
                    return done(null, results[0]);
                } else {
                    const newPin = generatePin();
                    db.query(
                        "INSERT INTO users (email, google_id, pin, profile_pic) VALUES (?, ?, ?, ?)",
                        [profile.emails[0].value, profile.id, newPin, profile.photos[0].value],
                        (insertErr, result) => {
                            if (insertErr) return done(insertErr);

                            const userId = result.insertId;
                            db.query(
                                `CREATE TABLE IF NOT EXISTS friends_${userId} (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), pin VARCHAR(6), profile_photo VARCHAR(255))`,
                                (tableErr) => {
                                    if (tableErr) console.error("⚠️ Error creating friends table:", tableErr);
                                }
                            );

                            return done(null, { id: userId, email: profile.emails[0].value, newUser: true });
                        }
                    );
                }
            });
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.query("SELECT * FROM users WHERE id = ?", [id], (err, results) => {
        if (err) return done(err);
        done(null, results[0]);
    });
});

// **Google OAuth Routes**
app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["openid", "profile", "email"]
    })
);


app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/" }), (req, res) => {
    req.session.newUser = req.user.newUser || false;
    return res.redirect(req.session.newUser ? "/profile.html" : "/dashboard.html");
});

// **Profile Setup**
app.post("/setup-profile", upload.single("profilePic"), (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "User not authenticated" });

    const { name, gender, age } = req.body;
    const profilePic = req.file ? req.file.filename : null;
    const userId = req.user.id;

    db.query(
        "UPDATE users SET name = ?, gender = ?, age = ?, profile_pic = ? WHERE id = ?",
        [name, gender, age, profilePic, userId],
        (err) => {
            if (err) return res.status(500).json({ error: "Database update failed" });

            req.session.newUser = false;
            res.redirect("/dashboard.html");
        }
    );
});

// **Check Profile Completion**
app.get("/check-profile", (req, res) => {
    if (!req.isAuthenticated()) return res.json({ redirect: "/" });

    db.query("SELECT name FROM users WHERE id = ?", [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        res.json({ redirect: results[0]?.name ? "/dashboard.html" : "/profile.html" });
    });
});

// **Fetch User Data**
app.get("/get-user", (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    db.query("SELECT name, pin, profile_pic, id FROM users WHERE id = ?", [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        res.json(results[0]);
    });
});

// **Fetch Friends**
app.get("/get-friends", (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    db.query(`SELECT name, pin, profile_photo FROM friends_${req.user.id}`, (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        res.json(results);
    });
});

// **Friend Request System**
app.post("/request-connection", (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { friendPin } = req.body;

    db.query("SELECT id, name, profile_pic FROM users WHERE pin = ?", [friendPin], (err, result) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (result.length === 0) return res.status(404).json({ error: "Friend not found" });

        const friend = result[0];

        io.emit(`friend-request-${friend.id}`, {
            senderId: req.user.id,
            senderPin: req.user.pin,
            senderName: req.user.name,
            senderPhoto: req.user.profile_pic,
        });

        res.json({ success: true });
    });
});

// **Accept Friend Request**
app.post("/accept-connection", (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { senderId, senderPin, senderName, senderPhoto } = req.body;
    const userId = req.user.id;
    const userPin = req.user.pin;
    const userName = req.user.name;
    const userPhoto = req.user.profile_pic;

    db.query(
        `INSERT INTO friends_${userId} (name, pin, profile_photo) VALUES (?, ?, ?)`,
        [senderName, senderPin, senderPhoto],
        (err) => {
            if (err) return res.status(500).json({ error: "Failed to add friend" });

            db.query(
                `INSERT INTO friends_${senderId} (name, pin, profile_photo) VALUES (?, ?, ?)`,
                [userName, userPin, userPhoto],
                (err) => {
                    if (err) return res.status(500).json({ error: "Failed to add friend" });

                    io.emit(`friend-accepted-${senderId}`, { friendName: userName, friendPin: userPin, friendPhoto: userPhoto });
                    io.emit(`friend-accepted-${userId}`, { friendName: senderName, friendPin: senderPin, friendPhoto: senderPhoto });

                    res.json({ success: true });
                }
            );
        }
    );
});

// **Socket.IO Connection Handling**

io.on("connection", (socket) => {
    console.log("🟢 A user connected:", socket.id);

    // Register user with their PIN
    socket.on("register", ({ userPin }) => {
        users[userPin] = socket.id;
        console.log(`✅ User registered: ${userPin} with socket ID: ${socket.id}`);
    });

    // Start talking
    socket.on("start-talking", ({ userPin, friendPin }) => {
        const friendSocketId = users[friendPin];
        if (friendSocketId) {
            io.to(friendSocketId).emit("incoming-call", { senderPin: userPin });
        } else {
            console.log(`⚠️ Friend with PIN ${friendPin} is not online.`);
        }
    });

    // Stop talking
    socket.on("stop-talking", ({ userPin, friendPin }) => {
        const friendSocketId = users[friendPin];
        if (friendSocketId) {
            io.to(friendSocketId).emit("call-ended", { senderPin: userPin });
        }
    });

    // WebRTC Signaling
    socket.on("offer", ({ friendPin, offer }) => {
        const friendSocketId = users[friendPin];
        if (friendSocketId) {
            io.to(friendSocketId).emit("offer", { senderPin: socket.id, offer });
        }
    });

    socket.on("answer", ({ senderPin, answer }) => {
        io.to(senderPin).emit("answer", { answer });
    });

    socket.on("ice-candidate", ({ friendPin, candidate }) => {
        const friendSocketId = users[friendPin];
        if (friendSocketId) {
            io.to(friendSocketId).emit("ice-candidate", { senderPin: socket.id, candidate });
        }
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
        console.log("🔴 A user disconnected:", socket.id);
        for (const [userPin, socketId] of Object.entries(users)) {
            if (socketId === socket.id) {
                delete users[userPin];
                console.log(`🚫 User with PIN ${userPin} disconnected.`);
                break;
            }
        }
    });
});


// **Start Server**
server.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));