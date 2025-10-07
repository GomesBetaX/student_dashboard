const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const db = require('../database/db');

router.get('/profile', authenticateToken, (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Acesso negado.' });
    }

    const studentUserId = req.user.id;
    const studentCtr = req.user.username;

    // 1. Encontra todos os registros da tabela `alunos` (um por professor)
    db.all(`SELECT userId, data FROM alunos`, [], (err, allAlunosRows) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao buscar dados de alunos.' });
        }

        let alunoData = null;
        let professorUserId = null;

        // 2. Procura em cada registro de professor pelo aluno com o CTR correspondente
        for (const row of allAlunosRows) {
            try {
                const alunosDoProfessor = JSON.parse(row.data);
                const found = alunosDoProfessor.find(a => a.ctr === studentCtr);
                if (found) {
                    alunoData = found;
                    professorUserId = row.userId;
                    break; // Para a busca assim que encontrar o aluno
                }
            } catch (e) {
                console.error('Erro ao parsear JSON de alunos para o professor ID:', row.userId, e);
            }
        }

        // 3. Se o aluno não foi encontrado em nenhum registro de professor
        if (!alunoData) {
            return res.status(404).json({ message: 'Dados detalhados do aluno não encontrados.' });
        }
        
        // 4. Com os dados do aluno encontrados (que contêm o array de IDs de turmas), busca os detalhes das turmas
        const turmasIds = alunoData.turmas || []; // Ex: [9, 10]
        if (turmasIds.length === 0) {
            // Se o aluno não está em turmas, retorna o perfil sem fazer a consulta de turmas
            return res.json({
                id: studentUserId,
                nome: req.user.name,
                ctr: studentCtr,
                status: alunoData.status || 'ativo',
                turmas: [],
                presencas: alunoData.presencas || {},
                pic: alunoData.pic || 'assets/profile-placeholder.jpg',
                coverPic: alunoData.coverPic || 'assets/cover-placeholder.png',
                // === CAMPOS DE JOGO ADICIONADOS ===
                gold: alunoData.gold || 100,
                mochila: alunoData.mochila || [],
                equipamentos: alunoData.equipamentos || {}

            });
        }
        
        // 5. Busca as informações das turmas usando os IDs corretos
        db.all(`SELECT * FROM turmas WHERE id IN (${turmasIds.map(() => '?').join(',')})`,
            turmasIds,
            (err, turmasRows) => {
                if (err) {
                    return res.status(500).json({ message: 'Erro ao buscar turmas.' });
                }

                const turmasAluno = turmasRows.map(turma => ({
                    id: turma.id,
                    nome: turma.nome,
                    diasAula: JSON.parse(turma.diasAula),
                    horario: turma.horario,
                    finalizada: !!turma.finalizada,
                    dataInicio: turma.dataInicio,
                    expandido: !!turma.expandido,
                    aulasDesativadas: turma.aulasDesativadas ? JSON.parse(turma.aulasDesativadas) : [],
                    planejamentos: turma.planejamentos ? JSON.parse(turma.planejamentos) : {}
                }));

                // Resposta final com os dados corretos
                res.json({
                    id: studentUserId,
                    nome: req.user.name,
                    ctr: studentCtr,
                    status: alunoData.status || 'ativo',
                    turmas: turmasAluno,
                    gold: alunoData.gold, // === CAMPOS DE JOGO ADICIONADOS ===
                    mochila: alunoData.mochila || [],
                    equipamentos: alunoData.equipamentos || {},
                    presencas: alunoData.presencas || {},
                    pic: alunoData.pic || 'assets/profile-placeholder.jpg',
                    coverPic: alunoData.coverPic || 'assets/cover-placeholder.png'
                });
            }
        );
    });
});


// PUT /api/student/profile → Atualiza perfil do aluno (foto, gold, mochila, equipamentos, etc.)
router.put('/profile', authenticateToken, (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Acesso negado.' });
    }

    const studentCtr = req.user.username;
    const updates = req.body; // Pode conter: { pic, gold, mochila, equipamentos, ... }

    // 1. Busca todos os registros da tabela `alunos` para encontrar o professor do aluno
    db.all(`SELECT userId, data FROM alunos`, [], (err, allAlunosRows) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao buscar dados.' });
        }

        let professorUserId = null;
        let alunosDoProfessor = null;
        let alunoIndex = -1;

        // 2. Encontra o registro do professor e o aluno específico
        for (const row of allAlunosRows) {
            const parsedData = JSON.parse(row.data);
            const index = parsedData.findIndex(a => a.ctr === studentCtr);
            if (index !== -1) {
                professorUserId = row.userId;
                alunosDoProfessor = parsedData;
                alunoIndex = index;
                break;
            }
        }

        if (alunoIndex === -1) {
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        // 3. Atualiza APENAS os campos fornecidos em `updates`
        const alunoAtual = alunosDoProfessor[alunoIndex];
        for (const key in updates) {
            if (updates[key] !== undefined) {
                alunoAtual[key] = updates[key];
            }
        }

        // 4. Salva de volta
        db.run(
            `UPDATE alunos SET data = ? WHERE userId = ?`,
            [JSON.stringify(alunosDoProfessor), professorUserId],
            function(err) {
                if (err) {
                    return res.status(500).json({ message: 'Erro ao salvar dados.' });
                }
                res.json({ success: true, message: 'Dados atualizados com sucesso!', aluno: alunoAtual });
            }
        );
    });
});


module.exports = router;