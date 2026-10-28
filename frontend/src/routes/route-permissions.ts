export const routePermissions: Record<string, string[]> = {
  reception: ['appointment.read'],
  patients: ['patient.read'],
  appointments: ['appointment.read'],
  clinical: ['encounter.read'],
  invoices: ['invoice.read'],
  declarations: ['declaration.read'],
  services: ['svb_procedure.read'],
  admin: ['user.read', 'provider.read', 'role.read', 'svb_procedure.read'],
}
