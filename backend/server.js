// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const { pool } = require('./database/db');


// ⚠️ Usaremos só o wrapper do Postgres que você já tem:
const db = require('./database/db');

// Rotas/middlewares externos
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const { authenticateToken } = require('./middleware/auth');

// ===== Multer p/ upload em memória =====
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas.'));
  }
});

// ===== Pastas/db auxiliares =====
const dbDir = path.join(__dirname, 'db');
const logsFile = path.join(dbDir, 'arena_logs.json');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('📁 Pasta db criada automaticamente.');
}
if (!fs.existsSync(logsFile)) {
  fs.writeFileSync(logsFile, '[]', 'utf8');
  console.log('🪶 arena_logs.json criado automaticamente.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middlewares =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// =======================================================
// ✅ 1) ROTAS DA API
// =======================================================

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);

// --- TURMAS ---
app.get('/api/turmas', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT id, nome, diasAula, horario, dataInicio, tipo, duracao, finalizada, expandido, aulasDesativadas, planejamentos, alunos
    FROM turmas WHERE userId = $1 ORDER BY dataInicio DESC
  `;

  pool.query(sql, [userId])
    .then(result => {
      const turmas = result.rows.map(row => ({
        id: row.id,
        nome: row.nome || 'Turma sem nome',
        diasAula: safeParse(row.diasaula, []),
        horario: row.horario || '',
        dataInicio: row.datainicio || '',
        tipo: row.tipo || '',
        duracao: row.duracao || 3,
        finalizada: !!row.finalizada,
        expandido: !!row.expandido,
        aulasDesativadas: safeParse(row.aulasdesativadas, []),
        planejamentos: safeParse(row.planejamentos, {}),
        alunos: safeParse(row.alunos, [])
      }));
      res.json(turmas);
    })
    .catch(err => {
      console.error('❌ Erro ao buscar turmas:', err);
      res.status(500).json({ error: 'Erro ao buscar turmas.' });
    });
});

// ✅ Função utilitária que evita "undefined is not valid JSON"
function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}


// =======================================================
// 📘 CRIAR NOVA TURMA
// =======================================================
app.post('/api/turmas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      nome,
      diasAula,
      horario,
      dataInicio,
      tipo,
      duracao,
      alunos
    } = req.body;

    // 🔒 Garante que diasAula seja sempre um array
    const diasAulaSeguros = Array.isArray(diasAula) ? diasAula : [];

    const sql = `
      INSERT INTO turmas (
        userId, nome, diasAula, horario, dataInicio, tipo, duracao,
        alunos, finalizada, expandido, aulasDesativadas, planejamentos
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, false, '[]', '{}')
      RETURNING *
    `;

    const params = [
      userId,
      nome || 'Nova Turma',
      JSON.stringify(diasAulaSeguros),
      horario || '',
      dataInicio || '',
      tipo || '',
      duracao || 3,
      JSON.stringify(alunos || [])
    ];

    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('❌ Erro ao criar turma:', err);
    res.status(500).json({ error: 'Erro ao criar turma.' });
  }
});



// =======================================================
// ✏️ EDITAR TURMA EXISTENTE
// =======================================================
app.put('/api/turmas/:id', authenticateToken, async (req, res) => {
  try {
    const turmaId = req.params.id;
    const userId = req.user.id;

    const {
      nome,
      diasAula,
      horario,
      dataInicio,
      tipo,
      duracao,
      alunos,
      finalizada,
      expandido,
      aulasDesativadas,
      planejamentos
    } = req.body;

    // 🔒 Garante que diasAula seja sempre um array
    const diasAulaSeguros = Array.isArray(diasAula) ? diasAula : [];

    const sql = `
      UPDATE turmas
      SET nome = $1,
          diasAula = $2,
          horario = $3,
          dataInicio = $4,
          tipo = $5,
          duracao = $6,
          alunos = $7,
          finalizada = $8,
          expandido = $9,
          aulasDesativadas = $10,
          planejamentos = $11
      WHERE id = $12 AND userId = $13
      RETURNING *
    `;

    const params = [
      nome || 'Turma sem nome',
      JSON.stringify(diasAulaSeguros),
      horario || '',
      dataInicio || '',
      tipo || '',
      duracao || 3,
      JSON.stringify(alunos || []),
      finalizada ?? false,
      expandido ?? false,
      JSON.stringify(aulasDesativadas || []),
      JSON.stringify(planejamentos || {}),
      turmaId,
      userId
    ];

    const { rows } = await pool.query(sql, params);
    if (!rows.length) {
      return res.status(404).json({ error: 'Turma não encontrada ou sem permissão.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Erro ao atualizar turma:', err);
    res.status(500).json({ error: 'Erro ao atualizar turma.' });
  }
});




// DELETE /api/turmas/:id
app.delete('/api/turmas/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const turmaId = req.params.id;

  try {
    const sql = `
      DELETE FROM turmas
      WHERE id = $1 AND userId = $2
      RETURNING id, nome
    `;

    const result = await pool.query(sql, [turmaId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Turma não encontrada ou não pertence a este usuário.'
      });
    }

    res.json({
      success: true,
      message: `Turma "${result.rows[0].nome}" deletada com sucesso.`
    });

  } catch (err) {
    console.error('❌ Erro ao deletar turma:', err);
    res.status(500).json({ error: 'Erro ao deletar turma no banco.' });
  }
});


// --- ALUNOS ---
app.get('/api/alunos', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(`SELECT data FROM alunos WHERE userId = $1`, [userId]);
    if (rows.length === 0) return res.json([]);
    res.json(JSON.parse(rows[0].data));
  } catch (err) {
    console.error('❌ Erro ao buscar alunos:', err);
    res.status(500).json({ error: 'Erro ao buscar alunos.' });
  }
});

app.post('/api/alunos', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const alunos = req.body;
  const dataJson = JSON.stringify(alunos);

  try {
    const existing = await pool.query(`SELECT id FROM alunos WHERE userId = $1`, [userId]);

    // Função interna para inicializar arena
    const salvarAlunos = async () => {
      for (const a of alunos) {
        if (a.userId) {
          try {
            await pool.query(`
              INSERT INTO arena (alunoId, pvpAtivado)
              VALUES ($1, TRUE)
              ON CONFLICT (alunoId) DO NOTHING
            `, [a.userId]);
          } catch (err) {
            console.error('Erro ao inicializar arena para aluno:', a.userId, err);
          }
        }
      }
    };

    if (existing.rows.length > 0) {
      // UPDATE
      await pool.query(`UPDATE alunos SET data = $1 WHERE userId = $2`, [dataJson, userId]);
      await salvarAlunos();
      return res.json({ success: true });
    } else {
      // INSERT com RETURNING id
      const { rows } = await pool.query(
        `INSERT INTO alunos (userId, data) VALUES ($1, $2) RETURNING id`,
        [userId, dataJson]
      );
      await salvarAlunos();
      return res.json({ success: true, id: rows[0].id });
    }
  } catch (err) {
    console.error('❌ Erro ao salvar alunos:', err);
    res.status(500).json({ error: 'Erro no banco de dados.' });
  }
});


// --- ARENA ---

// Função auxiliar para JSON seguro
function safeJSON(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

// -------------------------------
// 🧩 1) Buscar alunos da arena
// -------------------------------
/** app.get('/api/arena/alunos', authenticateToken, async (req, res) => {
  const alunoCtr = req.user.username;
  try {
    const { rows: allRows } = await pool.query(`SELECT data FROM alunos`);
    if (!allRows.length) return res.json([]);

    // Minhas turmas
    let minhasTurmas = [];
    for (const row of allRows) {
      const alunos = safeJSON(row.data, []);
      const eu = alunos.find(a => a.ctr === alunoCtr);
      if (eu?.turmas) {
        minhasTurmas = eu.turmas;
        break;
      }
    }
    if (minhasTurmas.length === 0) return res.json([]);

    // Alunos das mesmas turmas
    const alunosDaTurma = [];
    for (const row of allRows) {
      const alunos = safeJSON(row.data, []);
      for (const aluno of alunos) {
        if (aluno.ctr !== alunoCtr && aluno.turmas?.some(tid => minhasTurmas.includes(tid))) {
          alunosDaTurma.push({
            userId: aluno.userId,
            ctr: aluno.ctr,
            nome: aluno.nome,
            pic: aluno.pic || 'assets/profile-placeholder.jpg',
            gold: aluno.gold || 0,
            equipamentos: aluno.equipamentos || {},
            _userId: aluno.userId
          });
        }
      }
    }

    // Remover duplicatas
    const map = new Map();
    alunosDaTurma.forEach(a => { if (!map.has(a.ctr)) map.set(a.ctr, a); });
    const unicos = Array.from(map.values());
    const ids = unicos.map(a => a._userId);
    if (!ids.length) return res.json([]);

    const { rows: arenaRows } = await pool.query(
      `SELECT alunoId, cansadoAte FROM arena WHERE alunoId = ANY($1::int[])`,
      [ids]
    );
    const cansacoMap = {};
    arenaRows.forEach(r => { cansacoMap[r.alunoid] = r.cansadoate; });

    const resultado = unicos.map(a => ({ ...a, cansadoAte: cansacoMap[a._userId] || null }));
    res.json(resultado);
  } catch (err) {
    console.error('❌ Erro em /api/arena/alunos:', err);
    res.status(500).json({ error: 'Erro ao buscar alunos da arena.' });
  }
}); **/
// GET /api/arena/alunos
app.get('/api/arena/alunos', authenticateToken, async (req, res) => {
  const alunoCtr = req.user.username;
  try {
    const { rows: allRows } = await pool.query(`SELECT data, userid FROM alunos`);
    if (!allRows.length) return res.json([]);

    // 1) Descobrir minhas turmas (do aluno logado)
    let minhasTurmas = [];
    for (const row of allRows) {
      const alunos = safeJSON(row.data, []);
      const eu = alunos.find(a => String(a.ctr) === String(alunoCtr));
      if (eu?.turmas) {
        minhasTurmas = eu.turmas;
        break;
      }
    }
    if (!Array.isArray(minhasTurmas) || minhasTurmas.length === 0) return res.json([]);

    // 2) Colecionar alunos das mesmas turmas (sem duplicatas)
    const mapa = new Map();
    for (const row of allRows) {
      const alunos = safeJSON(row.data, []);
      for (const aluno of alunos) {
        if (!aluno || aluno.ctr === alunoCtr) continue;
        if (!aluno.turmas || !aluno.turmas.some(tid => minhasTurmas.includes(tid))) continue;
        if (!mapa.has(aluno.ctr)) {
          mapa.set(aluno.ctr, {
            userId: aluno.userId || null,
            ctr: aluno.ctr,
            nome: aluno.nome,
            pic: aluno.pic || 'assets/profile-placeholder.jpg',
            gold: aluno.gold || 0,
            equipamentos: aluno.equipamentos || {},
            professorUserId: row.userid || null
          });
        }
      }
    }
    const unicos = Array.from(mapa.values());

    // 3) Somente IDs numéricos para consultar a tabela arena
    const numericIds = unicos
      .map(u => u.userId)
      .filter(id => Number.isInteger(id));

    let cansacoMap = {};
    if (numericIds.length > 0) {
      const { rows: arenaRows } = await pool.query(
        `SELECT alunoId, cansadoAte, pvpAtivado FROM arena WHERE alunoId = ANY($1::int[])`,
        [numericIds]
      );
      arenaRows.forEach(r => {
        cansacoMap[String(r.alunoid)] = {
          cansadoAte: r.cansadoate || null,
          pvpAtivado: r.pvpativado === undefined ? true : !!r.pvpativado
        };
      });
    }

    // 4) Monta resultado com idSeguro
    const resultado = unicos.map(u => {
      const infoArena = u.userId ? cansacoMap[String(u.userId)] || { cansadoAte: null, pvpAtivado: true } : { cansadoAte: null, pvpAtivado: true };
      return {
        ...u,
        cansadoAte: infoArena.cansadoAte || null,
        pvpAtivado: infoArena.pvpAtivado,
        idSeguro: u.userId || u.ctr,
        idEhNumero: Number.isInteger(u.userId)
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error('❌ Erro em /api/arena/alunos:', err);
    res.status(500).json({ error: 'Erro ao buscar alunos da arena.' });
  }
});



// -------------------------------
// 🧩 2) Meu estado / status PVP
// -------------------------------
app.get('/api/arena/meu-estado', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cansadoAte FROM arena WHERE alunoId = $1`, [req.user.id]
    );
    res.json({ cansadoAte: rows[0]?.cansadoate || null });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estado.' });
  }
});

app.get('/api/arena/meu-status', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pvpAtivado FROM arena WHERE alunoId = $1`, [req.user.id]
    );
    res.json({ pvpAtivado: rows.length ? rows[0].pvpativado : true });
  } catch {
    res.status(500).json({ error: 'Erro ao buscar status.' });
  }
});

// -------------------------------
// 🧩 3) Ativar/desativar PVP
// -------------------------------
app.put('/api/arena/pvp', authenticateToken, async (req, res) => {
  const { ativo } = req.body;
  try {
    await pool.query(`
      INSERT INTO arena (alunoId, pvpAtivado)
      VALUES ($1, $2)
      ON CONFLICT (alunoId) DO UPDATE SET pvpAtivado = $2
    `, [req.user.id, ativo]);
    res.json({ success: true, pvpAtivado: ativo });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar PVP.' });
  }
});

// -------------------------------
// 🧩 4) Batalha (corrigido)
// -------------------------------
/** app.post('/api/arena/batalha', authenticateToken, async (req, res) => {
  const alvoId = parseInt(req.body.alvoId, 10);
  const atacanteId = req.user.id;
  const atacanteCtr = req.user.username; // 🔹 CTR do atacante (caso userId esteja null)
  const agora = new Date();
  const cansadoAte = new Date(agora.getTime() + 15 * 60 * 1000).toISOString();

  try {
    const { rows: allRows } = await pool.query(`SELECT userId, data FROM alunos`);
    let atacanteData, alvoData, atacanteProfessorId, alvoProfessorId;
    let atacanteArray, alvoArray, atacanteIndex, alvoIndex;

    for (const row of allRows) {
      const alunos = safeJSON(row.data, []);

      // 🧠 Corrigido: procura por userId OU ctr
      const idxAtacante = alunos.findIndex(a =>
        String(a.userId) === String(atacanteId) ||
        String(a.ctr) === String(atacanteCtr)
      );
      const idxAlvo = alunos.findIndex(a =>
        String(a.userId) === String(alvoId)
      );

      if (idxAtacante !== -1) {
        atacanteData = alunos[idxAtacante];
        atacanteArray = alunos;
        atacanteProfessorId = row.userid;
        atacanteIndex = idxAtacante;
      }

      if (idxAlvo !== -1) {
        alvoData = alunos[idxAlvo];
        alvoArray = [...alunos];
        alvoProfessorId = row.userid;
        alvoIndex = idxAlvo;
      }
    }

    // ⚠️ Verificação de segurança
    if (!atacanteData || !alvoData)
      return res.status(404).json({ error: 'Um dos jogadores não foi encontrado.' });

    // Verificar se podem lutar
    const atacanteArena = await pool.query(
      `SELECT pvpAtivado, cansadoAte FROM arena WHERE alunoId = $1`,
      [atacanteData.userId || atacanteId]
    );
    const alvoArena = await pool.query(
      `SELECT pvpAtivado, cansadoAte FROM arena WHERE alunoId = $1`,
      [alvoData.userId || alvoId]
    );

    const atacantePode =
      atacanteArena.rows[0]?.pvpativado &&
      (!atacanteArena.rows[0]?.cansadoate || new Date(atacanteArena.rows[0].cansadoate) < agora);
    const alvoPode =
      alvoArena.rows[0]?.pvpativado &&
      (!alvoArena.rows[0]?.cansadoate || new Date(alvoArena.rows[0].cansadoate) < agora);

    if (!atacantePode) return res.status(400).json({ error: 'Você está cansado ou com PVP desativado.' });
    if (!alvoPode) return res.status(400).json({ error: 'O alvo não está disponível.' });

    // Calcular batalha
    const poderAtacante = Object.values(atacanteData.equipamentos || {}).reduce((s, i) => s + (i?.power || 0), 0);
    const poderAlvo = Object.values(alvoData.equipamentos || {}).reduce((s, i) => s + (i?.power || 0), 0);
    const dadoAtacante = Math.floor(Math.random() * 6) + 1;
    const dadoAlvo = Math.floor(Math.random() * 6) + 1;
    const danoAtacante = dadoAtacante * poderAtacante;
    const danoAlvo = dadoAlvo * poderAlvo;

    let vencedor = null;
    let goldTransferido = 0;
    let empate = false;

    if (danoAtacante > danoAlvo) {
      vencedor = atacanteId;
      goldTransferido = Math.floor((alvoData.gold || 0) * (0.1 + Math.random() * 0.05));
    } else if (danoAlvo > danoAtacante) {
      vencedor = alvoId;
      goldTransferido = Math.floor((atacanteData.gold || 0) * (0.1 + Math.random() * 0.05));
    } else {
      empate = true;
    }

    // Atualiza estado de cansaço
    await Promise.all([
      pool.query(
        `INSERT INTO arena (alunoId, cansadoAte)
         VALUES ($1, $2)
         ON CONFLICT (alunoId) DO UPDATE SET cansadoAte = $2`,
        [atacanteData.userId || atacanteId, cansadoAte]
      ),
      pool.query(
        `INSERT INTO arena (alunoId, cansadoAte)
         VALUES ($1, $2)
         ON CONFLICT (alunoId) DO UPDATE SET cansadoAte = $2`,
        [alvoData.userId || alvoId, cansadoAte]
      )
    ]);

    // Transferência de gold
    if (!empate && goldTransferido > 0) {
      if (vencedor === atacanteId) {
        atacanteArray[atacanteIndex].gold = (atacanteData.gold || 0) + goldTransferido;
        alvoArray[alvoIndex].gold = Math.max(0, (alvoData.gold || 0) - goldTransferido);
      } else {
        atacanteArray[atacanteIndex].gold = Math.max(0, (atacanteData.gold || 0) - goldTransferido);
        alvoArray[alvoIndex].gold = (alvoData.gold || 0) + goldTransferido;
      }
    }

    // Salva atualizações no banco
    await pool.query(`UPDATE alunos SET data = $1 WHERE userId = $2`, [JSON.stringify(atacanteArray), atacanteProfessorId]);
    await pool.query(`UPDATE alunos SET data = $1 WHERE userId = $2`, [JSON.stringify(alvoArray), alvoProfessorId]);

    // Log de batalha
    if (!fs.existsSync(logsFile)) fs.writeFileSync(logsFile, '[]', 'utf8');
    const logs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));
    logs.push({
      atacanteId,
      alvoId,
      vencedor,
      atacanteNome: atacanteData.nome,
      defensorNome: alvoData.nome,
      atacantePoder: poderAtacante,
      defensorPoder: poderAlvo,
      atacanteDado: dadoAtacante,
      defensorDado: dadoAlvo,
      atacanteDano: danoAtacante,
      defensorDano: danoAlvo,
      goldTransferido,
      empate,
      timestamp: Date.now()
    });
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));

    res.json({
      success: true,
      vencedor,
      empate,
      goldTransferido,
      danoAtacante,
      danoAlvo,
      dadoAtacante,
      dadoAlvo
    });
  } catch (err) {
    console.error('❌ Erro em /api/arena/batalha:', err);
    res.status(500).json({ error: 'Erro interno na batalha.' });
  }
}); **/
app.post('/api/arena/batalha', authenticateToken, async (req, res) => {
  const alvoRaw = req.body.alvoId;   // pode ser userId (número) ou CTR (string)
  const atacanteId = req.user.id;    // sempre numérico (do token JWT)
  const atacanteCtr = req.user.username || null;
  const agora = new Date();
  const cansadoAte = new Date(agora.getTime() + 15 * 60 * 1000).toISOString();

  try {
    const { rows: allRows } = await pool.query(`SELECT data, userid FROM alunos`);
    let atacanteData, alvoData, atacanteProfessorId, alvoProfessorId;
    let atacanteArray, alvoArray, atacanteIndex, alvoIndex;

    // detecta formato do alvo
    const alvoIsNumber = String(alvoRaw).match(/^\d+$/) !== null;
    const alvoIdNum = alvoIsNumber ? parseInt(alvoRaw, 10) : null;
    const alvoCtr = alvoIsNumber ? null : String(alvoRaw);

    for (const row of allRows) {
      const alunos = safeJSON(row.data, []);

      // busca ampliada: permite userId, ctr, ou misto
      const idxAtacante = alunos.findIndex(a =>
        String(a.userId) === String(atacanteId) ||
        String(a.ctr) === String(atacanteCtr) ||
        String(a.ctr) === String(atacanteId)
      );

      const idxAlvo = alunos.findIndex(a =>
        String(a.userId) === String(alvoRaw) ||
        String(a.ctr) === String(alvoRaw) ||
        String(a.userId) === String(alvoIdNum) ||
        String(a.ctr) === String(alvoCtr)
      );

      if (idxAtacante !== -1) {
        atacanteData = alunos[idxAtacante];
        atacanteArray = alunos;
        atacanteProfessorId = row.userid;
        atacanteIndex = idxAtacante;
      }

      if (idxAlvo !== -1) {
        alvoData = alunos[idxAlvo];
        alvoArray = [...alunos];
        alvoProfessorId = row.userid;
        alvoIndex = idxAlvo;
      }
    }

    // debug temporário (pode remover depois)
    console.log({
      atacanteId,
      atacanteCtr,
      alvoRaw,
      encontradoAtacante: !!atacanteData,
      encontradoAlvo: !!alvoData,
      atacanteProfessorId,
      alvoProfessorId
    });

    if (!atacanteData || !alvoData) {
      return res.status(404).json({ error: 'Um dos jogadores não foi encontrado.' });
    }

    // 🔹 verifica estado de PVP / cansaço
    const atacanteDbId = Number.isInteger(atacanteData.userId) ? atacanteData.userId : atacanteId;
    const alvoDbId = Number.isInteger(alvoData.userId) ? alvoData.userId : null;

    const atacanteArena = await pool.query(
      `SELECT pvpAtivado, cansadoAte FROM arena WHERE alunoId = $1`,
      [atacanteDbId]
    );
    const alvoArena = alvoDbId
      ? await pool.query(`SELECT pvpAtivado, cansadoAte FROM arena WHERE alunoId = $1`, [alvoDbId])
      : { rows: [] };

    const atacantePode =
      (atacanteArena.rows[0]?.pvpativado ?? true) &&
      (!atacanteArena.rows[0]?.cansadoate || new Date(atacanteArena.rows[0].cansadoate) < agora);

    const alvoPode =
      (alvoArena.rows[0]?.pvpativado ?? true) &&
      (!alvoArena.rows[0]?.cansadoate || new Date(alvoArena.rows[0].cansadoate) < agora);

    if (!atacantePode)
      return res.status(400).json({ error: 'Você está cansado ou com PVP desativado.' });
    if (!alvoPode)
      return res.status(400).json({ error: 'O alvo não está disponível.' });

    // 🔹 cálculo da batalha
    const poderAtacante = Object.values(atacanteData.equipamentos || {}).reduce((s, i) => s + (i?.power || 0), 0);
    const poderAlvo = Object.values(alvoData.equipamentos || {}).reduce((s, i) => s + (i?.power || 0), 0);
    const dadoAtacante = Math.floor(Math.random() * 6) + 1;
    const dadoAlvo = Math.floor(Math.random() * 6) + 1;
    const danoAtacante = dadoAtacante * poderAtacante;
    const danoAlvo = dadoAlvo * poderAlvo;

    let vencedor = null;
    let goldTransferido = 0;
    let empate = false;

    if (danoAtacante > danoAlvo) {
      vencedor = atacanteId;
      goldTransferido = Math.floor((alvoData.gold || 0) * (0.1 + Math.random() * 0.05));
    } else if (danoAlvo > danoAtacante) {
      vencedor = alvoData.userId || alvoCtr || 'defensor';
      goldTransferido = Math.floor((atacanteData.gold || 0) * (0.1 + Math.random() * 0.05));
    } else {
      empate = true;
    }

    // 🔹 aplica cansaço na arena
    const tasks = [];
    if (Number.isInteger(atacanteDbId)) {
      tasks.push(pool.query(
        `INSERT INTO arena (alunoId, cansadoAte)
         VALUES ($1, $2)
         ON CONFLICT (alunoId) DO UPDATE SET cansadoAte = $2`,
        [atacanteDbId, cansadoAte]
      ));
    }
    if (Number.isInteger(alvoDbId)) {
      tasks.push(pool.query(
        `INSERT INTO arena (alunoId, cansadoAte)
         VALUES ($1, $2)
         ON CONFLICT (alunoId) DO UPDATE SET cansadoAte = $2`,
        [alvoDbId, cansadoAte]
      ));
    }
    await Promise.all(tasks);

    // 🔹 transfere gold internamente
    if (!empate && goldTransferido > 0) {
      if (vencedor === atacanteId) {
        atacanteArray[atacanteIndex].gold = (atacanteData.gold || 0) + goldTransferido;
        alvoArray[alvoIndex].gold = Math.max(0, (alvoData.gold || 0) - goldTransferido);
      } else {
        atacanteArray[atacanteIndex].gold = Math.max(0, (atacanteData.gold || 0) - goldTransferido);
        alvoArray[alvoIndex].gold = (alvoData.gold || 0) + goldTransferido;
      }
    }

    // 🔹 salva arrays atualizados
    if (atacanteProfessorId) {
      await pool.query(`UPDATE alunos SET data = $1 WHERE userId = $2`, [JSON.stringify(atacanteArray), atacanteProfessorId]);
    }
    if (alvoProfessorId) {
      await pool.query(`UPDATE alunos SET data = $1 WHERE userId = $2`, [JSON.stringify(alvoArray), alvoProfessorId]);
    }

    // 🔹 grava logs
    if (!fs.existsSync(logsFile)) fs.writeFileSync(logsFile, '[]', 'utf8');
    const logs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));
    logs.push({
      atacanteId: atacanteData.userId || atacanteId,
      atacanteCtr: atacanteData.ctr || atacanteCtr,
      alvoId: alvoData.userId || null,
      alvoCtr: alvoData.ctr || alvoCtr,
      vencedor,
      atacanteNome: atacanteData.nome,
      defensorNome: alvoData.nome,
      atacantePoder: poderAtacante,
      defensorPoder: poderAlvo,
      atacanteDado: dadoAtacante,
      defensorDado: dadoAlvo,
      atacanteDano: danoAtacante,
      defensorDano: danoAlvo,
      goldTransferido,
      empate,
      timestamp: Date.now()
    });
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));

    // 🔹 resposta final
    res.json({
      success: true,
      vencedor,
      empate,
      goldTransferido,
      danoAtacante,
      danoAlvo,
      dadoAtacante,
      dadoAlvo
    });
  } catch (err) {
    console.error('❌ Erro em /api/arena/batalha:', err);
    res.status(500).json({ error: 'Erro interno na batalha.' });
  }
});



// -------------------------------
// 🧩 5) Logs
// -------------------------------
/** app.get('/api/arena/logs', authenticateToken, (req, res) => {
  const userId = req.user.id;
  if (!fs.existsSync(logsFile)) return res.json([]);

  const logs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));
  const meusLogs = logs
    .filter(log => log.atacanteId === userId || log.alvoId === userId)
    .map(log => ({
      data: new Date(log.timestamp).toLocaleString('pt-BR'),
      atacante: log.atacanteNome,
      defensor: log.defensorNome,
      vencedor: log.empate ? 'Empate' : log.vencedor,
      gold: log.goldTransferido,
      resultado:
        log.empate ? 'empate' :
        log.vencedor === userId ? 'win' : 'lose'
    }));

  res.json(meusLogs.reverse());
}); **/
app.get('/api/arena/logs', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const userCtr = req.user.username;
  if (!fs.existsSync(logsFile)) return res.json([]);

  const logs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));
  const meus = logs.filter(log =>
    (log.atacanteId && log.atacanteId === userId) ||
    (log.alvoId && log.alvoId === userId) ||
    (log.atacanteCtr && String(log.atacanteCtr) === String(userCtr)) ||
    (log.alvoCtr && String(log.alvoCtr) === String(userCtr))
  ).map(log => ({
    data: new Date(log.timestamp).toLocaleString('pt-BR'),
    atacante: log.atacanteNome,
    defensor: log.defensorNome,
    vencedor: log.empate ? 'Empate' : (log.vencedor || '—'),
    gold: log.goldTransferido,
    resultado: log.empate ? 'empate' : ((log.vencedor === userId || String(log.vencedor) === String(userCtr)) ? 'win' : 'lose'),
    atacantePoder: log.atacantePoder,
    defensorPoder: log.defensorPoder,
    atacanteDado: log.atacanteDado,
    defensorDado: log.defensorDado,
    atacanteDano: log.atacanteDano,
    defensorDano: log.defensorDano
  }));

  res.json(meus.reverse());
});


// --- PROFESSOR ---
// (usa a mesma função safeJSON já definida antes)

app.get('/api/professor', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT data FROM professores WHERE userId = $1`,
      [userId]
    );

    if (!rows.length || !rows[0].data) {
      // Se o professor ainda não tiver perfil salvo, retorna padrão
      return res.json({
        name: req.user.name,
        bio: '',
        pic: 'assets/profile-placeholder.jpg'
      });
    }

    const data = safeJSON(rows[0].data, {});
    res.json(data);
  } catch (err) {
    console.error('❌ Erro em /api/professor:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do professor.' });
  }
});

app.put('/api/professor', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const professorData = { name: req.user.name, ...req.body };
  const dataJson = JSON.stringify(professorData);

  try {
    const { rows } = await pool.query(
      `SELECT id FROM professores WHERE userId = $1`,
      [userId]
    );

    if (rows.length > 0) {
      // Já existe → atualiza
      await pool.query(
        `UPDATE professores SET data = $1 WHERE userId = $2`,
        [dataJson, userId]
      );
      res.json({ success: true, message: 'Perfil atualizado com sucesso.' });
    } else {
      // Não existe → insere novo
      const { rows: inserted } = await pool.query(
        `INSERT INTO professores (userId, data) VALUES ($1, $2) RETURNING id`,
        [userId, dataJson]
      );
      res.json({ success: true, id: inserted[0].id, message: 'Perfil criado com sucesso.' });
    }
  } catch (err) {
    console.error('❌ Erro em /api/professor (PUT):', err);
    res.status(500).json({ error: 'Erro ao salvar dados do professor.' });
  }
});


// --- FREQUÊNCIA ---
app.post('/api/frequencia/registrar', authenticateToken, async (req, res) => {
  const { mesAno, porcentagem, userId } = req.body;

  if (!mesAno || porcentagem === undefined || !userId) {
    return res.status(400).send('Dados incompletos para registro.');
  }

  try {
    // Verifica se já existe o registro do mesmo mês
    const { rows: existentes } = await pool.query(
      `SELECT id FROM frequenciasAnteriores WHERE userId = $1 AND mesAno = $2`,
      [userId, mesAno]
    );

    if (existentes.length > 0) {
      return res.status(200).send('Registro já existente.');
    }

    // Insere novo registro
    await pool.query(
      `INSERT INTO frequenciasAnteriores (userId, mesAno, porcentagem) VALUES ($1, $2, $3)`,
      [userId, mesAno, porcentagem]
    );

    res.status(201).send('Frequência registrada com sucesso.');
  } catch (err) {
    console.error('❌ Erro ao registrar frequência:', err);
    res.status(500).send('Erro ao registrar frequência.');
  }
});

app.get('/api/frequencia/historico', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT mesAno, porcentagem FROM frequenciasAnteriores WHERE userId = $1 ORDER BY mesAno DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar histórico de frequência:', err);
    res.status(500).send('Erro ao buscar histórico.');
  }
});


// --- TAREFAS (professor) ---
app.get('/api/tarefas/professor', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(`
      SELECT id, titulo, descricao, prazo, turmas, recompensaGold, createdAt
      FROM tarefas
      WHERE professorId = $1
      ORDER BY createdAt DESC
    `, [userId]);

    const tarefas = rows.map(row => {
      let turmasArray = [];
      try {
        if (row.turmas && row.turmas.trim() !== '') {
          turmasArray = JSON.parse(row.turmas);
        }
      } catch {
        console.warn('⚠️ JSON inválido em turmas para tarefa ID:', row.id);
      }

      return {
        id: row.id,
        titulo: row.titulo,
        descricao: row.descricao,
        prazo: row.prazo,
        turmas: turmasArray,
        recompensaGold: row.recompensagold || 0,
        createdAt: row.createdat
      };
    });

    res.json(tarefas);
  } catch (err) {
    console.error('❌ Erro ao buscar tarefas:', err);
    res.status(500).json({ error: 'Erro ao buscar tarefas.' });
  }
});

app.get('/api/tarefas/professor/:tarefaId/alunos', authenticateToken, async (req, res) => {
  const professorId = req.user.id;
  const tarefaId = req.params.tarefaId;

  try {
    // Busca a tarefa
    const { rows: tarefaRows } = await pool.query(
      `SELECT turmas FROM tarefas WHERE id = $1 AND professorId = $2`,
      [tarefaId, professorId]
    );

    if (tarefaRows.length === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    let turmasIds;
    try {
      turmasIds = JSON.parse(tarefaRows[0].turmas);
    } catch {
      return res.status(500).json({ error: 'Dados da tarefa corrompidos.' });
    }

    if (!Array.isArray(turmasIds) || turmasIds.length === 0) {
      return res.json([]);
    }

    // Busca os alunos vinculados às turmas do professor
    const { rows: alunosRows } = await pool.query(
      `SELECT a.data, t.userId AS professorId
       FROM alunos a
       JOIN turmas t ON a.userId = t.userId
       WHERE t.id = ANY($1::int[])`,
      [turmasIds]
    );

    const todosAlunos = [];
    alunosRows.forEach(row => {
      try {
        const alunosDoProfessor = JSON.parse(row.data);
        alunosDoProfessor.forEach(aluno => {
          if (aluno.turmas?.some(tid => turmasIds.includes(tid))) {
            todosAlunos.push({
              ctr: aluno.ctr,
              nome: aluno.nome,
              userId: aluno.userId
            });
          }
        });
      } catch (e) {
        console.error('❌ Erro ao parsear alunos:', e);
      }
    });

    // Remove duplicados por `ctr`
    const vistos = new Set();
    const unicos = todosAlunos.filter(a => {
      if (vistos.has(a.ctr)) return false;
      vistos.add(a.ctr);
      return true;
    });

    if (unicos.length === 0) return res.json([]);

    const ids = unicos.map(a => a.userId);
    const { rows: conclusoes } = await pool.query(
      `SELECT alunoId, entregue, corrigida, dataEntrega, fotoEntrega
       FROM conclusoesTarefas
       WHERE tarefaId = $1 AND alunoId = ANY($2::int[])`,
      [tarefaId, ids]
    );

    const conclusaoMap = {};
    conclusoes.forEach(c => {
      conclusaoMap[c.alunoid] = {
        entregue: !!c.entregue,
        corrigida: !!c.corrigida,
        dataEntrega: c.dataentrega,
        fotoEntrega: c.fotoentrega
      };
    });

    const resultado = unicos.map(aluno => ({
      id: aluno.userId,
      ctr: aluno.ctr,
      nome: aluno.nome,
      ...conclusaoMap[aluno.userId] || {
        entregue: false, corrigida: false, dataEntrega: null, fotoEntrega: null
      }
    }));

    res.json(resultado);
  } catch (err) {
    console.error('❌ Erro ao buscar alunos da tarefa:', err);
    res.status(500).json({ error: 'Erro ao buscar alunos da tarefa.' });
  }
});


app.delete('/api/tarefas/:id', authenticateToken, async (req, res) => {
  const professorId = req.user.id;
  const tarefaId = req.params.id;

  try {
    // Exclui conclusões associadas
    await pool.query(`DELETE FROM conclusoesTarefas WHERE tarefaId = $1`, [tarefaId]);

    const result = await pool.query(
      `DELETE FROM tarefas WHERE id = $1 AND professorId = $2`,
      [tarefaId, professorId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este usuário.' });
    }

    res.json({ success: true, message: 'Tarefa deletada com sucesso.' });
  } catch (err) {
    console.error('❌ Erro ao deletar tarefa:', err);
    res.status(500).json({ error: 'Erro ao deletar tarefa.' });
  }
});

app.put('/api/tarefas/:id', authenticateToken, async (req, res) => {
  const professorId = req.user.id;
  const tarefaId = req.params.id;
  const { titulo, descricao, prazo, turmas, recompensaGold } = req.body;

  if (!titulo || !turmas || !Array.isArray(turmas) || turmas.length === 0) {
    return res.status(400).json({ error: 'Título e pelo menos uma turma são obrigatórios.' });
  }

  try {
    const result = await pool.query(`
      UPDATE tarefas
      SET titulo = $1, descricao = $2, prazo = $3, turmas = $4, recompensaGold = $5
      WHERE id = $6 AND professorId = $7
    `, [titulo, descricao || '', prazo || '', JSON.stringify(turmas), recompensaGold || 0, tarefaId, professorId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este usuário.' });
    }

    res.json({ success: true, message: 'Tarefa atualizada com sucesso.', recompensaGold: recompensaGold || 0 });
  } catch (err) {
    console.error('❌ Erro ao atualizar tarefa:', err);
    res.status(500).json({ error: 'Erro ao atualizar tarefa.' });
  }
});

app.post('/api/tarefas', authenticateToken, async (req, res) => {
  const { titulo, descricao, prazo, turmas, recompensaGold } = req.body;
  const professorId = req.user.id;

  if (!titulo || !turmas || !Array.isArray(turmas) || turmas.length === 0) {
    return res.status(400).json({ error: 'Título e pelo menos uma turma são obrigatórios.' });
  }

  const createdAt = new Date().toISOString();

  try {
    const { rows } = await pool.query(`
      INSERT INTO tarefas (professorId, titulo, descricao, prazo, turmas, recompensaGold, createdAt)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [professorId, titulo, descricao || '', prazo || '', JSON.stringify(turmas), recompensaGold || 0, createdAt]);

    res.status(201).json({
      id: rows[0].id,
      titulo,
      descricao,
      prazo,
      turmas,
      recompensaGold: recompensaGold || 0,
      createdAt
    });
  } catch (err) {
    console.error('❌ Erro ao salvar tarefa:', err);
    res.status(500).json({ error: 'Erro ao salvar tarefa.' });
  }
});

// --- TAREFAS (aluno) ---
app.get('/api/tarefas/aluno', authenticateToken, async (req, res) => {
  const alunoId = req.user.id;

  try {
    // 1️⃣ Busca o registro do aluno e suas turmas
    const { rows: alunoRows } = await pool.query(`SELECT data FROM alunos`);
    if (!alunoRows?.length) return res.json([]);

    let alunoData = null;
    for (const row of alunoRows) {
      try {
        const alunos = JSON.parse(row.data);
        const encontrado = alunos.find(a => a.userId === alunoId);
        if (encontrado) {
          alunoData = encontrado;
          break;
        }
      } catch (e) {
        console.error("Erro ao parsear alunos:", e);
      }
    }

    if (!alunoData) return res.json([]);
    
    // 🔧 Garante que turmas seja um array de strings
    const turmasDoAluno = new Set(
      Array.isArray(alunoData.turmas)
        ? alunoData.turmas.map(t => String(t))
        : []
    );

    if (!turmasDoAluno.size) {
      console.warn(`Aluno ${alunoId} não tem turmas registradas.`);
      return res.json([]);
    }

    // 2️⃣ Busca todas as tarefas
    const { rows: tarefas } = await pool.query(`
      SELECT 
        t.id, t.titulo, t.descricao, t.prazo, t.createdAt, t.turmas, t.recompensaGold,
        ct.entregue, ct.corrigida, ct.dataEntrega, ct.fotoEntrega
      FROM tarefas t
      LEFT JOIN conclusoesTarefas ct 
        ON t.id = ct.tarefaId AND ct.alunoId = $1
      ORDER BY t.createdAt DESC
    `, [alunoId]);

    // 3️⃣ Filtra apenas as tarefas que pertencem às turmas do aluno
    const tarefasDoAluno = tarefas.filter(t => {
      if (!t.turmas) return false;
      try {
        const turmasDaTarefa = JSON.parse(t.turmas).map(tt => String(tt));
        return turmasDaTarefa.some(turma => turmasDoAluno.has(turma));
      } catch {
        return false;
      }
    }).map(t => ({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      prazo: t.prazo,
      createdAt: t.createdat,
      recompensaGold: t.recompensagold || 0,
      entregue: !!t.entregue,
      corrigida: !!t.corrigida,
      dataEntrega: t.dataentrega,
      fotoEntrega: t.fotoentrega
    }));

    res.json(tarefasDoAluno);
  } catch (err) {
    console.error('❌ Erro ao buscar tarefas do aluno:', err);
    res.status(500).json({ error: 'Erro interno ao buscar tarefas.' });
  }
});



// Aluno entrega tarefa (com foto)
app.post('/api/tarefas/entregar', authenticateToken, upload.single('foto'), async (req, res) => {
  const { tarefaId } = req.body;
  const alunoId = req.user.id;
  const foto = req.file;

  if (!tarefaId) return res.status(400).json({ message: 'ID da tarefa é obrigatório.' });
  if (!foto) return res.status(400).json({ message: 'Foto do exercício é obrigatória.' });

  const fotoBase64 = `data:${foto.mimetype};base64,${foto.buffer.toString('base64')}`;
  const agora = new Date().toISOString();

  const sql = `
    INSERT INTO conclusoesTarefas 
      (tarefaId, alunoId, entregue, dataEntrega, fotoEntrega, concluido, dataConclusao)
    VALUES ($1, $2, true, $3, $4, true, $5)
    ON CONFLICT (tarefaId, alunoId) DO UPDATE
      SET entregue = true,
          dataEntrega = EXCLUDED.dataEntrega,
          fotoEntrega = EXCLUDED.fotoEntrega,
          concluido = true,
          dataConclusao = EXCLUDED.dataConclusao
  `;

  try {
    await pool.query(sql, [tarefaId, alunoId, agora, fotoBase64, agora]);
    res.json({ success: true, message: 'Tarefa entregue com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao entregar tarefa:', err);
    res.status(500).json({ message: 'Erro ao salvar entrega.' });
  }
});


app.post('/api/tarefas/corrigir', authenticateToken, async (req, res) => {
  const { alunoId, tarefaId, status } = req.body;
  const agora = new Date().toISOString();

  if (!alunoId || !tarefaId || !['completo', 'incompleto'].includes(status)) {
    return res.status(400).json({ message: 'Dados inválidos.' });
  }

  try {
    // Marca como corrigida
    const updateSql = `
      UPDATE conclusoesTarefas
      SET corrigida = true, dataCorrecao = $1
      WHERE tarefaId = $2 AND alunoId = $3
    `;
    const result = await pool.query(updateSql, [agora, tarefaId, alunoId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Entrega não encontrada.' });
    }

    if (status === 'incompleto') {
      return res.json({ success: true, message: 'Tarefa marcada como incompleta.' });
    }

    // Busca recompensa da tarefa
    const { rows: tarefaRows } = await pool.query(
      `SELECT recompensaGold FROM tarefas WHERE id = $1`,
      [tarefaId]
    );
    if (!tarefaRows.length || tarefaRows[0].recompensagold <= 0) {
      return res.json({ success: true, message: 'Tarefa corrigida (sem recompensa).' });
    }

    const recompensa = tarefaRows[0].recompensagold;

    // Localiza o aluno dentro do JSON de alunos e adiciona gold
    const { rows: alunosRows } = await pool.query(`SELECT userId, data FROM alunos`);
    for (const row of alunosRows) {
      try {
        const alunosArray = JSON.parse(row.data);
        const idx = alunosArray.findIndex(a => a.userId === alunoId);
        if (idx !== -1) {
          alunosArray[idx].gold = (alunosArray[idx].gold || 0) + recompensa;
          await pool.query(
            `UPDATE alunos SET data = $1 WHERE userId = $2`,
            [JSON.stringify(alunosArray), row.userid]
          );
          return res.json({ success: true, message: `+${recompensa} golds creditados!` });
        }
      } catch (e) {
        console.error('❌ Erro ao atualizar gold do aluno:', e);
      }
    }

    res.status(404).json({ message: 'Aluno não encontrado para recompensa.' });
  } catch (err) {
    console.error('❌ Erro ao corrigir tarefa:', err);
    res.status(500).json({ message: 'Erro ao atualizar status.' });
  }
});


app.post('/api/tarefas/concluir', authenticateToken, async (req, res) => {
  const { tarefaId } = req.body;
  const alunoId = req.user.id;
  const agora = new Date().toISOString();

  const sql = `
    INSERT INTO conclusoesTarefas (tarefaId, alunoId, concluido, dataConclusao)
    VALUES ($1, $2, true, $3)
    ON CONFLICT (tarefaId, alunoId) DO UPDATE
      SET concluido = true, dataConclusao = EXCLUDED.dataConclusao
  `;

  try {
    await pool.query(sql, [tarefaId, alunoId, agora]);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao concluir tarefa:', err);
    res.status(500).json({ error: 'Erro ao concluir tarefa.' });
  }
});



// --- LOJA ---
app.post('/api/itens', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { nome, descricao, efeito, slot, power, preco, icone, privado } = req.body;

  if (!nome || !efeito || !slot || !preco || !icone) {
    return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
  }

  try {
    await pool.query(
      `INSERT INTO itens_loja (nome, descricao, efeito, slot, power, preco, icone, privado, criadoPor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [nome, descricao || '', efeito, slot, power || 0, preco, icone, privado || false, userId]
    );
    res.json({ success: true, message: 'Item criado com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao criar item:', err);
    res.status(500).json({ message: 'Erro ao criar item.' });
  }
});



// ✅ Itens visíveis ao aluno — apenas itens públicos
app.get('/api/itens', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nome, descricao, efeito, slot, power, preco, icone
      FROM itens_loja
      WHERE privado = false OR privado IS NULL
      ORDER BY id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao carregar itens da loja:', err);
    res.status(500).json({ error: 'Erro ao carregar itens da loja.' });
  }
});



app.get('/api/itens/professor', authenticateToken, async (req, res) => {
  if (req.user.role !== 'professor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado: apenas professores podem acessar esta lista.' });
  }

  try {
    const sql = `SELECT id, nome, descricao, efeito, slot, power, preco, icone, privado, criadoPor FROM itens_loja ORDER BY id DESC`;
    const { rows } = await pool.query(sql);

    // normaliza o campo criadoPor caso o driver tenha retornado em lowercase (criadopor)
    const normalized = rows.map(r => {
      const item = { ...r };
      if (item.criadopor !== undefined && item.criadoPor === undefined) item.criadoPor = item.criadopor;
      return item;
    });

    res.json(normalized);
  } catch (err) {
    console.error('Erro ao carregar itens (professor):', err);
    res.status(500).json({ error: 'Erro ao carregar itens.' });
  }
});

app.get('/api/itens/:id', authenticateToken, async (req, res) => {
  const itemId = req.params.id;
  try {
    const { rows } = await pool.query(`SELECT * FROM itens_loja WHERE id = $1`, [itemId]);
    if (!rows.length) return res.status(404).json({ error: 'Item não encontrado.' });

    const item = { ...rows[0] };
    // remove qualquer variação do campo criadoPor/criadopor para não vazar informação sensível
    delete item.criadoPor;
    delete item.criadopor;

    res.json(item);
  } catch (err) {
    console.error('Erro ao buscar item:', err);
    res.status(500).json({ error: 'Erro ao carregar item.' });
  }
});


app.delete('/api/itens/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(`SELECT * FROM itens_loja WHERE id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ message: 'Item não encontrado.' });

    const item = rows[0];
    if (item.criadopor !== userId) {
      return res.status(403).json({ message: 'Sem permissão para excluir este item.' });
    }

    await pool.query(`DELETE FROM itens_loja WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Item removido com sucesso.' });
  } catch (err) {
    console.error('❌ Erro ao deletar item:', err);
    res.status(500).json({ message: 'Erro ao deletar item.' });
  }
});



app.patch('/api/itens/:id/privar', authenticateToken, async (req, res) => {
  if (req.user.role !== 'professor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  const itemId = req.params.id;
  // força booleano
  const novoPrivado = !!req.body.privado;

  try {
    const sql = `UPDATE itens_loja SET privado = $1 WHERE id = $2 AND criadoPor = $3`;
    const result = await pool.query(sql, [novoPrivado, itemId, req.user.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item não encontrado ou não pertence a você.' });
    }

    res.json({ success: true, privado: novoPrivado });
  } catch (err) {
    console.error('Erro ao atualizar item (privado):', err);
    res.status(500).json({ error: 'Erro ao atualizar item.' });
  }
});


app.post('/api/comprar', authenticateToken, async (req, res) => {
  const alunoId = req.user.id;
  console.log('Aluno', alunoId, 'tentando comprar item:', req.body);
  const { itemId } = req.body;

  try {
    const { rows: alunos } = await pool.query(`SELECT id, data FROM alunos`);
    console.log('Registros de alunos encontrados:', alunos.length);
    console.log('Procurando alunoId:', alunoId);
    console.log(await pool.query(`SELECT id, data FROM alunos`));

    let turmaIdEncontrada = null;
    let alunoEncontrado = null;

    for (const row of alunos) {
      if (!row.data) continue;
      let alunosArray;
      try {
        alunosArray = JSON.parse(row.data);
      } catch {
        continue;
      }

      // const found = alunosArray.find(a => String(a.userId) === String(alunoId));
      const found = alunosArray.find(a =>
        String(a.userId) === String(alunoId) ||
        String(a.ctr) === String(req.user.username)
      );
      if (found) {
        turmaIdEncontrada = row.id;
        alunoEncontrado = found;
        break;
      }
    }

    if (!alunoEncontrado) {
      return res.status(404).json({ message: 'Aluno não encontrado.' });
    }

    // Busca item na loja
    const { rows: itens } = await pool.query(`SELECT * FROM itens_loja WHERE id = $1`, [itemId]);
    const item = itens[0];
    if (!item) {
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    if ((alunoEncontrado.gold || 0) < item.preco) {
      return res.status(400).json({ message: 'Ouro insuficiente.' });
    }

    // Atualiza gold e mochila
    alunoEncontrado.gold -= item.preco;
    alunoEncontrado.mochila = alunoEncontrado.mochila || [];
    alunoEncontrado.mochila.push(item);

    // Salva de volta
    const { rows: turmasRows } = await pool.query(`SELECT data FROM alunos WHERE id = $1`, [turmaIdEncontrada]);
    let alunosArray = JSON.parse(turmasRows[0].data);
    // const idx = alunosArray.findIndex(a => String(a.userId) === String(alunoId));
    const idx = alunosArray.findIndex(a =>
      String(a.userId) === String(alunoId) ||
      String(a.ctr) === String(req.user.username)
    );

    alunosArray[idx] = alunoEncontrado;

    await pool.query(`UPDATE alunos SET data = $1 WHERE id = $2`, [JSON.stringify(alunosArray), turmaIdEncontrada]);

    res.json({ success: true, gold: alunoEncontrado.gold, item });
  } catch (err) {
    console.error('❌ Erro ao processar compra:', err);
    res.status(500).json({ message: 'Erro ao processar compra.' });
  }
});




app.put('/api/student/profile', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
  const updates = req.body;

  db.get(`SELECT data FROM alunos WHERE userId = ?`, [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro no banco.' });
    if (!row) return res.status(404).json({ error: 'Aluno não encontrado.' });

    let alunos;
    try { alunos = JSON.parse(row.data); }
    catch { return res.status(500).json({ error: 'Dados corrompidos.' }); }

    const alunoIndex = alunos.findIndex(a => a.userId === req.user.id);
    if (alunoIndex === -1) {
      return res.status(404).json({ error: 'Seu perfil não foi encontrado.' });
    }

    alunos[alunoIndex] = { ...alunos[alunoIndex], ...updates };
    db.run(`UPDATE alunos SET data = ? WHERE userId = ?`, [JSON.stringify(alunos), req.user.id], (err2) => {
      if (err2) return res.status(500).json({ error: 'Erro ao salvar.' });
      res.json({ success: true, aluno: alunos[alunoIndex] });
    });
  });
});

// =======================================================
// ✅ 2) ARQUIVOS ESTÁTICOS (DEPOIS DAS ROTAS)
// =======================================================
app.use(express.static(path.join(__dirname, '../frontend')));

// =======================================================
// ✅ 3) CATCH-ALL PARA SPA
// =======================================================
app.get(/^\/(?!api\/|.*\..*).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 Acesse: http://localhost:${PORT}`);
});
