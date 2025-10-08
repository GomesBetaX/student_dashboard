-- ================================================
-- ✅ SCHEMA COMPLETO - STUDENT DASHBOARD (PostgreSQL)
-- ================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turmas (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    nome TEXT NOT NULL,
    codigo TEXT,
    diasAula TEXT NOT NULL,
    horario TEXT NOT NULL,
    dataInicio TEXT,
    tipo TEXT,
    duracao INTEGER,
    finalizada BOOLEAN DEFAULT false,
    expandido BOOLEAN DEFAULT true,
    aulasDesativadas TEXT,
    planejamentos TEXT,
    alunos TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS alunos (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS professores (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS frequenciasAnteriores (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    mesAno TEXT NOT NULL,
    porcentagem REAL NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tarefas (
    id SERIAL PRIMARY KEY,
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
    concluido BOOLEAN DEFAULT false,
    entregue BOOLEAN DEFAULT false,
    corrigida BOOLEAN DEFAULT false,
    dataConclusao TEXT,
    dataEntrega TEXT,
    dataCorrecao TEXT,
    fotoEntrega TEXT,
    PRIMARY KEY (tarefaId, alunoId),
    FOREIGN KEY (tarefaId) REFERENCES tarefas(id),
    FOREIGN KEY (alunoId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS itens_loja (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT NOT NULL,
    efeito TEXT NOT NULL,
    slot TEXT NOT NULL,
    power INTEGER NOT NULL,
    preco INTEGER NOT NULL,
    icone TEXT NOT NULL,
    privado BOOLEAN DEFAULT false,
    criadoPor INTEGER
);

CREATE TABLE IF NOT EXISTS arena (
    alunoId INTEGER PRIMARY KEY,
    pvpAtivado BOOLEAN DEFAULT false,
    cansadoAte TEXT,
    FOREIGN KEY (alunoId) REFERENCES users(id)
);
