import "dotenv/config";

import { prisma } from "../src/lib/prisma.js";

const permissions = [
  ["dashboard.read", "Ver dashboard", "Acceso al dashboard operativo."],

  ["organization.read", "Ver organización", "Consultar datos de la organización."],
  ["organization.update", "Actualizar organización", "Modificar datos administrativos de la organización."],
  ["clinic_location.read", "Ver sedes", "Consultar sedes/policlínicas."],
  ["clinic_location.manage", "Gestionar sedes", "Crear y actualizar sedes/policlínicas."],

  ["user.read", "Ver usuarios", "Consultar usuarios."],
  ["user.create", "Crear usuarios", "Crear cuentas de usuario."],
  ["user.update", "Actualizar usuarios", "Actualizar cuentas y estados."],
  ["user.assign_roles", "Asignar roles", "Asignar o retirar roles a usuarios."],
  ["role.read", "Ver roles", "Consultar roles y permisos."],
  ["role.manage", "Gestionar roles", "Administrar roles y sus permisos."],

  ["provider.read", "Ver profesionales", "Consultar profesionales."],
  ["provider.create", "Crear profesionales", "Registrar profesionales."],
  ["provider.update", "Actualizar profesionales", "Actualizar profesionales y Provider ID SVB."],

  ["patient.read", "Ver pacientes", "Consultar pacientes."],
  ["patient.create", "Crear pacientes", "Registrar pacientes."],
  ["patient.update", "Actualizar pacientes", "Actualizar información de pacientes."],
  ["patient.archive", "Archivar pacientes", "Archivar pacientes sin eliminar historia."],

  ["insurance.read", "Ver coberturas", "Consultar cobertura/Insured ID."],
  ["insurance.create", "Crear coberturas", "Registrar cobertura de un paciente."],
  ["insurance.update", "Actualizar coberturas", "Actualizar vigencia y estado de cobertura."],
  ["insurance.verify", "Verificar cobertura", "Registrar verificación de cobertura/Insured ID."],

  ["appointment.read", "Ver citas", "Consultar agenda y citas."],
  ["appointment.create", "Crear citas", "Crear citas."],
  ["appointment.update", "Actualizar citas", "Actualizar programación de citas."],
  ["appointment.check_in", "Recibir paciente", "Marcar llegada/check-in."],
  ["appointment.start", "Iniciar cita", "Cambiar la cita a atención en progreso."],
  ["appointment.complete", "Completar cita", "Completar el flujo de atención de la cita."],
  ["appointment.cancel", "Cancelar cita", "Cancelar una cita con motivo."],

  ["encounter.read", "Ver atenciones", "Consultar atenciones clínicas."],
  ["encounter.create", "Crear atención", "Abrir atención clínica desde una cita."],
  ["encounter.update", "Actualizar atención", "Actualizar atención clínica abierta."],
  ["encounter.complete", "Completar atención", "Finalizar una atención clínica."],
  ["encounter.void", "Invalidar atención", "Invalidar formalmente una atención conservando trazabilidad."],

  ["diagnosis.read", "Ver diagnósticos", "Consultar catálogo diagnóstico."],
  ["diagnosis.assign", "Asignar diagnósticos", "Asignar diagnósticos a una atención."],

  ["svb_procedure.read", "Ver catálogo SVB", "Consultar procedimientos SVB."],
  ["svb_procedure.manage", "Gestionar catálogo SVB", "Administrar maestro de procedimientos SVB."],
  ["svb_tariff.read", "Ver tarifas SVB", "Consultar tarifas SVB."],
  ["svb_tariff.manage", "Gestionar tarifas SVB", "Administrar tarifas y vigencias SVB."],

  ["authorization.read", "Ver autorizaciones", "Consultar autorizaciones SVB."],
  ["authorization.create", "Crear autorizaciones", "Registrar autorizaciones SVB."],
  ["authorization.update", "Actualizar autorizaciones", "Actualizar autorización y consumos."],

  ["procedure.read", "Ver procedimientos realizados", "Consultar procedimientos realizados."],
  ["procedure.add", "Agregar procedimientos", "Registrar procedimientos realizados."],
  ["procedure.update", "Actualizar procedimientos", "Actualizar procedimientos mientras el encuentro sea editable."],
  ["procedure.void", "Invalidar procedimientos", "Invalidar un procedimiento con trazabilidad."],

  ["invoice.read", "Ver facturas", "Consultar facturas y versiones."],
  ["invoice.create", "Crear factura", "Crear factura lógica desde una cita completada."],
  ["invoice.prepare_signature", "Preparar firma", "Congelar borrador y prepararlo para firma."],
  ["invoice.sign", "Confirmar factura firmada", "Confirmar transición de una versión firmada."],
  ["invoice.close", "Cerrar factura", "Cerrar una factura firmada."],
  ["invoice.request_correction", "Solicitar corrección", "Solicitar corrección formal de una factura."],
  ["invoice.apply_correction", "Aplicar corrección", "Crear/aplicar una nueva versión correctiva."],
  ["invoice.cancel", "Cancelar borrador", "Cancelar una factura cuando las reglas lo permitan."],

  ["signature.capture", "Capturar firma", "Capturar firma del paciente/representante."],
  ["signature.void", "Invalidar firma", "Invalidar una firma con motivo y trazabilidad."],

  ["document.read", "Ver documentos", "Consultar documentos vinculados."],
  ["document.generate", "Generar documentos", "Generar documentos/PDF."],
  ["document.upload", "Cargar documentos", "Adjuntar documentos de soporte."],

  ["declaration.read", "Ver declaraciones", "Consultar batches y líneas declaradas."],
  ["declaration.create", "Crear declaraciones", "Crear un batch de declaración."],
  ["declaration.update", "Actualizar declaraciones", "Actualizar un batch mientras sea editable."],
  ["declaration.export", "Exportar declaraciones", "Generar CSV/TXT/XLSX/JSON/XML u otro adaptador."],
  ["declaration.submit", "Radicar declaraciones", "Registrar/enviar una declaración a SVB."],

  ["audit.read", "Ver auditoría", "Consultar trazabilidad y audit logs."],
  ["settings.read", "Ver configuración", "Consultar configuración funcional."],
  ["settings.update", "Actualizar configuración", "Modificar configuración funcional no secreta."],
] as const;

const receptionPermissions = [
  "dashboard.read",
  "organization.read",
  "clinic_location.read",
  "provider.read",
  "patient.read",
  "patient.create",
  "patient.update",
  "insurance.read",
  "insurance.create",
  "insurance.update",
  "insurance.verify",
  "appointment.read",
  "appointment.create",
  "appointment.update",
  "appointment.check_in",
  "appointment.cancel",
  "encounter.read",
  "diagnosis.read",
  "svb_procedure.read",
  "svb_tariff.read",
  "authorization.read",
  "authorization.create",
  "authorization.update",
  "procedure.read",
  "invoice.read",
  "invoice.create",
  "invoice.prepare_signature",
  "invoice.sign",
  "invoice.close",
  "invoice.request_correction",
  "signature.capture",
  "document.read",
  "document.generate",
  "document.upload",
  "declaration.read",
] as const;

const providerPermissions = [
  "dashboard.read",
  "organization.read",
  "clinic_location.read",
  "provider.read",
  "patient.read",
  "insurance.read",
  "appointment.read",
  "appointment.start",
  "appointment.complete",
  "encounter.read",
  "encounter.create",
  "encounter.update",
  "encounter.complete",
  "diagnosis.read",
  "diagnosis.assign",
  "svb_procedure.read",
  "svb_tariff.read",
  "authorization.read",
  "procedure.read",
  "procedure.add",
  "procedure.update",
  "procedure.void",
  "invoice.read",
  "invoice.create",
  "invoice.prepare_signature",
  "invoice.sign",
  "signature.capture",
  "document.read",
  "document.generate",
] as const;

const roles = [
  {
    code: "ADMIN",
    name: "Administrador",
    description: "Administración completa del sistema.",
  },
  {
    code: "RECEPTION",
    name: "Recepción",
    description:
      "Registro de pacientes, seguros, citas y flujo administrativo de facturación.",
  },
  {
    code: "PROVIDER",
    name: "Profesional",
    description:
      "Atención clínica, diagnósticos, procedimientos y revisión de facturación clínica.",
  },
] as const;

function curacaoYear(): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Curacao",
    year: "numeric",
  }).format(new Date());

  return Number(value);
}

async function syncRolePermissions(
  roleCode: string,
  desiredPermissionCodes: readonly string[],
) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: roleCode },
    select: { id: true },
  });

  const permissionRows = await prisma.permission.findMany({
    where: {
      code: { in: [...desiredPermissionCodes] },
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (permissionRows.length !== desiredPermissionCodes.length) {
    const found = new Set(permissionRows.map((item) => item.code));
    const missing = desiredPermissionCodes.filter((code) => !found.has(code));

    throw new Error(
      `Missing permissions for role ${roleCode}: ${missing.join(", ")}`,
    );
  }

  const desiredIds = permissionRows.map((permission) => permission.id);

  // System roles are controlled by this seed. Remove mappings that no longer
  // belong to the canonical role definition, but never touch custom roles.
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: role.id,
      permissionId: {
        notIn: desiredIds,
      },
    },
  });

  await prisma.rolePermission.createMany({
    data: desiredIds.map((permissionId) => ({
      roleId: role.id,
      permissionId,
    })),
    skipDuplicates: true,
  });
}

async function main() {
  console.log("=== ODONTHO CORE PRISMA SEED ===");

  let organization = await prisma.organization.findFirst({
    where: {
      legalName: "Odontho Services B.V.",
    },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        legalName: "Odontho Services B.V.",
        tradeName: "Odontho Services",
        city: "Willemstad",
        countryCode: "CW",
        timezone: "America/Curacao",
        isActive: true,
      },
    });
  } else {
    organization = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        tradeName: "Odontho Services",
        city: "Willemstad",
        countryCode: "CW",
        timezone: "America/Curacao",
        isActive: true,
        // declarantId is intentionally NOT touched by the seed.
      },
    });
  }

  await prisma.clinicLocation.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "MAIN",
      },
    },
    update: {
      name: "Odontho Services - Brievengat",
      city: "Willemstad",
      countryCode: "CW",
      isActive: true,
      // policlinicCode is intentionally NOT touched by the seed.
    },
    create: {
      organizationId: organization.id,
      code: "MAIN",
      name: "Odontho Services - Brievengat",
      city: "Willemstad",
      countryCode: "CW",
      isActive: true,
    },
  });

  await prisma.payer.upsert({
    where: { code: "SVB" },
    update: {
      name: "Sociale Verzekeringsbank Curaçao",
      payerType: "STATE_INSURANCE",
      isActive: true,
    },
    create: {
      code: "SVB",
      name: "Sociale Verzekeringsbank Curaçao",
      payerType: "STATE_INSURANCE",
      isActive: true,
    },
  });

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
        isActive: true,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
        isActive: true,
      },
    });
  }

  for (const [code, name, description] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {
        name,
        description,
      },
      create: {
        code,
        name,
        description,
      },
    });
  }

  const allPermissionCodes = permissions.map(([code]) => code);

  await syncRolePermissions("ADMIN", allPermissionCodes);
  await syncRolePermissions("RECEPTION", receptionPermissions);
  await syncRolePermissions("PROVIDER", providerPermissions);

  const year = curacaoYear();

  const sequences = [
    {
      sequenceType: "PATIENT" as const,
      sequenceYear: 0,
      prefix: "PAT-",
    },
    {
      sequenceType: "APPOINTMENT" as const,
      sequenceYear: year,
      prefix: "APT-",
    },
    {
      sequenceType: "INVOICE" as const,
      sequenceYear: year,
      prefix: "OS-",
    },
    {
      sequenceType: "DECLARATION" as const,
      sequenceYear: year,
      prefix: "SVB-",
    },
  ];

  for (const sequence of sequences) {
    await prisma.numberSequence.upsert({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId: organization.id,
          sequenceType: sequence.sequenceType,
          sequenceYear: sequence.sequenceYear,
        },
      },
      // Never reset currentValue when the seed is executed again.
      update: {
        prefix: sequence.prefix,
        padding: 6,
      },
      create: {
        organizationId: organization.id,
        sequenceType: sequence.sequenceType,
        sequenceYear: sequence.sequenceYear,
        prefix: sequence.prefix,
        currentValue: 0n,
        padding: 6,
      },
    });
  }

  const settings = [
    {
      key: "app.timezone",
      value: "America/Curacao",
      description: "Zona horaria operacional.",
    },
    {
      key: "billing.signature_required",
      value: true,
      description: "Requiere firma antes del cierre de factura.",
    },
    {
      key: "billing.allow_signed_invoice_edit",
      value: false,
      description: "Impide edición destructiva de versiones firmadas.",
    },
    {
      key: "billing.allow_closed_invoice_edit",
      value: false,
      description: "Impide edición destructiva de versiones cerradas.",
    },
    {
      key: "billing.allow_declared_invoice_edit",
      value: false,
      description: "Impide edición destructiva de facturas declaradas.",
    },
    {
      key: "documents.storage_mode",
      value: "LOCAL_FILESYSTEM",
      description: "Modo inicial de almacenamiento documental.",
    },
    {
      key: "documents.hash_algorithm",
      value: "SHA-256",
      description: "Algoritmo para integridad de archivos/documentos.",
    },
    {
      key: "audit.enabled",
      value: true,
      description: "Auditoría funcional habilitada.",
    },
  ] as const;

  for (const setting of settings) {
    const existing = await prisma.systemSetting.findUnique({
      where: {
        organizationId_settingKey: {
          organizationId: organization.id,
          settingKey: setting.key,
        },
      },
      select: { id: true },
    });

    if (existing) {
      // Preserve the configured runtime value on repeated seed executions.
      await prisma.systemSetting.update({
        where: { id: existing.id },
        data: {
          description: setting.description,
          isSecret: false,
        },
      });
    } else {
      await prisma.systemSetting.create({
        data: {
          organizationId: organization.id,
          settingKey: setting.key,
          settingValue: setting.value,
          description: setting.description,
          isSecret: false,
        },
      });
    }
  }

  console.log(`Organization: ${organization.legalName}`);
  console.log(`Permissions: ${permissions.length}`);
  console.log(`RECEPTION permissions: ${receptionPermissions.length}`);
  console.log(`PROVIDER permissions: ${providerPermissions.length}`);
  console.log(`Sequence year: ${year}`);
  console.log("✅ Core seed completed.");
  console.log(
    "ℹ️ declarantId, policlinicCode, providers, SVB master procedures/tariffs and user passwords are not seeded here.",
  );
}

main()
  .catch((error) => {
    console.error("❌ Core seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
