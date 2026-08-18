import { prisma } from "../../infrastructure/database/prisma.js";

export class HealthService {
  async checkDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  }
}
export const healthService = new HealthService();
