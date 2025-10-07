// backend/models/User.js

const db = require('../database/db');

const User = {
  // ✅ Adicione o parâmetro role
  create: (name, username, hashedPassword, role, callback) => {
    db.run(
      `INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
      [name, username, hashedPassword, role],
      function (err) {
        callback(err, { id: this.lastID, name, username, role });
      }
    );
  },

  findByUsername: (username, callback) => {
    db.get(`SELECT * FROM users WHERE username = ?`, [username], callback);
  },

  findById: (id, callback) => {
    db.get(`SELECT id, name, username, role FROM users WHERE id = ?`, [id], callback);
  }
};

module.exports = User;