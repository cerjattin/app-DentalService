import { Router, type RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  changeAppointmentStatus,
  createAppointment,
  getAppointment,
  listAppointments,
  updateAppointment,
} from "./appointment.controller.js";

import { permissionForAppointmentStatus } from "./appointment-status.js";
import { updateAppointmentStatusSchema } from "./appointment.schemas.js";

const requireStatusPermission: RequestHandler = (req, res, next) => {
  try {
    const input = updateAppointmentStatusSchema.parse(req.body);

    const permission = permissionForAppointmentStatus(input.status);

    requirePermission(permission)(req, res, next);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(error);
  }
};

export const appointmentRouter = Router();

appointmentRouter.use(authenticate);

appointmentRouter.get(
  "/",
  requirePermission("appointment.read"),
  listAppointments,
);

appointmentRouter.get(
  "/:id",
  requirePermission("appointment.read"),
  getAppointment,
);

appointmentRouter.post(
  "/",
  requirePermission("appointment.create"),
  createAppointment,
);

appointmentRouter.patch(
  "/:id",
  requirePermission("appointment.update"),
  updateAppointment,
);

appointmentRouter.patch(
  "/:id/status",
  requireStatusPermission,
  changeAppointmentStatus,
);
