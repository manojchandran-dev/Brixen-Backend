const { PORT } = require('./config');
const app = require('./app');
const pushNotifications = require('./modules/notifications/push/service');
const announcements = require('./modules/notifications/announcements/service');
const { warmHealth } = require('./utils/health');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  warmHealth(); // so the first dashboard/health request is served from cache
});

// ponytail: in-process timer, so it pauses while a free Render instance sleeps.
// Move to a cron/worker alongside the FCM sender.
setInterval(() => {
  Promise.all([pushNotifications.dispatchDue(), announcements.publishDue()]).catch((err) =>
    console.error('scheduler:', err.message)
  );
}, 60_000).unref();
