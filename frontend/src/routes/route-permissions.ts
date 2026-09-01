export const routePermissions: Record<string, string[]> = {
  reception: ['appointment.read'],
  patients: ['patient.read'],
  appointments: ['appointment.read'],
  clinical: ['encounter.read'],
  invoices: ['invoice.read'],
  declarations: ['declaration.read'],
  admin: ['user.read', 'provider.read', 'role.read'],
}
