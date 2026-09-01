export const routePermissions: Record<string, string[]> = {
  reception: ['appointment.read', 'patient.read'],
  patients: ['patient.read'],
  appointments: ['appointment.read'],
  clinical: ['encounter.read', 'encounter.create', 'encounter.update'],
  invoices: ['invoice.read'],
  declarations: ['declaration.read'],
  admin: ['user.read', 'provider.read', 'role.read'],
}
