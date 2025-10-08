// database/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Cria conexão com o banco PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Log de conexão
pool.connect()
  .then(() => console.log('✅ Conectado ao banco PostgreSQL!'))
  .catch(err => console.error('❌ Erro ao conectar ao PostgreSQL:', err));

/**
 * Adaptação para manter compatibilidade com o estilo better-sqlite3:
 * - db.get(sql, params, callback)
 * - db.all(sql, params, callback)
 * - db.run(sql, params, callback)
 *
 * Todas as rotas do seu server.js continuam funcionando sem precisar alterar nada.
 */

function convertPlaceholders(sql) {
  // Converte '?' para '$1', '$2', '$3'... (PostgreSQL usa parâmetros numerados)
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

module.exports = {
  /**
   * SELECT * FROM ... → retorna várias linhas
   */
  all(sql, params = [], callback) {
    const query = convertPlaceholders(sql);
    pool.query(query, params)
      .then(res => callback && callback(null, res.rows))
      .catch(err => {
        console.error('❌ Erro em db.all:', err.message);
        callback && callback(err);
      });
  },

  /**
   * SELECT * FROM ... LIMIT 1 → retorna uma única linha
   */
  get(sql, params = [], callback) {
    const query = convertPlaceholders(sql);
    pool.query(query, params)
      .then(res => callback && callback(null, res.rows[0]))
      .catch(err => {
        console.error('❌ Erro em db.get:', err.message);
        callback && callback(err);
      });
  },

  /**
   * INSERT, UPDATE ou DELETE → executa e retorna metadados
   */
  run(sql, params = [], callback) {
    const query = convertPlaceholders(sql);
    pool.query(query, params)
      .then(res => {
        // Simula o "this" do better-sqlite3
        const fakeThis = {
          lastID: res.insertId || null,
          changes: res.rowCount,
        };
        if (callback) callback.call(fakeThis, null);
      })
      .catch(err => {
        console.error('❌ Erro em db.run:', err.message);
        if (callback) callback(err);
      });
  },

  /**
   * Suporte opcional a async/await
   */
  async query(sql, params = []) {
    const query = convertPlaceholders(sql);
    const res = await pool.query(query, params);
    return res.rows;
  },
};
