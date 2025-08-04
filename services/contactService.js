const db = require('../config/Mysql');

async function getContactsByUser(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT id, name, phone, created_at, updated_at FROM contacts WHERE user_id = ? ORDER BY name`;
    db.query(query, [userId], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

async function getTotalContactsByUser(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM contacts WHERE user_id = ?`;
    db.query(query, [userId], (err, results) => {
      if (err) return reject(err);
      resolve(results[0].total);
    });
  });
}

async function getContactsByUserPaginated(userId, search = '', limit = 10, offset = 0) {
  return new Promise((resolve, reject) => {
    const searchQuery = `%${search}%`;
    const countQuery = `SELECT COUNT(*) AS total FROM contacts WHERE user_id = ? AND name LIKE ?`;
    const dataQuery = `SELECT id, name, phone, created_at, updated_at FROM contacts WHERE user_id = ? AND name LIKE ? ORDER BY name LIMIT ? OFFSET ?`;

    db.query(countQuery, [userId, searchQuery], (err, countResult) => {
      if (err) return reject(err);
      const total = countResult[0].total;

      db.query(dataQuery, [userId, searchQuery, limit, offset], (err2, dataResult) => {
        if (err2) return reject(err2);
        resolve({ contacts: dataResult, total });
      });
    });
  });
}

async function createContact(userId, name, phone) {
  return new Promise((resolve, reject) => {
    const query = 'INSERT INTO contacts (user_id, name, phone) VALUES (?, ?, ?)';
    db.query(query, [userId, name, phone], (err, result) => {
      if (err) return reject(err);
      resolve(result.insertId);
    });
  });
}

async function updateContact(id, name, phone) {
  return new Promise((resolve, reject) => {
    const query = 'UPDATE contacts SET name = ?, phone = ? WHERE id = ?';
    db.query(query, [name, phone, id], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function deleteContact(contactId, userId) {
  return new Promise((resolve, reject) => {
    const query = 'DELETE FROM contacts WHERE id = ? AND user_id = ?';
    db.query(query, [contactId, userId], (err, results) => {
      if (err) return reject(err);
      if (results.affectedRows === 0) return reject(new Error('Contact not found or not authorized'));
      resolve(true);
    });
  });
}

module.exports = {
  getContactsByUser,
  getTotalContactsByUser,
  getContactsByUserPaginated,
  createContact,
  updateContact,
  deleteContact,
};
