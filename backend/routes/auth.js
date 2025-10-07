// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth'); // Certifique-se de que esta importação existe

require('dotenv').config();

// Login: username + password
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  User.findByUsername(username, (err, user) => {
    if (err || !user) return res.status(400).json({ message: 'Usuário ou senha inválidos.' });

    bcrypt.compare(password, user.password, (err, isValid) => {
      if (!isValid) return res.status(400).json({ message: 'Usuário ou senha inválidos.' });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, name: user.name }, // ✅ Inclui o role no token
        process.env.JWT_SECRET || 'secreto-muito-forte',
        { expiresIn: '1h' }
      );

      // ✅ Usa o role salvo no banco
      const account = {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,  // ← Agora pega do banco
        createdAt: new Date().toISOString(),
        isActive: true
      };

      res.json({
        message: 'Login bem-sucedido!',
        token,
        account
      });
    });
  });
});

// Registro: name, username, password + registerCode
router.post('/register', (req, res) => {
  const { name, username, password, registerCode } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  // ✅ Validação do código de acesso
  let role = 'student'; // padrão (não usado aqui, só professores/admins se registram)
  if (registerCode === 'G#master') {
    role = 'admin';
  } else if (registerCode === 'G#1698') {
    role = 'professor';
  } else {
    return res.status(403).json({ message: 'Código de acesso inválido.' });
  }

  User.findByUsername(username, (err, existingUser) => {
    if (err) {
      return res.status(500).json({ message: 'Erro no banco de dados.' });
    }
    if (existingUser) {
      return res.status(400).json({ message: 'Nome de usuário já existe.' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).json({ message: 'Erro ao criar senha.' });

      // ✅ Passa o role para User.create
      User.create(name, username, hashedPassword, role, (err, newUser) => {
        if (err) {
          console.error('Erro ao salvar usuário:', err);
          return res.status(500).json({ message: 'Erro ao criar usuário.' });
        }

        res.status(201).json({
          message: `Conta de ${role === 'admin' ? 'administrador' : 'professor'} criada com sucesso!`
        });
      });
    });
  });
});


// Novo endpoint para professores/admins registrarem alunos como usuários
// Protegido, pois apenas usuários logados com a role apropriada podem adicionar alunos
router.post('/registerStudent', authenticateToken, (req, res) => {
    const { name, username, password } = req.body; // 'username' será o CTR do aluno
    if (!name || !username || !password) {
        return res.status(400).json({ message: 'Nome, CTR (username) e senha são obrigatórios.' });
    }

    // Verifica se o usuário autenticado tem permissão para registrar alunos
    if (req.user.role !== 'admin' && req.user.role !== 'professor') {
        return res.status(403).json({ message: 'Apenas professores e administradores podem registrar alunos.' });
    }

    User.findByUsername(username, (err, existingUser) => {
        if (err) {
            return res.status(500).json({ message: 'Erro no banco de dados.' });
        }
        if (existingUser) {
            return res.status(400).json({ message: 'CTR (nome de usuário) já existe.' });
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return res.status(500).json({ message: 'Erro ao criar senha para o aluno.' });

            // Cria o usuário na tabela 'users' com a role 'student' [13]
            User.create(name, username, hashedPassword, 'student', (err, newUser) => {
                if (err) {
                    console.error('Erro ao salvar usuário aluno:', err);
                    return res.status(500).json({ message: 'Erro ao criar conta de aluno.' });
                }
                res.status(201).json({
                    message: 'Conta de aluno criada com sucesso!',
                    studentUserId: newUser.id, // Retorna o ID do novo usuário (da tabela 'users')
                    studentName: newUser.name,
                    studentUsername: newUser.username // Isso será o CTR
                });
            });
        });
    });
});

module.exports = router;