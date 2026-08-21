import dotenv from "dotenv";

/*
 * Primero cargamos configuración específica
 * del entorno de tests.
 */
dotenv.config({
  path: ".env.test",
});

/*
 * Después cargamos .env para valores que
 * no existan en .env.test, principalmente
 * DATABASE_URL durante esta etapa local.
 *
 * dotenv no sobrescribe variables ya
 * definidas salvo que override=true.
 */
dotenv.config({
  path: ".env",
});

process.env.NODE_ENV = "test";
