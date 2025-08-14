const db = require('../config/MySQL');

exports.index = (req, res) => {
  let query = "SELECT * FROM packages WHERE name <> 'ADMIN'";
  
  if (req.session && req.session.user) {
    query += ' AND price <> 0.00';
  }

  query += ' ORDER BY price ASC';

  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching packages:', error);
      return res.status(500).render('error', {
        title: res.__('error.Internal Server Error'),
        message: res.__('error.It seems there was an error'),
      });
    }

    res.render('home', { packagesList: results });
  });
};
