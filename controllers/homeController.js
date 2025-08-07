const db = require('../config/Mysql');

exports.index = (req, res) => {
  const query = 'SELECT * FROM packages ORDER BY price ASC';

  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching packages:', error);
      return res.status(500).render('error', {
        title: '500 Internal Server Error',
        message: 'Server Error',
      });
    }

    res.render('home', { packagesList: results });
  });
};
