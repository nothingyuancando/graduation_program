import { getApiClient } from "../src/storage/database/supabase-client.ts";
import { getWorkerIdleMs, processNextGenerationJob } from "../src/lib/generation-jobs.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const client = getApiClient();
  const idleMs = getWorkerIdleMs();
  let stopping = false;

  process.on("SIGINT", () => {
    stopping = true;
    console.log("\nWorker is stopping after the current step...");
  });

  process.on("SIGTERM", () => {
    stopping = true;
    console.log("\nWorker is stopping after the current step...");
  });

  console.log("Generation worker started.");
  console.log(`Idle interval: ${idleMs}ms`);

  while (!stopping) {
    const result = await processNextGenerationJob(client);

    if (result.processed) {
      console.log(`[${new Date().toISOString()}] job=${result.jobId} stage=${result.stage}`);
      continue;
    }

    await sleep(idleMs);
  }

  console.log("Generation worker stopped.");
}

main().catch((error) => {
  console.error("Generation worker crashed:", error);
  process.exit(1);
});
