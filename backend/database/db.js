const path = require('path');
const Database = require('better-sqlite3');

// Caminho completo para o banco de dados (dentro da pasta database)
const dbPath = path.join(__dirname, 'app.db');
const db = new Database(dbPath);

// Cria tabelas se não existirem
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turmas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    nome TEXT NOT NULL,
    codigo TEXT,
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
);

CREATE TABLE IF NOT EXISTS alunos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS professores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS frequenciasAnteriores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    mesAno TEXT NOT NULL,
    porcentagem REAL NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    professorId INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    prazo TEXT,
    turmas TEXT NOT NULL,
    recompensaGold INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (professorId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS conclusoesTarefas (
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
);

CREATE TABLE IF NOT EXISTS itens_loja (
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
);

CREATE TABLE IF NOT EXISTS arena (
    alunoId INTEGER PRIMARY KEY,
    pvpAtivado BOOLEAN DEFAULT 0,
    cansadoAte TEXT,
    FOREIGN KEY (alunoId) REFERENCES users(id)
);
`);

console.log('✅ Banco SQLite iniciado com better-sqlite3 em', dbPath);
module.exports = db;
