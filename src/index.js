const { PORT } = require('./config');
const app = require('./app');
const pushNotifications = require('./modules/notifications/push/service');
const announcements = require('./modules/notifications/announcements/service');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ponytail: in-process timer, so it pauses while a free Render instance sleeps.
// Move to a cron/worker alongside the FCM sender.
setInterval(() => {
  Promise.all([pushNotifications.dispatchDue(), announcements.publishDue()]).catch((err) =>
    console.error('scheduler:', err.message)
  );
}, 60_000).unref();
