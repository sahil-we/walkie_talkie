const mysql = require("mysql");
require("dotenv").config();

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "walkie_talkie_db"
});

db.connect(err => {
    if (err) {
        console.error("Database connection failed: ", err);
        return;
    }
    console.log("MySQL Connected...");
});

module.exports = db;
