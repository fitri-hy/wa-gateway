const fs = require('fs').promises;
const path = require('path');
const db = require('../config/MySQL');

async function deleteSessionsAndFolder(userId) {
  try {
    const [sessions] = await db.promise().query(`
      SELECT id, phone FROM sessions WHERE user_id = ?
    `, [userId]);

    if (sessions.length === 0) {
      // console.log(`No sessions found for user ${userId}`);
      return;
    }

    const sessionIds = sessions.map(s => s.id);
    // console.log(`Found ${sessionIds.length} sessions:`, sessionIds);

    const placeholders = sessionIds.map(() => '?').join(',');

    const [delAutoReplies] = await db.promise().query(
      `DELETE FROM auto_replies WHERE session_id IN (${placeholders})`,
      sessionIds
    );
    // console.log(`Deleted ${delAutoReplies.affectedRows} auto_replies related to user ${userId}`);

    const [delSessions] = await db.promise().query(
      `DELETE FROM sessions WHERE user_id = ?`,
      [userId]
    );
    // console.log(`Deleted ${delSessions.affectedRows} sessions for user ${userId}`);

    for (const session of sessions) {
      if (session.phone) {
        const dirPath = path.join(__dirname, '..', 'sessions', session.phone);
        // console.log(`Attempting to delete folder: ${dirPath}`);
        try {
          await fs.rm(dirPath, { recursive: true, force: true });
          // console.log(`Folder ${dirPath} deleted successfully.`);
        } catch (err) {
          console.error(`Failed to delete folder ${dirPath}:`, err.message);
        }
      } else {
        // console.log('No phone number in session, skipping folder deletion.');
      }
    }

    // console.log(`Finished deleting sessions and folders for user ${userId}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

module.exports = async function cleanupMiddleware(req, res, next) {
  if (!req.session || !req.session.user) {
    return next();
  }

  const user = req.session.user;

  try {
    const [result] = await db.promise().query(`
      SELECT u.package_end, u.status, p.duration_days
      FROM users u
      LEFT JOIN packages p ON u.package_id = p.id
      WHERE u.id = ?
    `, [user.id]);

    const userData = result[0];
    if (!userData) return next();

    const now = new Date();
    const packageEnd = userData.package_end ? new Date(userData.package_end) : null;
    const isExpired = packageEnd && packageEnd < now;
    const isNotUnlimited = userData.duration_days !== -1;
    const isInactiveOrSuspended = ['inactive', 'suspended'].includes(userData.status);

    if (isExpired && isNotUnlimited) {
      // console.log('💥 Paket expired, menghapus sessions...');
      await deleteSessionsAndFolder(user.id);
    } else {
      // console.log('✅ Paket masih aktif atau unlimited');
    }

    if (isInactiveOrSuspended) {
      // console.log('💥 Status inactive/suspended, menghapus sessions...');
      await deleteSessionsAndFolder(user.id);
    } else {
      // console.log('✅ Status user aktif');
    }

  } catch (err) {
    // console.error('❌ Error in cleanup middleware:', err.message);
  }

  next();
};
