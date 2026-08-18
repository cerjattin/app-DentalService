-- ODONTHO SERVICES — SVB BILLING APP
-- Core seed verification

USE odontho_svb_billing;

SELECT id, legal_name, trade_name, declarant_id, timezone, is_active
FROM organizations
WHERE legal_name = 'Odontho Services B.V.';

SELECT id, organization_id, code, name, policlinic_code, city, country_code, is_active
FROM clinic_locations
WHERE code = 'MAIN';

SELECT id, code, name, payer_type, is_active
FROM payers
WHERE code = 'SVB';

SELECT code, name, is_system, is_active
FROM roles
ORDER BY code;

SELECT COUNT(*) AS permission_count
FROM permissions;

SELECT r.code AS role_code, COUNT(*) AS permission_count
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
GROUP BY r.id, r.code
ORDER BY r.code;

SELECT sequence_type, sequence_year, prefix, current_value, padding
FROM number_sequences
WHERE organization_id = (
  SELECT id FROM organizations WHERE legal_name='Odontho Services B.V.' ORDER BY id LIMIT 1
)
ORDER BY sequence_type, sequence_year;

SELECT setting_key, setting_value, is_secret
FROM system_settings
WHERE organization_id = (
  SELECT id FROM organizations WHERE legal_name='Odontho Services B.V.' ORDER BY id LIMIT 1
)
ORDER BY setting_key;
