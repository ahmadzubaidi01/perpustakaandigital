import { Sequelize } from 'sequelize';
import env from './environment';
import logger from '../utils/logger';

const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  timezone: '+00:00', // UTC timezone storage
  logging: env.DB_LOGGING
    ? (msg: string) => logger.debug(msg)
    : false,
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    acquire: env.DB_POOL_ACQUIRE,
    idle: env.DB_POOL_IDLE,
  },
  define: {
    timestamps: true,
    underscored: true,
    paranoid: false, // We handle soft deletes manually per model
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
  dialectOptions: {
    charset: 'utf8mb4',
    dateStrings: true,
    typeCast: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
  },
});

export default sequelize;
