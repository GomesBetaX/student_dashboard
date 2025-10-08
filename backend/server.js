// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

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


app.post('/api/turmas', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const novaTurma = req.body;

  if (!novaTurma || !novaTurma.nome || !novaTurma.diasAula || !novaTurma.horario || !novaTurma.dataInicio) {
    return res.status(400).json({ error: 'Dados da turma incompletos.' });
  }

  const sql = `
    INSERT INTO turmas (
      userId, nome, diasAula, horario, dataInicio, tipo, duracao, finalizada, expandido, aulasDesativadas, planejamentos, alunos
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `;

  db.get(sql, [
    userId,
    novaTurma.nome,
    JSON.stringify(novaTurma.diasAula),
    novaTurma.horario,
    novaTurma.dataInicio,
    novaTurma.tipo || '',
    novaTurma.duracao || 3,
    novaTurma.finalizada || false,
    novaTurma.expandido !== undefined ? novaTurma.expandido : true,
    JSON.stringify(novaTurma.aulasDesativadas || []),
    JSON.stringify(novaTurma.planejamentos || {}),
    JSON.stringify(novaTurma.alunos || [])
  ], (err, row) => {
    if (err) {
      console.error('Erro ao inserir turma:', err);
      return res.status(500).json({ error: 'Erro ao salvar turma no banco.' });
    }
    res.status(201).json({ id: row.id, ...novaTurma, alunos: novaTurma.alunos || [] });
  });
});

app.put('/api/turmas/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const turmaId = req.params.id;
  const t = req.body;

  const sql = `
    UPDATE turmas SET
      nome = ?, diasAula = ?, horario = ?, dataInicio = ?, tipo = ?, duracao = ?,
      finalizada = ?, expandido = ?, aulasDesativadas = ?, planejamentos = ?, alunos = ?
    WHERE id = ? AND userId = ?
  `;

  db.run(sql, [
    t.nome,
    JSON.stringify(t.diasAula || []),
    t.horario,
    t.dataInicio,
    t.tipo,
    t.duracao,
    t.finalizada,
    t.expandido,
    JSON.stringify(t.aulasAulasDesativadas || t.aulasDesativadas || []),
    JSON.stringify(t.planejamentos || {}),
    JSON.stringify(t.alunos || []),
    turmaId,
    userId
  ], function (err) {
    if (err) {
      console.error('Erro ao atualizar turma:', err);
      return res.status(500).json({ error: 'Erro ao atualizar turma no banco.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Turma não encontrada ou não pertence a este usuário.' });
    }
    res.json({ success: true, message: 'Turma atualizada com sucesso.' });
  });
});

app.delete('/api/turmas/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const turmaId = req.params.id;
  db.run(`DELETE FROM turmas WHERE id = ? AND userId = ?`, [turmaId, userId], function (err) {
    if (err) {
      console.error('Erro ao deletar turma:', err);
      return res.status(500).json({ error: 'Erro ao deletar turma no banco.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Turma não encontrada ou não pertence a este usuário.' });
    }
    res.json({ success: true, message: 'Turma deletada com sucesso.' });
  });
});

// --- ALUNOS ---
app.get('/api/alunos', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.get(`SELECT data FROM alunos WHERE userId = ?`, [userId], (err, row) => {
    if (err || !row) return res.json([]);
    res.json(JSON.parse(row.data));
  });
});

app.post('/api/alunos', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const alunos = req.body;

  db.get(`SELECT id FROM alunos WHERE userId = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro no banco' });
    const dataJson = JSON.stringify(alunos);

    const salvarAlunos = () => {
      // Inicializa PVP da arena para cada aluno
      alunos.forEach(a => {
        if (a.userId) {
          db.run(`
            INSERT INTO arena (alunoId, pvpAtivado)
            VALUES (?, 1)
            ON CONFLICT(alunoId) DO NOTHING
          `, [a.userId], (err2) => {
            if (err2) console.error('Erro ao inicializar arena para aluno:', a.userId, err2);
          });
        }
      });
    };

    if (row) {
      db.run(`UPDATE alunos SET data = ? WHERE userId = ?`, [dataJson, userId], err2 => {
        if (err2) return res.status(500).json({ error: 'Erro ao atualizar' });
        salvarAlunos();
        res.json({ success: true });
      });
    } else {
      // INSERT com RETURNING id para devolver id corretamente
      db.get(`INSERT INTO alunos (userId, data) VALUES (?, ?) RETURNING id`, [userId, dataJson], (err2, r) => {
        if (err2) return res.status(500).json({ error: 'Erro ao inserir' });
        salvarAlunos();
        res.json({ success: true, id: r.id });
      });
    }
  });
});

// --- ARENA ---
app.get('/api/arena/alunos', authenticateToken, (req, res) => {
  const alunoCtr = req.user.username;

  db.all(`SELECT data FROM alunos`, [], (err, allRows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar turmas.' });

    // 1) Minhas turmas
    let minhasTurmas = [];
    for (const row of allRows) {
      try {
        const alunos = JSON.parse(row.data);
        const eu = alunos.find(a => a.ctr === alunoCtr);
        if (eu?.turmas) {
          minhasTurmas = eu.turmas;
          break;
        }
      } catch {}
    }
    if (minhasTurmas.length === 0) return res.json([]);

    // 2) Alunos das mesmas turmas
    const alunosDaTurma = [];
    for (const row of allRows) {
      try {
        const alunos = JSON.parse(row.data);
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
      } catch {}
    }

    // Remove duplicatas por ctr
    const map = new Map();
    alunosDaTurma.forEach(a => { if (!map.has(a.ctr)) map.set(a.ctr, a); });
    const unicos = Array.from(map.values());
    const ids = unicos.map(a => a._userId);
    if (ids.length === 0) return res.json([]);

    const placeholders = ids.map(() => '?').join(',');
    db.all(`SELECT alunoId, cansadoAte FROM arena WHERE alunoId IN (${placeholders})`, ids, (err2, arenaRows) => {
      if (err2) return res.status(500).json({ error: 'Erro ao buscar arena.' });
      const cansacoMap = {};
      arenaRows.forEach(r => { cansacoMap[r.alunoId] = r.cansadoAte; });

      const resultado = unicos.map(a => ({ ...a, cansadoAte: cansacoMap[a._userId] || null }));
      res.json(resultado);
    });
  });
});

app.get('/api/arena/meu-estado', authenticateToken, (req, res) => {
  const alunoId = req.user.id;
  db.get(`SELECT cansadoAte FROM arena WHERE alunoId = ?`, [alunoId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar estado.' });
    res.json({ cansadoAte: row?.cansadoAte || null });
  });
});

app.get('/api/arena/meu-status', authenticateToken, (req, res) => {
  const alunoId = req.user.id;
  db.get(`SELECT pvpAtivado FROM arena WHERE alunoId = ?`, [alunoId], (err, row) => {
    const pvpAtivado = row ? !!row.pvpAtivado : true;
    res.json({ pvpAtivado });
  });
});

app.put('/api/arena/pvp', authenticateToken, (req, res) => {
  const { ativo } = req.body;
  const alunoId = req.user.id;

  db.run(`
    INSERT INTO arena (alunoId, pvpAtivado)
    VALUES (?, ?)
    ON CONFLICT(alunoId) DO UPDATE SET pvpAtivado = ?
  `, [alunoId, ativo ? 1 : 0, ativo ? 1 : 0], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar PVP.' });
    res.json({ success: true, pvpAtivado: ativo });
  });
});

// Batalha
app.post('/api/arena/batalha', authenticateToken, (req, res) => {
  const alvoId = parseInt(req.body.alvoId, 10);
  const atacanteId = req.user.id;
  const agora = new Date();
  const cansadoAte = new Date(agora.getTime() + 15 * 60 * 1000).toISOString();

  console.log(`⚔️ Iniciando batalha: atacante ${atacanteId} vs alvo ${alvoId}`);

  db.all(`SELECT userId, data FROM alunos`, [], (err, allRows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar dados dos alunos.' });

    let atacanteData = null, alvoData = null;
    let atacanteProfessorId = null, alvoProfessorId = null;
    let atacanteArray = null, alvoArray = null;
    let atacanteIndex = -1, alvoIndex = -1;

    for (const row of allRows) {
      try {
        const alunos = JSON.parse(row.data);
        const idxAtacante = alunos.findIndex(a => a.userId === atacanteId);
        const idxAlvo = alunos.findIndex(a => a.userId === alvoId);

        if (idxAtacante !== -1) {
          atacanteData = alunos[idxAtacante];
          atacanteArray = alunos;
          atacanteProfessorId = row.userId;
          atacanteIndex = idxAtacante;
        }
        if (idxAlvo !== -1) {
          alvoData = alunos[idxAlvo];
          alvoArray = [...alunos];
          alvoProfessorId = row.userId;
          alvoIndex = idxAlvo;
        }
      } catch {}
    }

    if (!atacanteData || !alvoData)
      return res.status(404).json({ error: 'Um dos jogadores não foi encontrado.' });

    db.get(`SELECT pvpAtivado, cansadoAte FROM arena WHERE alunoId = ?`, [atacanteId], (errA, arenaAtacante) => {
      if (errA) return res.status(500).json({ error: 'Erro ao verificar status do atacante.' });
      const atacantePode = arenaAtacante?.pvpAtivado && (!arenaAtacante.cansadoAte || new Date(arenaAtacante.cansadoAte) < agora);
      if (!atacantePode) return res.status(400).json({ error: 'Você está cansado ou com PVP desativado.' });

      db.get(`SELECT pvpAtivado, cansadoAte FROM arena WHERE alunoId = ?`, [alvoId], (errB, arenaAlvo) => {
        if (errB) return res.status(500).json({ error: 'Erro ao verificar status do alvo.' });
        const alvoPode = arenaAlvo?.pvpAtivado && (!arenaAlvo.cansadoAte || new Date(arenaAlvo.cansadoAte) < agora);
        if (!alvoPode) return res.status(400).json({ error: 'O alvo não está disponível.' });

        // Cálculo
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

        console.log(`
          ===== ⚔️ LOG DE BATALHA =====
          Atacante: ${atacanteData.nome || atacanteData.name} (ID ${atacanteId})
            Poder Base: ${poderAtacante}
            Dado Rolado: ${dadoAtacante}
            Dano Total: ${danoAtacante}

          Defensor: ${alvoData.nome || alvoData.name} (ID ${alvoId})
            Poder Base: ${poderAlvo}
            Dado Rolado: ${dadoAlvo}
            Dano Total: ${danoAlvo}

          Resultado: ${empate ? 'EMPATE' : (vencedor === atacanteId ? `${atacanteData.nome} venceu` : `${alvoData.nome} venceu`)}
          Gold transferido: ${goldTransferido} 🪙
          ==============================
        `);

        const atualizarCansaco = (id) => new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO arena (alunoId, cansadoAte)
            VALUES (?, ?)
            ON CONFLICT(alunoId) DO UPDATE SET cansadoAte = ?
          `, [id, cansadoAte, cansadoAte], errC => errC ? reject(errC) : resolve());
        });

        Promise.all([atualizarCansaco(atacanteId), atualizarCansaco(alvoId)]).then(() => {
          if (!empate && goldTransferido > 0) {
            if (vencedor === atacanteId) {
              atacanteArray[atacanteIndex].gold = (atacanteData.gold || 0) + goldTransferido;
              alvoArray[alvoIndex].gold = Math.max(0, (alvoData.gold || 0) - goldTransferido);
            } else {
              atacanteArray[atacanteIndex].gold = Math.max(0, (atacanteData.gold || 0) - goldTransferido);
              alvoArray[alvoIndex].gold = (alvoData.gold || 0) + goldTransferido;
            }
          }

          db.run(`UPDATE alunos SET data = ? WHERE userId = ?`, [JSON.stringify(atacanteArray), atacanteProfessorId]);
          db.run(`UPDATE alunos SET data = ? WHERE userId = ?`, [JSON.stringify(alvoArray), alvoProfessorId]);

          // Log em arquivo
          if (!fs.existsSync(logsFile)) fs.writeFileSync(logsFile, '[]', 'utf8');
          const logs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));
          logs.push({
            atacanteId,
            atacanteNome: atacanteData.nome || atacanteData.name,
            atacantePoder: poderAtacante,
            atacanteDado: dadoAtacante,
            atacanteDano: danoAtacante,
            defensorId: alvoId,
            defensorNome: alvoData.nome || alvoData.name,
            defensorPoder: poderAlvo,
            defensorDado: dadoAlvo,
            defensorDano: danoAlvo,
            vencedorId: empate ? null : vencedor,
            vencedorNome: empate ? 'Empate' : (vencedor === atacanteId ? atacanteData.nome : alvoData.nome),
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
        }).catch(() => res.status(500).json({ error: 'Erro ao aplicar cansaço.' }));
      });
    });
  });
});

// Função auxiliar de logs (mantida)
function criarLogBatalha(atacanteId, alvoId, vencedor, goldTransferido, callback) {
  const agora = new Date().toISOString();
  const logAtacante = {
    tipo: 'batalha',
    data: agora,
    adversarioId: alvoId,
    vencedor: vencedor === atacanteId,
    gold: vencedor === atacanteId ? goldTransferido : -goldTransferido,
    empate: vencedor === null
  };
  const logAlvo = {
    tipo: 'batalha',
    data: agora,
    adversarioId: atacanteId,
    vencedor: vencedor === alvoId,
    gold: vencedor === alvoId ? goldTransferido : -goldTransferido,
    empate: vencedor === null
  };

  db.get('SELECT username FROM users WHERE id = ?', [atacanteId], (err1, r1) => {
    if (err1 || !r1) return callback();
    const ctrAtacante = r1.username;
    db.get('SELECT username FROM users WHERE id = ?', [alvoId], (err2, r2) => {
      if (err2 || !r2) return callback();
      const ctrAlvo = r2.username;

      db.all('SELECT userId, data FROM alunos', [], (err3, rows) => {
        if (err3) return callback();
        for (const row of rows) {
          try {
            const alunos = JSON.parse(row.data);
            const idx = alunos.findIndex(a => a.ctr === ctrAtacante);
            if (idx !== -1) {
              if (!alunos[idx].logs) alunos[idx].logs = [];
              alunos[idx].logs.push(logAtacante);
              db.run('UPDATE alunos SET data = ? WHERE userId = ?', [JSON.stringify(alunos), row.userId], () => {});
              break;
            }
          } catch {}
        }
        for (const row of rows) {
          try {
            const alunos = JSON.parse(row.data);
            const idx = alunos.findIndex(a => a.ctr === ctrAlvo);
            if (idx !== -1) {
              if (!alunos[idx].logs) alunos[idx].logs = [];
              alunos[idx].logs.push(logAlvo);
              db.run('UPDATE alunos SET data = ? WHERE userId = ?', [JSON.stringify(alunos), row.userId], () => {});
              break;
            }
          } catch {}
        }
        callback();
      });
    });
  });
}

app.post('/api/arena/toggle-pvp', authenticateToken, (req, res) => {
  const alunoId = req.user.id;

  db.get('SELECT pvpAtivado FROM arena WHERE alunoId = ?', [alunoId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar status do PVP.' });

    const novoStatus = !(row?.pvpAtivado);
    if (row) {
      db.run('UPDATE arena SET pvpAtivado = ? WHERE alunoId = ?', [novoStatus, alunoId], (err2) => {
        if (err2) return res.status(500).json({ error: 'Erro ao atualizar PVP.' });
        res.json({ pvpAtivado: novoStatus });
      });
    } else {
      db.run('INSERT INTO arena (alunoId, pvpAtivado) VALUES (?, ?)', [alunoId, novoStatus], (err2) => {
        if (err2) return res.status(500).json({ error: 'Erro ao criar registro PVP.' });
        res.json({ pvpAtivado: novoStatus });
      });
    }
  });
});

app.get('/api/arena/logs', authenticateToken, (req, res) => {
  const userId = req.user.id;
  let logs = [];
  if (fs.existsSync(logsFile)) logs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));

  const meusLogs = logs
    .filter(log => log.atacanteId === userId || log.defensorId === userId)
    .map(log => {
      const resultado =
        log.vencedorId === null ? 'empate' : (log.vencedorId === userId ? 'win' : 'lose');

      return {
        data: new Date(log.timestamp).toLocaleString('pt-BR'),
        atacante: log.atacanteNome,
        atacantePoder: log.atacantePoder,
        atacanteDado: log.atacanteDado,
        atacanteDano: log.atacanteDano,
        defensor: log.defensorNome,
        defensorPoder: log.defensorPoder,
        defensorDado: log.defensorDado,
        defensorDano: log.defensorDano,
        vencedor: log.vencedorNome,
        gold: log.goldTransferido,
        resultado
      };
    });

  res.json(meusLogs.reverse());
});

// --- PROFESSOR ---
app.get('/api/professor', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.get(`SELECT data FROM professores WHERE userId = ?`, [userId], (err, row) => {
    if (err || !row) {
      return res.json({ name: req.user.name, bio: '', pic: 'assets/profile-placeholder.jpg' });
    }
    res.json(JSON.parse(row.data));
  });
});

app.put('/api/professor', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const professorData = { name: req.user.name, ...req.body };
  const dataJson = JSON.stringify(professorData);

  db.get(`SELECT id FROM professores WHERE userId = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro no banco' });

    if (row) {
      db.run(`UPDATE professores SET data = ? WHERE userId = ?`, [dataJson, userId], (err2) => {
        if (err2) return res.status(500).json({ error: 'Erro ao atualizar' });
        res.json({ success: true });
      });
    } else {
      db.get(`INSERT INTO professores (userId, data) VALUES (?, ?) RETURNING id`, [userId, dataJson], (err2, r) => {
        if (err2) return res.status(500).json({ error: 'Erro ao inserir' });
        res.json({ success: true, id: r.id });
      });
    }
  });
});

// --- FREQUÊNCIA ---
app.post('/api/frequencia/registrar', authenticateToken, (req, res) => {
  const { mesAno, porcentagem, userId } = req.body;
  if (!mesAno || porcentagem === undefined || !userId) {
    return res.status(400).send('Dados incompletos para registro.');
  }

  db.get(`SELECT * FROM frequenciasAnteriores WHERE userId = ? AND mesAno = ?`, [userId, mesAno], (err, row) => {
    if (err) return res.status(500).send('Erro ao verificar frequência.');
    if (row) return res.status(200).send('Registro já existente.');

    db.run(`INSERT INTO frequenciasAnteriores (userId, mesAno, porcentagem) VALUES (?, ?, ?)`,
      [userId, mesAno, porcentagem],
      function (err2) {
        if (err2) return res.status(500).send('Erro ao registrar frequência.');
        res.status(201).send('Frequência registrada com sucesso.');
      }
    );
  });
});

app.get('/api/frequencia/historico', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(`SELECT mesAno, porcentagem FROM frequenciasAnteriores WHERE userId = ? ORDER BY mesAno DESC`, [userId], (err, rows) => {
    if (err) return res.status(500).send('Erro ao buscar histórico.');
    res.json(rows);
  });
});

// --- TAREFAS (professor) ---
app.get('/api/tarefas/professor', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT id, titulo, descricao, prazo, turmas, recompensaGold, createdAt
    FROM tarefas
    WHERE professorId = ?
    ORDER BY createdAt DESC
  `;
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar tarefas:', err);
      return res.status(500).json({ error: 'Erro ao buscar tarefas.' });
    }
    const tarefas = rows.map(row => {
      let turmasArray = [];
      try {
        if (row.turmas && row.turmas.trim() !== '') {
          turmasArray = JSON.parse(row.turmas);
        }
      } catch {
        console.warn('JSON inválido em turmas para tarefa ID:', row.id, row.turmas);
        turmasArray = [];
      }
      return {
        id: row.id,
        titulo: row.titulo,
        descricao: row.descricao,
        prazo: row.prazo,
        turmas: turmasArray,
        recompensaGold: row.recompensaGold || 0,
        createdAt: row.createdAt
      };
    });
    res.json(tarefas);
  });
});

app.get('/api/tarefas/professor/:tarefaId/alunos', authenticateToken, (req, res) => {
  const professorId = req.user.id;
  const tarefaId = req.params.tarefaId;

  db.get(`SELECT turmas FROM tarefas WHERE id = ? AND professorId = ?`, [tarefaId, professorId], (err, tarefaRow) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar tarefa.' });
    if (!tarefaRow) return res.status(404).json({ error: 'Tarefa não encontrada.' });

    let turmasIds;
    try { turmasIds = JSON.parse(tarefaRow.turmas); }
    catch { return res.status(500).json({ error: 'Dados da tarefa corrompidos.' }); }

    if (!Array.isArray(turmasIds) || turmasIds.length === 0) return res.json([]);

    const placeholders = turmasIds.map(() => '?').join(',');
    const sqlAlunos = `
      SELECT a.data, t.userId as professorId
      FROM alunos a
      JOIN turmas t ON a.userId = t.userId
      WHERE t.id IN (${placeholders})
    `;

    db.all(sqlAlunos, turmasIds, (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'Erro ao buscar alunos.' });

      const todosAlunos = [];
      rows.forEach(row => {
        try {
          const alunosDoProfessor = JSON.parse(row.data);
          alunosDoProfessor.forEach(aluno => {
            if (aluno.turmas && aluno.turmas.some(tid => turmasIds.includes(tid))) {
              todosAlunos.push({ ctr: aluno.ctr, nome: aluno.nome, userId: aluno.userId });
            }
          });
        } catch (e) { console.error('Erro ao parsear alunos:', e); }
      });

      // únicos por ctr
      const unicos = [];
      const vistos = new Set();
      todosAlunos.forEach(a => { if (!vistos.has(a.ctr)) { vistos.add(a.ctr); unicos.push(a); } });

      if (unicos.length === 0) return res.json([]);

      const ids = unicos.map(a => a.userId);
      const placeholders2 = ids.map(() => '?').join(',');
      const sqlConclusoes = `
        SELECT alunoId, entregue, corrigida, dataEntrega, fotoEntrega
        FROM conclusoesTarefas
        WHERE tarefaId = ? AND alunoId IN (${placeholders2})
      `;

      db.all(sqlConclusoes, [tarefaId, ...ids], (err3, conclusoes) => {
        if (err3) return res.status(500).json({ error: 'Erro ao buscar status.' });

        const conclusaoMap = {};
        conclusoes.forEach(c => {
          conclusaoMap[c.alunoId] = {
            entregue: !!c.entregue,
            corrigida: !!c.corrigida,
            dataEntrega: c.dataEntrega,
            fotoEntrega: c.fotoEntrega
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
      });
    });
  });
});

app.delete('/api/tarefas/:id', authenticateToken, (req, res) => {
  const professorId = req.user.id;
  const tarefaId = req.params.id;

  db.run(`DELETE FROM conclusoesTarefas WHERE tarefaId = ?`, [tarefaId], function (err) {
    if (err) {
      console.error('Erro ao deletar conclusões da tarefa:', err);
      return res.status(500).json({ error: 'Erro ao limpar dados associados à tarefa.' });
    }

    db.run(`DELETE FROM tarefas WHERE id = ? AND professorId = ?`, [tarefaId, professorId], function (err2) {
      if (err2) {
        console.error('Erro ao deletar tarefa:', err2);
        return res.status(500).json({ error: 'Erro ao deletar tarefa no banco.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este usuário.' });
      }
      res.json({ success: true, message: 'Tarefa deletada com sucesso.' });
    });
  });
});

app.put('/api/tarefas/:id', authenticateToken, (req, res) => {
  const professorId = req.user.id;
  const tarefaId = req.params.id;
  const { titulo, descricao, prazo, turmas, recompensaGold } = req.body;

  if (!titulo || !turmas || !Array.isArray(turmas) || turmas.length === 0) {
    return res.status(400).json({ error: 'Título e pelo menos uma turma são obrigatórios.' });
  }

  const sql = `
    UPDATE tarefas SET
      titulo = ?,
      descricao = ?,
      prazo = ?,
      turmas = ?,
      recompensaGold = ?
    WHERE id = ? AND professorId = ?
  `;
  db.run(sql, [
    titulo,
    descricao || '',
    prazo || '',
    JSON.stringify(turmas),
    recompensaGold || 0,
    tarefaId,
    professorId
  ], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar tarefa.' });
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este usuário.' });
    }
    res.json({ success: true, message: 'Tarefa atualizada com sucesso.', recompensaGold: recompensaGold || 0 });
  });
});

app.post('/api/tarefas', authenticateToken, (req, res) => {
  const { titulo, descricao, prazo, turmas, recompensaGold } = req.body;
  const professorId = req.user.id;

  if (!titulo || !turmas || !Array.isArray(turmas) || turmas.length === 0) {
    return res.status(400).json({ error: 'Título e pelo menos uma turma são obrigatórios.' });
  }

  const createdAt = new Date().toISOString();
  const sql = `
    INSERT INTO tarefas (professorId, titulo, descricao, prazo, turmas, recompensaGold, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `;
  db.get(sql, [
    professorId,
    titulo,
    descricao || '',
    prazo || '',
    JSON.stringify(turmas),
    recompensaGold || 0,
    createdAt
  ], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao salvar tarefa.' });
    res.status(201).json({
      id: row.id, titulo, descricao, prazo, turmas, recompensaGold: recompensaGold || 0, createdAt
    });
  });
});

// --- TAREFAS (aluno) ---
app.get('/api/tarefas/aluno', authenticateToken, async (req, res) => {
  const alunoId = req.user.id;

  try {
    const alunoRows = await new Promise((resolve, reject) => {
      db.all(`SELECT data FROM alunos`, (err, rows) => err ? reject(err) : resolve(rows));
    });
    if (!alunoRows || alunoRows.length === 0) return res.json([]);

    let alunoData;
    for (const row of alunoRows) {
      const alunos = JSON.parse(row.data);
      const encontrado = alunos.find(a => a.userId === alunoId);
      if (encontrado) { alunoData = encontrado; break; }
    }
    if (!alunoData?.turmas?.length) return res.json([]);
    const turmasDoAluno = new Set(alunoData.turmas);

    const todasAsTarefas = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          t.id, t.titulo, t.descricao, t.prazo, t.createdAt, t.turmas, t.recompensaGold,
          ct.entregue, ct.corrigida, ct.dataEntrega, ct.fotoEntrega
        FROM tarefas t
        LEFT JOIN conclusoesTarefas ct ON t.id = ct.tarefaId AND ct.alunoId = ?
        ORDER BY t.createdAt DESC
      `;
      db.all(sql, [alunoId], (err, rows) => err ? reject(err) : resolve(rows));
    });

    const tarefasDoAluno = todasAsTarefas
      .filter(tarefa => {
        try {
          const turmasDaTarefa = JSON.parse(tarefa.turmas);
          return turmasDaTarefa.some(turmaId => turmasDoAluno.has(turmaId));
        } catch { return false; }
      })
      .map(t => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        prazo: t.prazo,
        createdAt: t.createdAt,
        recompensaGold: t.recompensaGold || 0,
        entregue: !!t.entregue,
        corrigida: !!t.corrigida,
        dataEntrega: t.dataEntrega,
        fotoEntrega: t.fotoEntrega
      }));

    res.json(tarefasDoAluno);
  } catch (err) {
    console.error('Erro ao buscar tarefas do aluno:', err);
    res.status(500).json({ error: 'Erro interno ao buscar tarefas.' });
  }
});

// Aluno entrega tarefa (com foto)
app.post('/api/tarefas/entregar', authenticateToken, upload.single('foto'), (req, res) => {
  const { tarefaId } = req.body;
  const alunoId = req.user.id;
  const foto = req.file;

  if (!tarefaId) return res.status(400).json({ message: 'ID da tarefa é obrigatório.' });
  if (!foto) return res.status(400).json({ message: 'Foto do exercício é obrigatória.' });

  const fotoBase64 = `data:${foto.mimetype};base64,${foto.buffer.toString('base64')}`;
  const agora = new Date().toISOString();

  const sql = `
    INSERT INTO conclusoesTarefas (
      tarefaId, alunoId, entregue, dataEntrega, fotoEntrega, concluido, dataConclusao
    ) VALUES (?, ?, 1, ?, ?, 1, ?)
    ON CONFLICT(tarefaId, alunoId) DO UPDATE SET
      entregue = 1,
      dataEntrega = ?,
      fotoEntrega = ?,
      concluido = 1,
      dataConclusao = ?
  `;
  db.run(sql, [tarefaId, alunoId, agora, fotoBase64, agora, agora, fotoBase64, agora], function (err) {
    if (err) {
      console.error('Erro ao entregar tarefa:', err);
      return res.status(500).json({ message: 'Erro ao salvar entrega.' });
    }
    res.json({ success: true, message: 'Tarefa entregue com sucesso!' });
  });
});

app.post('/api/tarefas/corrigir', authenticateToken, (req, res) => {
  const { alunoId, tarefaId, status } = req.body;
  const agora = new Date().toISOString();

  if (!alunoId || !tarefaId || !['completo', 'incompleto'].includes(status)) {
    return res.status(400).json({ message: 'Dados inválidos.' });
  }

  const corrigidaValue = 1;
  const sqlUpdate = `
    UPDATE conclusoesTarefas
    SET corrigida = ?, dataCorrecao = ?
    WHERE tarefaId = ? AND alunoId = ?
  `;

  db.run(sqlUpdate, [corrigidaValue, agora, tarefaId, alunoId], function (err) {
    if (err) {
      console.error('❌ Erro ao atualizar conclusoesTarefas:', err);
      return res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Entrega não encontrada.' });
    }

    if (status === 'completo') {
      db.get('SELECT recompensaGold FROM tarefas WHERE id = ?', [tarefaId], (errT, tarefa) => {
        if (errT || !tarefa || tarefa.recompensaGold <= 0) {
          return res.json({ success: true, message: 'Tarefa corrigida (sem recompensa).' });
        }
        const recompensa = tarefa.recompensaGold;

        db.get('SELECT username FROM users WHERE id = ?', [alunoId], (errU, userRow) => {
          if (errU || !userRow) return res.status(404).json({ message: 'Aluno não encontrado.' });

          const alunoCtr = userRow.username;
          db.all('SELECT userId, data FROM alunos', [], (errA, rows) => {
            if (errA) return res.status(500).json({ message: 'Erro ao buscar dados.' });

            let alunoAtualizado = false;
            for (const row of rows) {
              try {
                const alunosArray = JSON.parse(row.data);
                const idx = alunosArray.findIndex(a => a.ctr === alunoCtr);
                if (idx !== -1) {
                  alunosArray[idx].gold = (alunosArray[idx].gold || 0) + recompensa;
                  db.run('UPDATE alunos SET data = ? WHERE userId = ?', [JSON.stringify(alunosArray), row.userId], (e) => {
                    if (e) console.error('❌ Erro ao salvar gold:', e);
                  });
                  alunoAtualizado = true;
                  break;
                }
              } catch {}
            }
            if (!alunoAtualizado) {
              return res.status(404).json({ message: 'Aluno não encontrado para recompensa.' });
            }
            res.json({ success: true, message: `+${recompensa} golds creditados!` });
          });
        });
      });
    } else {
      res.json({ success: true, message: 'Tarefa marcada como incompleta.' });
    }
  });
});

app.post('/api/tarefas/concluir', authenticateToken, (req, res) => {
  const { tarefaId } = req.body;
  const alunoId = req.user.id;
  const agora = new Date().toISOString();

  const sql = `
    INSERT INTO conclusoesTarefas (tarefaId, alunoId, concluido, dataConclusao)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(tarefaId, alunoId) DO UPDATE SET
      concluido = 1, dataConclusao = ?
  `;
  db.run(sql, [tarefaId, alunoId, agora, agora], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao concluir tarefa.' });
    res.json({ success: true });
  });
});

// --- LOJA ---
app.post('/api/itens', authenticateToken, (req, res) => {
  const { role } = req.user;
  if (role !== 'professor' && role !== 'admin') {
    return res.status(403).json({ error: 'Apenas professores podem criar itens.' });
  }

  const { nome, descricao, efeito, slot, power, preco, icone, privado } = req.body;
  if (!nome || !descricao || !efeito || !slot || power == null || preco == null || !icone) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }
  if (typeof power !== 'number' || power < 1) {
    return res.status(400).json({ error: 'Power deve ser um número >= 1.' });
  }
  if (typeof preco !== 'number' || preco < 1) {
    return res.status(400).json({ error: 'Preço deve ser um número >= 1.' });
  }
  const slotsPermitidos = ['cabeca', 'camisa', 'calca', 'pes', 'artefato'];
  if (!slotsPermitidos.includes(slot)) {
    return res.status(400).json({ error: 'Slot inválido.' });
  }

  const sql = `
    INSERT INTO itens_loja (nome, descricao, efeito, slot, power, preco, icone, privado, criadoPor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `;
  db.get(sql, [
    nome, descricao, efeito, slot, power, preco, icone, !!privado, req.user.id
  ], (err, row) => {
    if (err) {
      console.error('Erro ao criar item:', err);
      return res.status(500).json({ error: 'Erro ao salvar item.' });
    }
    res.status(201).json({
      id: row.id, nome, descricao, efeito, slot, power, preco, privado: !!privado, icone
    });
  });
});

app.get('/api/itens', authenticateToken, (req, res) => {
  db.all(`SELECT id, nome, descricao, efeito, slot, power, preco, icone FROM itens_loja WHERE privado = 0`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar itens.' });
    res.json(rows);
  });
});

app.get('/api/itens/professor', authenticateToken, (req, res) => {
  if (req.user.role !== 'professor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado: apenas professores podem acessar esta lista.' });
  }
  db.all(`SELECT id, nome, descricao, efeito, slot, power, preco, icone FROM itens_loja`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar itens.' });
    res.json(rows);
  });
});

app.get('/api/itens/:id', authenticateToken, (req, res) => {
  const itemId = req.params.id;
  db.get(`SELECT * FROM itens_loja WHERE id = ?`, [itemId], (err, item) => {
    if (err || !item) return res.status(404).json({ error: 'Item não encontrado.' });
    delete item.criadoPor;
    res.json(item);
  });
});

app.delete('/api/itens/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'professor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
  const itemId = req.params.id;
  db.run(`DELETE FROM itens_loja WHERE id = ? AND criadoPor = ?`, [itemId, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir item.' });
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Item não encontrado ou não pertence a você.' });
    }
    res.json({ success: true });
  });
});

app.patch('/api/itens/:id/privar', authenticateToken, (req, res) => {
  if (req.user.role !== 'professor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
  const { privado } = req.body;
  const itemId = req.params.id;
  const valorPrivado = privado ? 1 : 0;

  db.run(
    `UPDATE itens_loja SET privado = ? WHERE id = ? AND criadoPor = ?`,
    [valorPrivado, itemId, req.user.id],
    function (err) {
      if (err) {
        console.error('Erro ao atualizar item:', err);
        return res.status(500).json({ error: 'Erro ao atualizar item.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Item não encontrado ou não pertence a você.' });
      }
      res.json({ success: true, privado: valorPrivado });
    }
  );
});

app.post('/api/comprar', authenticateToken, (req, res) => {
  const { itemId } = req.body;
  const alunoId = req.user.id;
  const alunoCtr = req.user.username;

  if (!itemId) return res.status(400).json({ error: 'ID do item é obrigatório.' });

  db.get(`SELECT * FROM itens_loja WHERE id = ?`, [itemId], (err, item) => {
    if (err || !item) return res.status(404).json({ error: 'Item não encontrado.' });
    if (item.privado === 1) return res.status(403).json({ error: 'Item não disponível para compra.' });

    db.all(`SELECT userId, data FROM alunos`, [], (err2, allAlunosRows) => {
      if (err2) return res.status(500).json({ error: 'Erro ao buscar dados de alunos.' });

      let alunoEncontrado = null;
      let professorUserId = null;
      let alunosDoProfessor = null;
      let alunoIndex = -1;

      for (const row of allAlunosRows) {
        try {
          const alunos = JSON.parse(row.data);
          const index = alunos.findIndex(a => a.ctr === alunoCtr);
          if (index !== -1) {
            alunoEncontrado = alunos[index];
            professorUserId = row.userId;
            alunosDoProfessor = alunos;
            alunoIndex = index;
            break;
          }
        } catch {}
      }

      if (!alunoEncontrado) {
        return res.status(404).json({ error: 'Seu perfil de aluno não foi encontrado.' });
      }

      const gold = alunoEncontrado.gold || 0;
      const preco = item.preco;
      if (gold < preco) {
        return res.status(400).json({ error: 'Gold insuficiente.' });
      }

      alunoEncontrado.gold = gold - preco;
      if (!alunoEncontrado.mochila) alunoEncontrado.mochila = [];
      alunoEncontrado.mochila.push({
        id: item.id,
        nome: item.nome,
        icone: item.icone,
        slot: item.slot,
        power: item.power,
        efeito: item.efeito
      });

      alunosDoProfessor[alunoIndex] = alunoEncontrado;
      db.run(
        `UPDATE alunos SET data = ? WHERE userId = ?`,
        [JSON.stringify(alunosDoProfessor), professorUserId],
        (err3) => {
          if (err3) return res.status(500).json({ error: 'Erro ao salvar compra.' });
          res.json({ success: true, novoGold: alunoEncontrado.gold, itemComprado: item });
        }
      );
    });
  });
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
