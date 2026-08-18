import { pinoHttp } from "pino-http";

import { logger } from "../../infrastructure/logging/logger.js";
import { CORRELATION_ID_HEADER } from "./request-context.middleware.js";

export const httpLoggerMiddleware = pinoHttp({
  logger,

  genReqId(req) {
    const correlationId = req.headers[CORRELATION_ID_HEADER];

    if (Array.isArray(correlationId)) {
      return correlationId[0] ?? "unknown";
    }

    return correlationId ?? "unknown";
  },

  customProps(req) {
    return {
      correlationId: req.id,
    };
  },

  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
      };
    },

    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
