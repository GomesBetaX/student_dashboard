const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const db = require('../database/db');

// GET /api/student/profile
router.get('/profile', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  const studentUserId = req.user.id;
  const studentCtr = req.user.username;

  db.all(`SELECT userId, data FROM alunos`, [], (err, allAlunosRows = []) => {
    if (err) {
      console.error('❌ Erro ao buscar alunos:', err);
      return res.status(500).json({ message: 'Erro ao buscar dados de alunos.' });
    }

    let alunoData = null;
    let professorUserId = null;

    for (const row of allAlunosRows) {
      try {
        const alunosDoProfessor = JSON.parse(row.data || '[]');
        const found = alunosDoProfessor.find(a => a.ctr === studentCtr);
        if (found) {
          alunoData = found;
          professorUserId = row.userId;
          break;
        }
      } catch (e) {
        console.warn('⚠️ JSON inválido em alunos.userId =', row.userId, e.message);
      }
    }

    if (!alunoData) {
      return res.status(404).json({ message: 'Dados detalhados do aluno não encontrados.' });
    }

    const turmasIds = Array.isArray(alunoData.turmas) ? alunoData.turmas : [];
    if (turmasIds.length === 0) {
      return res.json({
        id: studentUserId,
        nome: req.user.name,
        ctr: studentCtr,
        status: alunoData.status || 'ativo',
        turmas: [],
        presencas: alunoData.presencas || {},
        pic: alunoData.pic || 'assets/profile-placeholder.jpg',
        coverPic: alunoData.coverPic || 'assets/cover-placeholder.png',
        gold: alunoData.gold || 100,
        mochila: alunoData.mochila || [],
        equipamentos: alunoData.equipamentos || {}
      });
    }

    // PostgreSQL requer placeholders numerados ($1, $2, ...)
    const placeholders = turmasIds.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT * FROM turmas WHERE id IN (${placeholders})`;

    db.all(sql, turmasIds, (err2, turmasRows = []) => {
      if (err2) {
        console.error('❌ Erro ao buscar turmas:', err2);
        return res.status(500).json({ message: 'Erro ao buscar turmas.' });
      }

      const turmasAluno = turmasRows.map(turma => ({
        id: turma.id,
        nome: turma.nome || 'Turma sem nome',
        diasAula: safeParse(turma.diasaula, []),
        horario: turma.horario || '',
        finalizada: !!turma.finalizada,
        dataInicio: turma.datainicio || '',
        expandido: !!turma.expandido,
        aulasDesativadas: safeParse(turma.aulasdesativadas, []),
        planejamentos: safeParse(turma.planejamentos, {})
      }));

      res.json({
        id: studentUserId,
        nome: req.user.name,
        ctr: studentCtr,
        status: alunoData.status || 'ativo',
        turmas: turmasAluno,
        gold: alunoData.gold || 0,
        mochila: alunoData.mochila || [],
        equipamentos: alunoData.equipamentos || {},
        presencas: alunoData.presencas || {},
        pic: alunoData.pic || 'assets/profile-placeholder.jpg',
        coverPic: alunoData.coverPic || 'assets/cover-placeholder.png'
      });
    });
  });
});

// Função de parse segura
function safeParse(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); }
  catch { return fallback; }
}



// PUT /api/student/profile → Atualiza perfil do aluno (foto, gold, mochila, equipamentos, etc.)
// PUT /api/student/profile
router.put('/profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  const { gold, mochila, equipamentos, presencas, pic, coverPic } = req.body;
  const studentCtr = req.user.username;

  try {
    // 🔹 Busca todos os registros de alunos
    db.all(`SELECT id, userId, data FROM alunos`, [], async (err, rows = []) => {
      if (err) {
        console.error('❌ Erro ao buscar alunos:', err);
        return res.status(500).json({ message: 'Erro ao buscar dados de alunos.' });
      }

      let foundRow = null;
      let alunoArray = [];

      for (const row of rows) {
        try {
          alunoArray = JSON.parse(row.data || '[]');
          const aluno = alunoArray.find(a => a.ctr === studentCtr);
          if (aluno) {
            foundRow = row;
            break;
          }
        } catch (e) {
          console.warn('⚠️ JSON inválido em alunos.userId =', row.userId);
        }
      }

      if (!foundRow) {
        return res.status(404).json({ message: 'Aluno não encontrado.' });
      }

      // 🔹 Atualiza os dados do aluno no array
      alunoArray = alunoArray.map(a => {
        if (a.ctr === studentCtr) {
          return {
            ...a,
            gold: gold ?? a.gold,
            mochila: mochila ?? a.mochila,
            equipamentos: equipamentos ?? a.equipamentos,
            presencas: presencas ?? a.presencas,
            pic: pic ?? a.pic,
            coverPic: coverPic ?? a.coverPic
          };
        }
        return a;
      });

      // 🔹 Atualiza o JSON completo no banco
      const updatedJson = JSON.stringify(alunoArray);
      const sql = `UPDATE alunos SET data = $1 WHERE id = $2`;

      db.run(sql, [updatedJson, foundRow.id], (updateErr) => {
        if (updateErr) {
          console.error('❌ Erro ao atualizar aluno:', updateErr);
          return res.status(500).json({ message: 'Erro ao atualizar perfil do aluno.' });
        }
        res.json({ message: 'Perfil atualizado com sucesso!' });
      });
    });
  } catch (err) {
    console.error('❌ Erro inesperado no PUT /profile:', err);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});



module.exports = router;