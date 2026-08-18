export interface MySqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function parseMySqlDatabaseUrl(
  connectionString: string,
): MySqlConnectionConfig {
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  if (url.protocol !== "mysql:") {
    throw new Error(
      `Unsupported database protocol: ${url.protocol}. Expected mysql:`,
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  if (!url.hostname) {
    throw new Error("DATABASE_URL must contain a database host");
  }

  if (!url.username) {
    throw new Error("DATABASE_URL must contain a database user");
  }

  if (!database) {
    throw new Error("DATABASE_URL must contain a database name");
  }

  const port = url.port ? Number.parseInt(url.port, 10) : 3306;

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("DATABASE_URL contains an invalid database port");
  }

  return {
    host: url.hostname,
    port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}
