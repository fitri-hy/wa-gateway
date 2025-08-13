const util = require('util');
const db = require('../config/MySQL');

const query = util.promisify(db.query).bind(db);

exports.index = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.redirect('/login');
    }

    const search = req.query.search ? req.query.search.trim() : '';
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (currentPage - 1) * perPage;

    const searchCondition = search
      ? `AND (title LIKE ? OR content LIKE ?)`
      : '';

    const countQuery = `
      SELECT COUNT(*) AS total FROM reports
      WHERE user_id = ? ${searchCondition}
    `;

    const countParams = search
      ? [userId, `%${search}%`, `%${search}%`]
      : [userId];

    const countResult = await query(countQuery, countParams);
    const totalReports = countResult[0].total;
    const totalPages = Math.max(1, Math.ceil(totalReports / perPage));

    const dataQuery = `
      SELECT id, user_id, title, category, content, status, created_at
      FROM reports
      WHERE user_id = ? ${searchCondition}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = search
      ? [userId, `%${search}%`, `%${search}%`, perPage, offset]
      : [userId, perPage, offset];

    const reports = await query(dataQuery, dataParams);

    res.render('dashboard/reports', {
      reports,
      search,
      currentPage,
      totalPages
    });

  } catch (error) {
    console.error('Failed to get reports:', error);
    res.render('dashboard/reports', {
      reports: [],
      search: '',
      currentPage: 1,
      totalPages: 1
    });
  }
};

exports.addReport = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.redirect('/login');
    }

    let { title, category, content } = req.body;

    title = title?.trim() || '';
    content = content?.trim() || '';

    if (!title || !category || !content) {
      req.flash('error', res.__('flash.All fields are required'));
      return res.redirect('/dashboard/reports');
    }

    if (title.length > 50) {
      req.flash('error', res.__('flash.Title must be at most 50 characters'));
      return res.redirect('/dashboard/reports');
    }

    if (content.length > 300) {
      req.flash('error', res.__('flash.Content must be at most 300 characters'));
      return res.redirect('/dashboard/reports');
    }

    const status = 'Pending';

    const sql = `INSERT INTO reports (user_id, title, category, content, status, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`;

    await new Promise((resolve, reject) => {
      db.query(sql, [userId, title, category, content, status], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    req.flash('success', res.__('flash.Report added successfully'));
    res.redirect('/dashboard/reports');
  } catch (error) {
    console.error(error);
    req.flash('error', res.__('flash.Failed to add report'));
    res.redirect('/dashboard/reports');
  }
};
