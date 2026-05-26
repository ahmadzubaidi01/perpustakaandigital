const { Notification, User } = require('../models');

async function check() {
  try {
    const total = await Notification.count({ paranoid: false });
    console.log(`Total notifications in DB: ${total}`);

    const active = await Notification.count({ paranoid: true });
    console.log(`Active (not soft-deleted) notifications in DB: ${active}`);

    const list = await Notification.findAll({
      paranoid: false,
      limit: 10,
      order: [['created_at', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['user_id', 'full_name', 'user_role'] }]
    });

    console.log('\n--- Recent 10 Notifications ---');
    list.forEach(n => {
      console.log(`ID: ${n.notification_id} | User: ${n.user ? n.user.full_name : 'N/A'} (ID: ${n.user_id}, Role: ${n.user ? n.user.user_role : 'N/A'})`);
      console.log(`Title: ${n.notification_title}`);
      console.log(`Message: ${n.notification_message}`);
      console.log(`Read: ${n.is_read} | Type: ${n.notification_type} | Sent At: ${n.sent_at}\n`);
    });

    const unreadStats = await Notification.findAll({
      attributes: ['user_id', 'is_read', [Notification.sequelize.fn('COUNT', '*'), 'count']],
      group: ['user_id', 'is_read'],
      include: [{ model: User, as: 'user', attributes: ['full_name', 'user_role'] }]
    });

    console.log('--- Unread/Read stats by user ---');
    unreadStats.forEach(stat => {
      const u = stat.user;
      console.log(`User: ${u ? u.full_name : 'N/A'} (ID: ${stat.user_id}, Role: ${u ? u.user_role : 'N/A'}) | is_read: ${stat.is_read} | Count: ${stat.get('count')}`);
    });

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    process.exit(0);
  }
}

check();
