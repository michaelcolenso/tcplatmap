// Legacy app config example (no longer used by the map-only build).
module.exports = {
  db: process.env.MONGO_URL || "mongodb://localhost:27017/test",
  sessionSecret: process.env.SESSION_SECRET || "change-me",
};

