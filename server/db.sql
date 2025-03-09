CREATE DATABASE walkie_talkie;

USE walkie_talkie;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    age INT,
    gender VARCHAR(10),
    profile_pic VARCHAR(255),
    pin VARCHAR(6) UNIQUE
);

CREATE TABLE friends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    friend_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
);
