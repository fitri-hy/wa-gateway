const db = require('../config/MySQL');
const fs = require('fs');
const path = require('path');

exports.index = (req, res) => {
  const userId = req.session.user.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  const search = req.query.search ? req.query.search.trim() : '';
  const currentPage = parseInt(req.query.page) || 1;
  const perPage = 20;
  const offset = (currentPage - 1) * perPage;

  const countQuery = `
    SELECT COUNT(*) AS total 
    FROM uploads 
    WHERE user_id = ? ${search ? 'AND name LIKE ?' : ''}
  `;
  const dataQuery = `
    SELECT * 
    FROM uploads 
    WHERE user_id = ? ${search ? 'AND name LIKE ?' : ''}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `;

  const searchParam = `%${search}%`;
  const countParams = search ? [userId, searchParam] : [userId];
  const dataParams = search ? [userId, searchParam, perPage, offset] : [userId, perPage, offset];

  db.query(countQuery, countParams, (err, countResult) => {
    if (err) {
      console.error(err);
      return res.render('dashboard/file-manager', {
        files: [],
        baseUrl,
        error: 'Failed to load files',
        search,
        currentPage,
        totalPages: 1
      });
    }

    const totalFiles = countResult[0].total;
    const totalPages = Math.ceil(totalFiles / perPage);

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) {
        req.flash('error', res.__('flash.Failed to load file data'));
        return res.render('dashboard/file-manager', {
          files: [],
          baseUrl,
          search,
          currentPage,
          totalPages
        });
      }

      res.render('dashboard/file-manager', {
        files: results,
        baseUrl,
        search,
        currentPage,
        totalPages
      });
    });
  });
};

exports.upload = (req, res) => {
  const file = req.file;
  if (!file) {
    req.flash('error', res.__('flash.No files uploaded'));
    return res.redirect('/dashboard/file-manager');
  }
  const userId = req.session.user.id;
  const { filename, size } = file;
  const filePath = `/uploads/${filename}`;

  db.query(
    'INSERT INTO uploads (user_id, name, size, path) VALUES (?, ?, ?, ?)',
    [userId, filename, size, filePath],
    (err, results) => {
      if (err) {
        req.flash('error', res.__('flash.Failed to upload file'));
        return res.redirect('/dashboard/file-manager');
      }
      req.flash('success', res.__('flash.File uploaded successfully'));
      res.redirect('/dashboard/file-manager');
    }
  );
};

exports.deleteFile = async (req, res) => {
  const fileId = req.params.id;
  const userId = req.session.user.id;

  try {
    const [rows] = await db.promise().query('SELECT * FROM uploads WHERE id = ? AND user_id = ?', [fileId, userId]);

    if (rows.length === 0) {
      req.flash('error', res.__('flash.File not found'));
      return res.redirect('/dashboard/file-manager');
    }

    const file = rows[0];
    const filePath = path.join(__dirname, '..', 'public', file.path);

    await fs.promises.unlink(filePath);

    await db.promise().query('DELETE FROM uploads WHERE id = ? AND user_id = ?', [fileId, userId]);

    req.flash('success', res.__('flash.File deleted successfully'));
    res.redirect('/dashboard/file-manager');
  } catch (error) {
    console.error(error);
    req.flash('error', res.__('flash.Failed to delete file'));
    res.redirect('/dashboard/file-manager');
  }
};
