import type { AppointmentStatus } from "../../generated/prisma/client.js";

export const BLOCKING_APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
] satisfies AppointmentStatus[];

const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionAppointmentStatus(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return from === to || allowedTransitions[from].includes(to);
}

export function permissionForAppointmentStatus(status: AppointmentStatus) {
  switch (status) {
    case "CHECKED_IN":
      return "appointment.check_in";

    case "IN_PROGRESS":
      return "appointment.start";

    case "COMPLETED":
      return "appointment.complete";

    case "CANCELLED":
    case "NO_SHOW":
      return "appointment.cancel";

    case "SCHEDULED":
    case "CONFIRMED":
      return "appointment.update";
  }
}
