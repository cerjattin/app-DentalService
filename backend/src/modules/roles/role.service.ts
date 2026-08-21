import { prisma } from "../../infrastructure/database/prisma.js";

export class RoleService {
  async list() {
    const roles = await prisma.role.findMany({
      where: {
        isActive: true,
      },

      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,

        rolePermissions: {
          select: {
            permission: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    });

    return roles.map((role) => ({
      id: role.id.toString(),

      code: role.code,

      name: role.name,

      description: role.description,

      isSystem: role.isSystem,

      permissions: role.rolePermissions.map(({ permission }) => ({
        code: permission.code,

        name: permission.name,
      })),
    }));
  }
}

export const roleService = new RoleService();
