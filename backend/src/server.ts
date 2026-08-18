import { createServer } from "node:http";

import { app } from "./app.js";
import { appConfig } from "./config/app.config.js";
import "./config/timezone.config.js";

import { prisma } from "./infrastructure/database/prisma.js";
import { logger } from "./infrastructure/logging/logger.js";

const server = createServer(app);

async function bootstrap(): Promise<void> {
  try {
    await prisma.$connect();

    logger.info(
      {
        timezone: appConfig.timezone,
      },
      "Database connection established",
    );

    server.listen(appConfig.port, appConfig.host, () => {
      logger.info(
        {
          host: appConfig.host,
          port: appConfig.port,
          environment: appConfig.environment,
        },
        "ODONTHO SVB Backend started",
      );
    });
  } catch (error) {
    logger.fatal(
      {
        err: error,
      },
      "Backend bootstrap failed",
    );

    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(
    {
      signal,
    },
    "Graceful shutdown started",
  );

  server.close(async () => {
    try {
      await prisma.$disconnect();

      logger.info("Database connection closed");

      process.exit(0);
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Error during shutdown",
      );

      process.exit(1);
    }
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void bootstrap();
