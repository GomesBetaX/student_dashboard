const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conecta ou cria o arquivo do banco de dados na pasta 'database'
const db = new sqlite3.Database(path.join(__dirname, 'app.db'), (err) => {
    if (err) {
        // Exibe um erro se a conexão falhar
        console.error('Erro ao conectar ao banco:', err);
    } else {
        console.log('Conectado ao banco SQLite');

        // Cria a tabela de usuários se ela não existir [2]
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )`);

        // Cria a tabela de turmas, com a coluna 'codigo' adicionada [3]
        db.run(`CREATE TABLE IF NOT EXISTS turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            nome TEXT NOT NULL,
            codigo TEXT, -- <-- CORREÇÃO APLICADA AQUI
            diasAula TEXT NOT NULL,
            horario TEXT NOT NULL,
            dataInicio TEXT,
            tipo TEXT,
            duracao INTEGER,
            finalizada BOOLEAN DEFAULT 0,
            expandido BOOLEAN DEFAULT 1,
            aulasDesativadas TEXT,
            planejamentos TEXT,
            alunos TEXT,
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);

        // Cria a tabela de alunos [3]
        db.run(`CREATE TABLE IF NOT EXISTS alunos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            data TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);

        // Cria a tabela de professores [4]
        db.run(`CREATE TABLE IF NOT EXISTS professores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            data TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);

        // Cria tabela para armazenar o histórico de frequência [4]
        db.run(`CREATE TABLE IF NOT EXISTS frequenciasAnteriores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            mesAno TEXT NOT NULL,
            porcentagem REAL NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);

        // Cria tabela de tarefas (atribuídas pelo professor)
        db.run(`CREATE TABLE IF NOT EXISTS tarefas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            professorId INTEGER NOT NULL,
            titulo TEXT NOT NULL,
            descricao TEXT,
            prazo TEXT,
            turmas TEXT NOT NULL, -- JSON array de IDs de turmas
            recompensaGold INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (professorId) REFERENCES users(id)
        )`);

        // Cria tabela de conclusões (status por aluno)
        db.run(`CREATE TABLE IF NOT EXISTS conclusoesTarefas (
            tarefaId INTEGER NOT NULL,
            alunoId INTEGER NOT NULL,
            alunoCtr TEXT,
            concluido BOOLEAN DEFAULT 0,     
            entregue BOOLEAN DEFAULT 0,      
            corrigida BOOLEAN DEFAULT 0,     
            dataConclusao TEXT,              
            dataEntrega TEXT,                
            dataCorrecao TEXT,               
            fotoEntrega TEXT,                
            PRIMARY KEY (tarefaId, alunoId),
            FOREIGN KEY (tarefaId) REFERENCES tarefas(id),
            FOREIGN KEY (alunoId) REFERENCES users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS itens_loja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT NOT NULL,
            efeito TEXT NOT NULL,
            slot TEXT NOT NULL,
            power INTEGER NOT NULL,
            preco INTEGER NOT NULL,
            icone TEXT NOT NULL,
            privado BOOLEAN DEFAULT 0,
            criadoPor INTEGER
        )`);

        // Cria tabela de Arena PVP
        db.run(`CREATE TABLE IF NOT EXISTS arena (
            alunoId INTEGER PRIMARY KEY,
            pvpAtivado BOOLEAN DEFAULT 0,
            cansadoAte TEXT, -- ISO string da data/hora do fim do cansaço
            FOREIGN KEY (alunoId) REFERENCES users(id)
        )`);
    }
});

// Exporta o objeto do banco de dados para ser usado em outros módulos
module.exports = db;