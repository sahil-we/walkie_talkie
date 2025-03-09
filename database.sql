CREATE DATABASE walkietalkie;

USE walkietalkie;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(191) UNIQUE,  -- Reduced from 255 to 191
    email VARCHAR(191) UNIQUE,       -- Reduced from 255 to 191
    password VARCHAR(255),
    name VARCHAR(255),
    age INT,
    profile_pic VARCHAR(255),
    pin VARCHAR(10) UNIQUE
);

CREATE TABLE friends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    friend_pin VARCHAR(10),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
