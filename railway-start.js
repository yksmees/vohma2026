async function runCronSync(){
  const appUrl = String(process.env.APP_URL || "").replace(/\/+$/, "");
  const secret = String(process.env.CRON_SECRET || "");

  if (!appUrl || !secret) {
    console.error("RUN_CRON=true, aga APP_URL või CRON_SECRET puudub.");
    process.exit(1);
  }

  const url = `${appUrl}/api/cron/sync/results`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-cron-secret": secret
      }
    });

    const text = await response.text();
    console.log("HTTP", response.status, text);
    process.exit(response.ok ? 0 : 1);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

const runCron = String(process.env.RUN_CRON || "").trim().toLowerCase();

if (runCron === "true" || runCron === "1" || runCron === "yes") {
  runCronSync();
} else {
  require("./server.js");
}
