// backend/database/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Cria pool de conexão com PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Testa conexão inicial
pool.connect()
  .then(() => console.log('✅ Conectado ao banco PostgreSQL!'))
  .catch(err => console.error('❌ Erro ao conectar ao PostgreSQL:', err));

/**
 * Converte placeholders estilo SQLite (?) para estilo PostgreSQL ($1, $2, ...).
 */
function convertPlaceholders(sql) {
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

/**
 * Normaliza parâmetros: converte undefined em null (PostgreSQL não aceita undefined)
 */
function normalizeParams(params = []) {
  return params.map(p => (p === undefined ? null : p));
}

module.exports = {
  /**
   * Executa SELECT e retorna várias linhas (equivalente a db.all)
   */
  all(sql, params = [], callback) {
    const query = convertPlaceholders(sql);
    const safeParams = normalizeParams(params);
    pool.query(query, safeParams)
      .then(res => callback && callback(null, res.rows))
      .catch(err => {
        console.error('❌ Erro em db.all:', err.message);
        callback && callback(err);
      });
  },

  /**
   * Executa SELECT e retorna apenas a primeira linha (equivalente a db.get)
   */
  get(sql, params = [], callback) {
    const query = convertPlaceholders(sql);
    const safeParams = normalizeParams(params);
    pool.query(query, safeParams)
      .then(res => callback && callback(null, res.rows[0] || null))
      .catch(err => {
        console.error('❌ Erro em db.get:', err.message);
        callback && callback(err);
      });
  },

  /**
   * Executa INSERT, UPDATE ou DELETE (equivalente a db.run)
   */
  run(sql, params = [], callback) {
    const query = convertPlaceholders(sql);
    const safeParams = normalizeParams(params);
    pool.query(query, safeParams)
      .then(res => {
        const fakeThis = {
          lastID: res.rows?.[0]?.id || null, // PostgreSQL não tem insertId nativo
          changes: res.rowCount || 0,
        };
        if (callback) callback.call(fakeThis, null);
      })
      .catch(err => {
        console.error('❌ Erro em db.run:', err.message);
        if (callback) callback(err);
      });
  },

  /**
   * Suporte a async/await — ideal para consultas mais modernas
   */
  async query(sql, params = []) {
    const query = convertPlaceholders(sql);
    const safeParams = normalizeParams(params);
    const res = await pool.query(query, safeParams);
    return res.rows;
  },
};
