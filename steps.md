Run Authentication form
1. Create new environment
2. Open xampp.
3. Create database.
4. Create table.
        CREATE TABLE user (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255),
        email VARCHAR(255),
        password VARCHAR(255)
        );
    
    CREATE TABLE daily_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    request_count INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES user(Id),  -- Links to the `Id` in the `user` table
    UNIQUE (user_id, date)  -- Ensures a unique record per user per day
);

CREATE TABLE comments_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    post_text TEXT,
    generated_comment TEXT,
    emotion VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(Id)
);


5. run Python app.py

Run Extension functionality
1. Go to the extension folder by terminal
2. npm install express
3. Change the package.json
        {
        "name": "your-app-name",
        "version": "1.0.0",
        "description": "Your application description",
        "main": "server.js",
        "scripts": {
            "start": "node server.js"
        },
        "dependencies": {
            "express": "^4.17.1"
        }
        }
4. npm install
5. npm install cors
6. set API_KEY=AIzaSyB1Gqa6Oh2jQuZvX23vETLcAS8alPDFosE
7. npm install @google/generative-ai
8. go to scripts folder.
9. node server.js


npm install node-fetch

openssl req -nodes -new -x509 -keyout server.key -out server.cert

apppassword : kjfm hcbw tdii dkha