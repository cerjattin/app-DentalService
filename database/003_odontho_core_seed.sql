-- ODONTHO SERVICES — SVB BILLING APP
-- Core seed v0.1
-- Safe baseline seed: organization, main location, payer, RBAC, sequences and settings.
-- Deliberately does NOT create users/providers/SVB master tariffs because real credentials/IDs/data are required.

USE odontho_svb_billing;

START TRANSACTION;

-- =========================================================
-- 01. ORGANIZATION
-- =========================================================
INSERT INTO organizations (
  legal_name, trade_name, declarant_id, city, country_code, timezone, is_active
)
SELECT
  'Odontho Services B.V.', 'Odontho Services', NULL, 'Willemstad', 'CW', 'America/Curacao', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE legal_name = 'Odontho Services B.V.'
);

SET @org_id := (
  SELECT id
  FROM organizations
  WHERE legal_name = 'Odontho Services B.V.'
  ORDER BY id
  LIMIT 1
);

-- Main location. policlinic_code intentionally NULL until the official SVB value is known.
INSERT INTO clinic_locations (
  organization_id, code, name, policlinic_code, city, country_code, is_active
)
SELECT
  @org_id, 'MAIN', 'Odontho Services - Brievengat', NULL, 'Willemstad', 'CW', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM clinic_locations
  WHERE organization_id = @org_id AND code = 'MAIN'
);

-- =========================================================
-- 02. PAYER
-- =========================================================
INSERT IGNORE INTO payers (code, name, payer_type, is_active)
VALUES ('SVB', 'Sociale Verzekeringsbank Curaçao', 'STATE_INSURANCE', TRUE);

-- =========================================================
-- 03. ROLES
-- =========================================================
INSERT IGNORE INTO roles (code, name, description, is_system, is_active) VALUES
('ADMIN', 'Administrador', 'Administración completa del sistema.', TRUE, TRUE),
('RECEPTION', 'Recepción', 'Registro de pacientes, seguros, citas y flujo administrativo de facturación.', TRUE, TRUE),
('PROVIDER', 'Profesional', 'Atención clínica, diagnósticos, procedimientos y revisión de facturación clínica.', TRUE, TRUE);

-- =========================================================
-- 04. PERMISSIONS
-- =========================================================
INSERT IGNORE INTO permissions (code, name, description) VALUES
('dashboard.read', 'Ver dashboard', 'Acceso al dashboard operativo.'),

('organization.read', 'Ver organización', 'Consultar datos de la organización.'),
('organization.update', 'Actualizar organización', 'Modificar datos administrativos de la organización.'),
('clinic_location.read', 'Ver sedes', 'Consultar sedes/policlínicas.'),
('clinic_location.manage', 'Gestionar sedes', 'Crear y actualizar sedes/policlínicas.'),

('user.read', 'Ver usuarios', 'Consultar usuarios.'),
('user.create', 'Crear usuarios', 'Crear cuentas de usuario.'),
('user.update', 'Actualizar usuarios', 'Actualizar cuentas y estados.'),
('user.assign_roles', 'Asignar roles', 'Asignar o retirar roles a usuarios.'),
('role.read', 'Ver roles', 'Consultar roles y permisos.'),
('role.manage', 'Gestionar roles', 'Administrar roles y sus permisos.'),

('provider.read', 'Ver profesionales', 'Consultar profesionales.'),
('provider.create', 'Crear profesionales', 'Registrar profesionales.'),
('provider.update', 'Actualizar profesionales', 'Actualizar profesionales y Provider ID SVB.'),

('patient.read', 'Ver pacientes', 'Consultar pacientes.'),
('patient.create', 'Crear pacientes', 'Registrar pacientes.'),
('patient.update', 'Actualizar pacientes', 'Actualizar información de pacientes.'),
('patient.archive', 'Archivar pacientes', 'Archivar pacientes sin eliminar historia.'),

('insurance.read', 'Ver coberturas', 'Consultar cobertura/Insured ID.'),
('insurance.create', 'Crear coberturas', 'Registrar cobertura de un paciente.'),
('insurance.update', 'Actualizar coberturas', 'Actualizar vigencia y estado de cobertura.'),
('insurance.verify', 'Verificar cobertura', 'Registrar verificación de cobertura/Insured ID.'),

('appointment.read', 'Ver citas', 'Consultar agenda y citas.'),
('appointment.create', 'Crear citas', 'Crear citas.'),
('appointment.update', 'Actualizar citas', 'Actualizar programación de citas.'),
('appointment.check_in', 'Recibir paciente', 'Marcar llegada/check-in.'),
('appointment.start', 'Iniciar cita', 'Cambiar la cita a atención en progreso.'),
('appointment.complete', 'Completar cita', 'Completar el flujo de atención de la cita.'),
('appointment.cancel', 'Cancelar cita', 'Cancelar una cita con motivo.'),

('encounter.read', 'Ver atenciones', 'Consultar atenciones clínicas.'),
('encounter.create', 'Crear atención', 'Abrir atención clínica desde una cita.'),
('encounter.update', 'Actualizar atención', 'Actualizar atención clínica abierta.'),
('encounter.complete', 'Completar atención', 'Finalizar una atención clínica.'),
('encounter.void', 'Invalidar atención', 'Invalidar formalmente una atención conservando trazabilidad.'),

('diagnosis.read', 'Ver diagnósticos', 'Consultar catálogo diagnóstico.'),
('diagnosis.assign', 'Asignar diagnósticos', 'Asignar diagnósticos a una atención.'),

('svb_procedure.read', 'Ver catálogo SVB', 'Consultar procedimientos SVB.'),
('svb_procedure.manage', 'Gestionar catálogo SVB', 'Administrar maestro de procedimientos SVB.'),
('svb_tariff.read', 'Ver tarifas SVB', 'Consultar tarifas SVB.'),
('svb_tariff.manage', 'Gestionar tarifas SVB', 'Administrar tarifas y vigencias SVB.'),

('authorization.read', 'Ver autorizaciones', 'Consultar autorizaciones SVB.'),
('authorization.create', 'Crear autorizaciones', 'Registrar autorizaciones SVB.'),
('authorization.update', 'Actualizar autorizaciones', 'Actualizar autorización y consumos.'),

('procedure.read', 'Ver procedimientos realizados', 'Consultar procedimientos realizados.'),
('procedure.add', 'Agregar procedimientos', 'Registrar procedimientos realizados.'),
('procedure.update', 'Actualizar procedimientos', 'Actualizar procedimientos mientras el encuentro sea editable.'),
('procedure.void', 'Invalidar procedimientos', 'Invalidar un procedimiento con trazabilidad.'),

('invoice.read', 'Ver facturas', 'Consultar facturas y versiones.'),
('invoice.create', 'Crear factura', 'Crear factura lógica desde una cita completada.'),
('invoice.prepare_signature', 'Preparar firma', 'Congelar borrador y prepararlo para firma.'),
('invoice.sign', 'Confirmar factura firmada', 'Confirmar transición de una versión firmada.'),
('invoice.close', 'Cerrar factura', 'Cerrar una factura firmada.'),
('invoice.request_correction', 'Solicitar corrección', 'Solicitar corrección formal de una factura.'),
('invoice.apply_correction', 'Aplicar corrección', 'Crear/aplicar una nueva versión correctiva.'),
('invoice.cancel', 'Cancelar borrador', 'Cancelar una factura cuando las reglas lo permitan.'),

('signature.capture', 'Capturar firma', 'Capturar firma del paciente/representante.'),
('signature.void', 'Invalidar firma', 'Invalidar una firma con motivo y trazabilidad.'),

('document.read', 'Ver documentos', 'Consultar documentos vinculados.'),
('document.generate', 'Generar documentos', 'Generar documentos/PDF.'),
('document.upload', 'Cargar documentos', 'Adjuntar documentos de soporte.'),

('declaration.read', 'Ver declaraciones', 'Consultar batches y líneas declaradas.'),
('declaration.create', 'Crear declaraciones', 'Crear un batch de declaración.'),
('declaration.update', 'Actualizar declaraciones', 'Actualizar un batch mientras sea editable.'),
('declaration.export', 'Exportar declaraciones', 'Generar CSV/TXT/XLSX/JSON/XML u otro adaptador.'),
('declaration.submit', 'Radicar declaraciones', 'Registrar/envíar una declaración a SVB.'),

('audit.read', 'Ver auditoría', 'Consultar trazabilidad y audit logs.'),
('settings.read', 'Ver configuración', 'Consultar configuración funcional.'),
('settings.update', 'Actualizar configuración', 'Modificar configuración funcional no secreta.');

-- =========================================================
-- 05. ROLE PERMISSIONS
-- =========================================================
-- ADMIN receives every permission.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN';

-- RECEPTION: patient intake, appointment management and administrative billing/signature workflow.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.read',
  'organization.read', 'clinic_location.read', 'provider.read',
  'patient.read', 'patient.create', 'patient.update',
  'insurance.read', 'insurance.create', 'insurance.update', 'insurance.verify',
  'appointment.read', 'appointment.create', 'appointment.update', 'appointment.check_in', 'appointment.cancel',
  'encounter.read',
  'diagnosis.read',
  'svb_procedure.read', 'svb_tariff.read',
  'authorization.read', 'authorization.create', 'authorization.update',
  'procedure.read',
  'invoice.read', 'invoice.create', 'invoice.prepare_signature', 'invoice.sign', 'invoice.close',
  'invoice.request_correction',
  'signature.capture',
  'document.read', 'document.generate', 'document.upload',
  'declaration.read'
)
WHERE r.code = 'RECEPTION';

-- PROVIDER: clinical care, procedures and the signature-ready billing workflow.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.read',
  'organization.read', 'clinic_location.read', 'provider.read',
  'patient.read', 'insurance.read',
  'appointment.read', 'appointment.start', 'appointment.complete',
  'encounter.read', 'encounter.create', 'encounter.update', 'encounter.complete',
  'diagnosis.read', 'diagnosis.assign',
  'svb_procedure.read', 'svb_tariff.read', 'authorization.read',
  'procedure.read', 'procedure.add', 'procedure.update', 'procedure.void',
  'invoice.read', 'invoice.create', 'invoice.prepare_signature', 'invoice.sign',
  'signature.capture',
  'document.read', 'document.generate'
)
WHERE r.code = 'PROVIDER';

-- =========================================================
-- 06. NUMBER SEQUENCES
-- =========================================================
SET @current_year := YEAR(CURDATE());

INSERT IGNORE INTO number_sequences
  (organization_id, sequence_type, sequence_year, prefix, current_value, padding)
VALUES
  (@org_id, 'PATIENT',     0,             'PAT-', 0, 6),
  (@org_id, 'APPOINTMENT', @current_year, 'APT-', 0, 6),
  (@org_id, 'INVOICE',     @current_year, 'OS-',  0, 6),
  (@org_id, 'DECLARATION', @current_year, 'SVB-', 0, 6);

-- =========================================================
-- 07. SYSTEM SETTINGS
-- No secrets are seeded into the database.
-- =========================================================
INSERT INTO system_settings
  (organization_id, setting_key, setting_value, description, is_secret)
SELECT @org_id, 'app.timezone', JSON_QUOTE('America/Curacao'), 'Zona horaria operacional.', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE organization_id=@org_id AND setting_key='app.timezone'
);

INSERT INTO system_settings
  (organization_id, setting_key, setting_value, description, is_secret)
SELECT @org_id, 'billing.signature_required', 'true', 'Requiere firma antes del cierre de factura.', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE organization_id=@org_id AND setting_key='billing.signature_required'
);

INSERT INTO system_settings
  (organization_id, setting_key, setting_value, description, is_secret)
SELECT @org_id, 'billing.allow_signed_invoice_edit', 'false', 'Impide edición destructiva de versiones firmadas.', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE organization_id=@org_id AND setting_key='billing.allow_signed_invoice_edit'
);

INSERT INTO system_settings
  (organization_id, setting_key, setting_value, description, is_secret)
SELECT @org_id, 'billing.allow_closed_invoice_edit', 'false', 'Impide edición destructiva de versiones cerradas.', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE organization_id=@org_id AND setting_key='billing.allow_closed_invoice_edit'
);

INSERT INTO system_settings
  (organization_id, setting_key, setting_value, description, is_secret)
SELECT @org_id, 'billing.allow_declared_invoice_edit', 'false', 'Impide edición destructiva de facturas declaradas.', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE organization_id=@org_id AND setting_key='billing.allow_declared_invoice_edit'
);

INSERT INTO system_settings
  (organization_id, setting_key, setting_value, description, is_secret)
SELECT @org_id, 'documents.storage_mode', JSON_QUOTE('LOCAL_FILESYSTEM'), 'Modo inicial de almacenamiento documental.', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE organization_id=@org_id AND setting_key='documents.storage_mode'
);

INSERT INTO system_settings
  (organization_id, setting_key, setting_value, description, is_secret)
SELECT @org_id, 'documents.hash_algorithm', JSON_QUOTE('SHA-256'), 'Algoritmo para integridad de archivos/documentos.', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE organization_id=@org_id AND setting_key='documents.hash_algorithm'
);

INSERT INTO system_settings
  (organization_id, setting_key, setting_value, description, is_secret)
SELECT @org_id, 'audit.enabled', 'true', 'Auditoría funcional habilitada.', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE organization_id=@org_id AND setting_key='audit.enabled'
);

COMMIT;

-- Important values intentionally left pending until real data is available:
-- organizations.declarant_id
-- clinic_locations.policlinic_code
-- providers / providers.svb_provider_id
-- SVB procedures and tariffs
-- first ADMIN user (must be created with a real bcrypt/argon2 password hash in the application/Prisma seed)
