const { PORT } = require('./config');
const app = require('./app');
const pushNotifications = require('./services/pushNotificationService');
const announcements = require('./services/announcementService');

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
