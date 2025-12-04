/**
 * RDS/Aurora 연결을 위한 DB 헬퍼.
 * IMPLEMENTATION STATUS:
 * - MySQL(Aurora Serverless) 설정 및 커넥션 풀 초기화: OK (env 기반, lazy)
 * - JSON 파일 기반 fallback은 각 repository에서 처리: OK
 * - PostgreSQL/실제 AWS 자격 증명 연동: TODO (AWS 환경 필요)
 */

import type { Pool } from 'mysql2/promise';
import { createPool } from 'mysql2/promise';
import { logger } from './logger';
import { ENV } from './env';

export type DbDialect = 'mysql' | 'postgres';

export type DbConfig = {
  enabled: boolean;
  dialect: DbDialect;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
};

export type DbClient = {
  dialect: DbDialect;
  query<T = unknown>(sql: string, params?: Array<string | number | null>): Promise<T[]>;
};

const DEFAULT_DB_CONFIG: DbConfig = {
  enabled: false,
  dialect: 'mysql',
  host: 'localhost',
  port: 3306,
  user: '',
  password: '',
  database: '',
  connectionLimit: 5,
};

function normalizeDialect(raw?: string): DbDialect {
  if (raw === 'postgres' || raw === 'pg') return 'postgres';
  return 'mysql';
}

export function getDbConfig(): DbConfig {
  const enabled = ENV.DB_ENABLED === 1;
  const dialect = normalizeDialect(ENV.DB_CLIENT);
  const port =
    ENV.DB_PORT && Number.isFinite(ENV.DB_PORT) ? ENV.DB_PORT : dialect === 'postgres' ? 5432 : 3306;

  return {
    enabled,
    dialect,
    host: ENV.DB_HOST || DEFAULT_DB_CONFIG.host,
    port,
    user: ENV.DB_USER || DEFAULT_DB_CONFIG.user,
    password: ENV.DB_PASSWORD || DEFAULT_DB_CONFIG.password,
    database: ENV.DB_NAME || DEFAULT_DB_CONFIG.database,
    connectionLimit: ENV.DB_CONNECTION_LIMIT ?? DEFAULT_DB_CONFIG.connectionLimit,
  };
}

let mysqlPool: Pool | null = null;

async function getMysqlPool(config: DbConfig): Promise<Pool> {
  if (mysqlPool) return mysqlPool;

  mysqlPool = createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit,
    enableKeepAlive: true,
    idleTimeout: 60000,
  });

  logger.info(
    { host: config.host, db: config.database, pool: config.connectionLimit },
    'Initialized MySQL pool for DB repository access'
  );

  return mysqlPool;
}

/**
 * DB 커넥션을 반환한다. DB 사용이 비활성화됐거나 설정이 부족하면 `undefined`를 반환하여
 * repository가 JSON fallback을 사용하게 한다.
 */
export async function getDbClient(): Promise<DbClient | undefined> {
  const config = getDbConfig();
  if (!config.enabled) return undefined;

  if (!config.host || !config.user || !config.database) {
    logger.warn(
      { host: config.host, user: config.user, database: config.database },
      'DB is enabled but configuration is incomplete; falling back to JSON store'
    );
    return undefined;
  }

  if (config.dialect === 'postgres') {
    logger.warn(
      { dialect: config.dialect },
      'PostgreSQL dialect requested but not implemented yet; using fallback store'
    );
    return undefined;
  }

  const pool = await getMysqlPool(config);

  return {
    dialect: 'mysql',
    async query<T = unknown>(sql: string, params?: Array<string | number | null>): Promise<T[]> {
      const [rows] = await pool.query(sql, params);
      return rows as T[];
    },
  };
}

export async function closeDb(): Promise<void> {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
  }
}
