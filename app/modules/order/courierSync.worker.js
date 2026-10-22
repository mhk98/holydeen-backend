const { Op } = require("sequelize");
const { createHash } = require("node:crypto");

// Holds a MySQL named lock for the whole sweep so only one server process
// syncs at a time. The lock lives on its own connection outside the request
// pool: a sweep can take minutes, and the pool only has a few connections.
// Closing that session releases the lock, so no RELEASE_LOCK is needed.
const withSyncLock = async (sequelize, work) => {
  const manager = sequelize.connectionManager;
  const connection = await manager.connect(manager.config.replication?.write || manager.config);
  // MySQL may drop the idle session mid-sweep; without a listener that error
  // would crash the process.
  connection.on?.("error", () => {});
  const name = `courier-sync:${createHash("sha256").update(sequelize.getDatabaseName()).digest("hex").slice(0, 40)}`;
  try {
    const rows = await new Promise((resolve, reject) => {
      connection.query("SELECT GET_LOCK(?, 0) AS acquired", [name], (error, result) =>
        error ? reject(error) : resolve(result));
    });
    if (Number(rows[0].acquired) === 1) await work();
  } finally {
    await manager.disconnect(connection).catch(() => connection.destroy?.());
  }
};

// Parcels older than this are almost always settled or lost; sweeping them
// every 5 minutes cost one courier API call each. Staff can still sync an old
// order from the admin panel.
const DEFAULT_MAX_AGE_DAYS = 30;
const getMaxAgeDays = (env = process.env) => {
  const days = Number(env.COURIER_SYNC_MAX_AGE_DAYS);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_MAX_AGE_DAYS;
};

// Dependencies are injectable so the scheduler can be tested without a live DB.
const createCourierSyncWorker = ({
  Order, service, logger = console, intervalMs = 300000, lock = (work) => work(),
  maxAgeDays = getMaxAgeDays(), now = () => Date.now(),
}) => {
  let timer;
  let active;
  let stopped = false;

  const sweep = async () => {
    let cursor = 0;
    const createdAfter = new Date(now() - maxAgeDays * 24 * 60 * 60 * 1000);
    while (!stopped) {
      const orders = await Order.findAll({
        attributes: ["Id", "courier"],
        where: {
          Id: { [Op.gt]: cursor },
          status: { [Op.in]: ["in_courier", "on_hold"] },
          courier: { [Op.in]: ["Steadfast", "Pathao"] },
          createdAt: { [Op.gte]: createdAfter },
        },
        order: [["Id", "ASC"]],
        limit: 100,
      });
      if (!orders.length) break;
      for (const order of orders) {
        if (stopped) break;
        cursor = order.Id;
        try {
          const sync = String(order.courier).toLowerCase() === "steadfast"
            ? service.syncSteadfastStatusInDB : service.syncPathaoStatusInDB;
          await sync(order.Id, { automatic: true });
        } catch (error) {
          logger.warn(`Courier sync failed for order ${order.Id}: ${error.message}`);
        }
      }
    }
  };

  const run = () => {
    if (stopped) return Promise.resolve();
    if (active) return active;
    active = lock(sweep).catch((error) => {
      logger.error(`Courier sync failed: ${error.message}`);
    }).finally(() => { active = null; });
    return active;
  };

  return {
    run,
    start() {
      if (timer || stopped) return;
      void run();
      timer = setInterval(run, intervalMs);
      timer.unref?.();
    },
    async stop() {
      stopped = true;
      clearInterval(timer);
      await active;
    },
  };
};

module.exports = { createCourierSyncWorker, withSyncLock, getMaxAgeDays };
