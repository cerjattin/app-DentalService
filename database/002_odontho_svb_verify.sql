-- ODONTHO SERVICES — SVB BILLING APP
-- Verification queries after applying 001_odontho_svb_schema.sql

USE odontho_svb_billing;

SELECT VERSION() AS mysql_version;
SELECT DATABASE() AS active_database;

SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'odontho_svb_billing'
  AND table_type = 'BASE TABLE';

SELECT table_name, engine, table_collation
FROM information_schema.tables
WHERE table_schema = 'odontho_svb_billing'
ORDER BY table_name;

SELECT COUNT(*) AS foreign_key_count
FROM information_schema.referential_constraints
WHERE constraint_schema = 'odontho_svb_billing';

SELECT table_name, constraint_name
FROM information_schema.table_constraints
WHERE constraint_schema = 'odontho_svb_billing'
  AND constraint_type = 'CHECK'
ORDER BY table_name, constraint_name;

SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = 'odontho_svb_billing'
  AND constraint_type IN ('PRIMARY KEY','UNIQUE')
ORDER BY table_name, constraint_type, constraint_name;
