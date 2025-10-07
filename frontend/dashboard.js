// Verifica autenticação
const token = localStorage.getItem('token');
const account = JSON.parse(localStorage.getItem('account'));
if (!token || !account || !['professor', 'admin'].includes(account.role)) {
    alert('Acesso negado! Faça login como professor ou administrador.');
    window.location.href = 'index.html';
}

// Armazenamento global
let turmas = [];
let alunos = [];

// =================================================================================
// FUNÇÕES DE COMUNICAÇÃO COM A API (BACKEND)
// =================================================================================

/**
 * Cria uma nova turma no servidor.
 * @param {object} novaTurma - O objeto da turma a ser criada.
 * @returns {Promise<object|null>} O objeto da turma criada com ID, ou nulo em caso de erro.
 */
async function createTurma(novaTurma) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('http://localhost:3000/api/turmas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(novaTurma)
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falha ao criar turma no servidor.');
        }
        return await res.json();
    } catch (error) {
        console.error('Erro em createTurma:', error);
        showToast(`Erro ao criar turma: ${error.message}`);
        return null;
    }
}

/**
 * Atualiza os dados de uma turma existente no servidor.
 * @param {object} turma - O objeto completo da turma a ser atualizado.
 * @returns {Promise<object|null>} A resposta do servidor, ou nulo em caso de erro.
 */
async function updateTurma(turma) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:3000/api/turmas/${turma.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(turma)
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falha ao atualizar a turma no servidor.');
        }
        return await res.json();
    } catch (error) {
        console.error('Erro na função updateTurma:', error);
        showToast(`Erro ao salvar alterações da turma: ${error.message}`);
        return null;
    }
}

/**
 * Deleta uma turma do servidor.
 * @param {number} turmaId - O ID da turma a ser deletada.
 * @returns {Promise<object|null>} A resposta do servidor, ou nulo em caso de erro.
 */
async function deleteTurma(turmaId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:3000/api/turmas/${turmaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            throw new Error('Falha ao deletar a turma no servidor.');
        }
        return await res.json();
    } catch (error) {
        console.error('Erro em deleteTurma:', error);
        showToast(`Erro ao deletar turma: ${error.message}`);
        return null;
    }
}

/**
 * Salva a lista completa de alunos no servidor.
 * @param {Array<object>} alunosData - O array de alunos a ser salvo.
 */
async function saveAlunos(alunosData) {
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/api/alunos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(alunosData)
    });
}

/**
 * Salva os dados do perfil do professor no servidor.
 * @param {object} professorData - O objeto com os dados do professor.
 */
async function saveProfessor(professorData) {
    const token = localStorage.getItem('token');
    console.log('Salvando dados do professor:', professorData);
    await fetch('http://localhost:3000/api/professor', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(professorData)
    });
}

/**
 * Cria uma conta de usuário para um novo aluno no sistema.
 * @param {string} name - O nome completo do aluno.
 * @param {string} ctr - O CTR (username) do aluno.
 * @returns {Promise<number|null>} O ID do usuário criado, ou nulo em caso de erro.
 */
async function createStudentUserAccount(name, ctr) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:3000/api/auth/registerStudent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: name, username: ctr, password: 'aluno123' })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Erro ao criar conta de usuário para o aluno.');
        }

        const studentUserId = data.studentUserId;

        // ✅ ADICIONA O ALUNO AO ARRAY DE ALUNOS DO PROFESSOR (mesmo sem turma)
        const alunos = await loadAlunos(); // Carrega o array atual
        alunos.push({
            ctr: ctr,
            nome: name,
            userId: studentUserId,
            role: 'student',
            status: 'ativo',
            gold: 100,           // ✅ Inicializa com gold
            mochila: [],         // ✅ Inicializa mochila vazia
            equipamentos: {},    // ✅ Inicializa equipamentos vazios
            turmas: [],          // ✅ Sem turmas por enquanto
            coverPic: '',
            presencas: {}
        });
        await saveAlunos(alunos); // ✅ Salva no backend

        showToast(data.message);
        return studentUserId;
    } catch (error) {
        console.error('Erro ao registrar aluno como usuário:', error);
        showToast(`Erro: ${error.message}`);
        return null;
    }
}

/**
 * Carrega todas as turmas do professor logado.
 * @returns {Promise<Array>} Um array de objetos de turma.
 */
async function loadTurmas() {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/api/turmas', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok ? await res.json() : [];
}

/**
 * Carrega a lista de todos os alunos do professor logado.
 * @returns {Promise<Array>} Um array de objetos de aluno.
 */
async function loadAlunos() {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/api/alunos', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok ? await res.json() : [];
}

/**
 * Carrega os dados do perfil do professor logado.
 * @returns {Promise<object>} Um objeto com os dados do professor.
 */
async function loadProfessor() {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/api/professor', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        return await res.json();
    } else {
        console.error('Falha ao carregar dados do professor:', res.status);
        return {
            name: account.name,
            bio: '',
            pic: 'assets/profile-placeholder.jpg'
        };
    }
}

// =================================================================================
// ELEMENTOS E NAVEGAÇÃO
// =================================================================================

const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const mainContent = document.getElementById('mainContent');
const logoutBtn = document.getElementById('logoutBtn');
const sidebarItems = document.querySelectorAll('.sidebar-item[data-page]');

const pages = {
    'perfil': () => loadPage('perfil.html').then(setupProfile),
    'turmas': () => loadPage('minhas-turmas.html').then(() => {
        setTimeout(() => {
            if (typeof setupTurmas === 'function') {
                setupTurmas();
            } else {
                console.error('❌ setupTurmas não está definido');
            }
        }, 50);
    }),
    'lista-alunos': () => loadPage('lista-alunos.html').then(() => {
        const script = document.createElement('script');
        script.src = 'lista-alunos.js';
        script.onload = () => {
            if (typeof setupListaAlunos === 'function') {
                setupListaAlunos();
            }
        };
        document.body.appendChild(script);
    }),
    'frequencia': () => loadPage('frequencia.html').then(() => {
        if (typeof window.setupFrequencia === 'function') {
            console.log('✅ frequencia.js já carregado. Re-executando setupFrequencia().');
            setupFrequencia();
        } else {
            console.log('⬆️ Carregando frequencia.js pela primeira vez...');
            const script = document.createElement('script');
            script.src = 'frequencia.js';
            script.onload = () => {
                if (typeof setupFrequencia === 'function') {
                    setupFrequencia();
                } else {
                    console.error('❌ setupFrequencia não está definido após o carregamento do script frequencia.js');
                }
            };
            document.body.appendChild(script);
        }
    }),
    'tarefas': async () => {
        // Carrega turmas ANTES de abrir a página de tarefas
        if (turmas.length === 0) {
            turmas = await loadTurmas();
            window.turmasGlobal = turmas; // Atualiza global
        }
        await loadPage('tarefas-professor.html');
        setupTarefasProfessor();
    },
    'loja': () => loadPage('loja-professor.html').then(() => {
        if (typeof setupLojaProfessor === 'function') {
            setupLojaProfessor();
        } else {
            console.error('❌ setupLojaProfessor não está definido');
        }
    }),
};


// Armazenamento global de tarefas
let tarefas = [];

// Carrega tarefas do backend
async function loadTarefas() {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/api/tarefas/professor', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok ? await res.json() : [];
}

// deleta tarefa
async function deleteTarefa(tarefaId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:3000/api/tarefas/${tarefaId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falha ao deletar tarefa.');
        }
        return await res.json();
    } catch (error) {
        console.error('Erro em deleteTarefa:', error);
        showToast(`Erro ao deletar: ${error.message}`);
        return null;
    }
}

//update tarefa
async function updateTarefa(tarefaData) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:3000/api/tarefas/${tarefaData.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(tarefaData)
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falha ao atualizar tarefa.');
        }
        return await res.json();
    } catch (error) {
        console.error('Erro em updateTarefa:', error);
        showToast(`Erro ao atualizar: ${error.message}`);
        return null;
    }
}


// Cria uma nova tarefa no backend
async function createTarefa(tarefa) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('http://localhost:3000/api/tarefas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(tarefa) // ✅ Envia APENAS a tarefa nova
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falha ao criar tarefa.');
        }
        return await res.json(); // Retorna a tarefa criada com ID
    } catch (error) {
        console.error('Erro em createTarefa:', error);
        showToast(`Erro: ${error.message}`);
        return null;
    }
}


// =================================================================================
// LÓGICA DA LOJA DO PROFESSOR
// =================================================================================
function setupLojaProfessor() {
    let iconeBase64 = '';
    let imagemCarregada = false;

    const formCriarItem = document.getElementById('formCriarItem');
    const listaItens = document.getElementById('listaItens');

    if (!formCriarItem || !listaItens) {
        console.warn('Elementos da loja do professor não encontrados.');
        return;
    }

    // Remove listeners antigos (evita duplicação)
    const newForm = formCriarItem.cloneNode(true);
    formCriarItem.parentNode.replaceChild(newForm, formCriarItem);

    // ✅ Pega os elementos NOVOS (após o clone)
    const iconeInput = newForm.querySelector('#iconeItem');
    const previewIcone = newForm.querySelector('#previewIcone');
    const form = newForm; // o novo formulário

    if (!iconeInput || !previewIcone) {
        console.warn('Elementos de imagem não encontrados no novo formulário.');
        return;
    }

    // ✅ Agora o listener é atribuído ao input correto
    iconeInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            iconeBase64 = '';
            imagemCarregada = false;
            previewIcone.innerHTML = '';
            return;
        }

        if (!file.type.match('image.*')) {
            alert('Por favor, selecione uma imagem válida.');
            iconeInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            iconeBase64 = e.target.result;
            imagemCarregada = true;
            previewIcone.innerHTML = `<img src="${iconeBase64}" width="100" class="img-fluid rounded">`;
        };
        reader.readAsDataURL(file);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!imagemCarregada || !iconeBase64) {
            alert('Selecione e aguarde o carregamento da imagem.');
            return;
        }

        const item = {
            nome: form.querySelector('#nomeItem').value.trim(),
            descricao: form.querySelector('#descricaoItem').value.trim(),
            efeito: form.querySelector('#efeitoItem').value.trim(),
            slot: form.querySelector('#slotItem').value,
            power: parseInt(form.querySelector('#powerItem').value, 10),
            preco: form.querySelector('#precoItem').value
                ? parseInt(form.querySelector('#precoItem').value, 10)
                : parseInt(form.querySelector('#powerItem').value, 10) * 10,
            privado: 0, // ✅ Adiciona por padrão (0 = público, 1 = privado)
            icone: iconeBase64,
        };

        if (!item.nome || !item.descricao || !item.efeito || isNaN(item.power)) {
            return alert('Preencha todos os campos corretamente.');
        }

        const res = await fetch('http://localhost:3000/api/itens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(item)
        });

        if (res.ok) {
            showToast('Item criado com sucesso!');
            form.reset();
            iconeBase64 = '';
            imagemCarregada = false;
            previewIcone.innerHTML = '';
            carregarItens();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast('Erro: ' + (err.error || 'Falha ao criar item.'));
        }
    });

    // Botão: Adicionar da Mochila
    document.getElementById('btnAdicionarDaMochila')?.addEventListener('click', async () => {
        const modal = new bootstrap.Modal(document.getElementById('modalMochilaLoja'));
        const container = document.getElementById('itensMochilaLoja');
        container.innerHTML = '<div class="text-center py-3">Carregando...</div>';

        try {
            const professor = await loadProfessor();
            container.innerHTML = '';
            if (!professor.mochila || professor.mochila.length === 0) {
                container.innerHTML = '<div class="col-12 text-center text-muted py-3">Sua mochila está vazia.</div>';
                return;
            }

            professor.mochila.forEach(item => {
                const col = document.createElement('div');
                col.className = 'col-md-4';
                col.innerHTML = `
                    <div class="card p-3 text-center shadow-sm">
                        <img src="${item.icone}" width="60" class="mx-auto mb-2" style="object-fit: contain;">
                        <h6 class="fw-bold">${item.nome}</h6>
                        <p class="small text-muted">${item.descricao}</p>
                        <div class="small mb-1"><strong>Efeito:</strong> ${item.efeito}</div>
                        <div class="small mb-2"><strong>Slot:</strong> ${item.slot}</div>
                        <span class="badge bg-primary">Power: ${item.power}</span>
                        <span class="badge bg-success">Preço: ${item.preco || (item.power * 10)}</span>
                    </div>
                `;
                container.appendChild(col);
            });
        } catch (err) {
            container.innerHTML = '<div class="col-12 text-center text-danger">Erro ao carregar mochila.</div>';
        }

        modal.show();
    });

    // Carregar itens da loja (com botões de ação)
    async function carregarItens() {
        try {
            const res = await fetch('/api/itens/professor', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const itens = await res.json();
            const container = document.getElementById('listaItens');
            container.innerHTML = itens.map(item => {
                const isPrivado = Boolean(item.privado); // Garante booleano
                return `
                    <div class="col-md-4">
                        <div class="card p-3 text-center shadow-sm">
                            <img src="${item.icone}" width="60" class="mx-auto mb-2" style="object-fit: contain;">
                            <h6 class="fw-bold">${item.nome}</h6>
                            <p class="small text-muted">${item.descricao}</p>
                            <div class="small mb-1"><strong>Efeito:</strong> ${item.efeito}</div>
                            <div class="small mb-2"><strong>Slot:</strong> ${item.slot}</div>
                            <div class="d-flex justify-content-between align-items-center mt-2">
                                <span class="badge bg-primary">Power: ${item.power}</span>
                                <span class="badge bg-success">💰 ${item.preco}</span>
                            </div>
                            <div class="mt-2">
                                <button class="btn btn-sm btn-outline-danger btn-excluir-item" data-id="${item.id}">
                                    <i class="bi bi-trash"></i> Excluir
                                </button>
                                <button class="btn btn-sm btn-outline-secondary btn-privar-item" 
                                        data-id="${item.id}" 
                                        data-privado="${isPrivado}">
                                    <i class="bi bi-lock${isPrivado ? '-fill' : ''}"></i> 
                                    ${isPrivado ? 'Tornar Público' : 'Privar'}
                                </button>
                                <button class="btn btn-sm btn-success btn-comprar-professor" data-id="${item.id}">
                                    <i class="bi bi-cart"></i> Comprar
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Ação: Comprar item (para o professor)
            document.querySelectorAll('.btn-comprar-professor').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    try {
                        const res = await fetch(`/api/itens/${id}`, {
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                        });
                        const item = await res.json();

                        // Carrega professor
                        const professor = await loadProfessor();
                        if (!professor.mochila) professor.mochila = [];
                        professor.mochila.push(item);

                        // Salva
                        await saveProfessor(professor);
                        showToast(`Item "${item.nome}" adicionado à sua mochila!`);
                    } catch (err) {
                        console.error('Erro ao comprar item:', err);
                        showToast('Erro ao adicionar item à mochila.');
                    }
                });
            });

            // Ação: Excluir item
            document.querySelectorAll('.btn-excluir-item').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Excluir este item da loja?')) return;
                    const id = btn.dataset.id;
                    const res = await fetch(`/api/itens/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        showToast('Item excluído com sucesso!');
                        carregarItens();
                    } else {
                        showToast('Erro ao excluir item.');
                    }
                });
            });

            // Ação: Privar / Tornar público
            document.querySelectorAll('.btn-privar-item').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    const isPrivado = btn.dataset.privado === 'true';
                    const novoEstado = !isPrivado;

                    const res = await fetch(`/api/itens/${id}/privar`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ privado: novoEstado })
                    });

                    if (res.ok) {
                        // Atualiza o botão SEM recarregar tudo
                        btn.dataset.privado = String(novoEstado);
                        const icon = btn.querySelector('i');
                        const texto = btn.querySelector('span:not(.bi)') || btn.childNodes[btn.childNodes.length - 1];

                        if (novoEstado) {
                            icon.className = 'bi bi-lock-fill';
                            btn.innerHTML = `<i class="bi bi-lock-fill"></i> Tornar Público`;
                        } else {
                            icon.className = 'bi bi-lock';
                            btn.innerHTML = `<i class="bi bi-lock"></i> Privar`;
                        }

                        showToast(novoEstado ? 'Item privado com sucesso!' : 'Item tornado público com sucesso!');
                    } else {
                        showToast('Erro ao atualizar privacidade.');
                    }
                });
            });
        } catch (err) {
            console.error('Erro ao carregar itens:', err);
            document.getElementById('listaItens').innerHTML = 
                '<div class="col-12 text-center text-danger">Erro ao carregar itens.</div>';
        }
    }
    carregarItens();
}

// Configura a página de tarefas do professor
// Configura a página de tarefas do professor
async function setupTarefasProfessor() {
    const listaTarefas = document.getElementById('listaTarefas');
    const btnNovaTarefa = document.getElementById('btnNovaTarefa');
    const modalTarefa = document.getElementById('modalTarefa');
    const modalTitle = document.getElementById('modalTitle');
    const tituloInput = document.getElementById('tituloTarefa');
    const descricaoInput = document.getElementById('descricaoTarefa');
    const prazoInput = document.getElementById('prazoTarefa');
    const recompensaInput = document.getElementById('recompensaTarefa'); // ✅ Novo campo
    const turmasSelect = document.getElementById('turmasTarefa');
    const btnSalvarTarefa = document.getElementById('btnSalvarTarefa');

    if (!listaTarefas || !btnNovaTarefa) {
        console.error('Elementos da página de tarefas não encontrados.');
        return;
    }

    // Carrega turmas para o select (múltipla seleção)
    turmas.forEach(turma => {
        if (!turma.finalizada) {
            const option = document.createElement('option');
            option.value = turma.id;
            option.textContent = turma.nome;
            turmasSelect.appendChild(option);
        }
    });

    // Carrega tarefas
    tarefas = await loadTarefas();
    renderizarTarefas();

    // Filtros
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderizarTarefas(btn.dataset.filter);
        });
    });

    // Nova tarefa
    let tarefaEdicao = null;
    btnNovaTarefa.addEventListener('click', () => {
        tarefaEdicao = null;
        modalTitle.textContent = 'Nova Tarefa';
        tituloInput.value = '';
        descricaoInput.value = '';
        prazoInput.value = '';
        recompensaInput.value = '0'; // ✅ Reseta recompensa
        turmasSelect.querySelectorAll('option').forEach(opt => opt.selected = false);
        new bootstrap.Modal(modalTarefa).show();
    });

    // Salvar tarefa
    btnSalvarTarefa.addEventListener('click', async () => {
        const titulo = tituloInput.value.trim();
        if (!titulo) return alert('O título é obrigatório.');

        const turmasSelecionadas = Array.from(turmasSelect.selectedOptions).map(opt => parseInt(opt.value));
        if (turmasSelecionadas.length === 0) return alert('Selecione pelo menos uma turma.');

        const dadosTarefa = {
            titulo,
            descricao: descricaoInput.value.trim(),
            prazo: prazoInput.value || null,
            turmas: turmasSelecionadas,
            recompensaGold: parseInt(recompensaInput.value) || 0 // ✅ Inclui recompensa
        };
        console.log('Dados da tarefa a salvar:', dadosTarefa);
        try {
            if (tarefaEdicao) {
                dadosTarefa.id = tarefaEdicao.id;
                const resultado = await updateTarefa(dadosTarefa);
                if (resultado && resultado.success) {
                    const index = tarefas.findIndex(t => t.id === tarefaEdicao.id);
                    if (index !== -1) {
                        tarefas[index] = { ...tarefas[index], ...dadosTarefa };
                    }
                    showToast('Tarefa atualizada com sucesso!');
                }
            } else {
                const tarefaCriada = await createTarefa(dadosTarefa);
                if (tarefaCriada) {
                    tarefas.push(tarefaCriada);
                    showToast('Tarefa criada com sucesso!');
                }
            }
            renderizarTarefas();
            bootstrap.Modal.getInstance(modalTarefa).hide();
        } catch (error) {
            console.error('Erro ao salvar tarefa:', error);
            showToast('Erro ao salvar. Verifique o console.');
        }
    });

    // Renderiza a lista
    function renderizarTarefas(filter = 'all') {
        listaTarefas.innerHTML = '';

        let tarefasFiltradas = tarefas;
        if (filter === 'active') tarefasFiltradas = tarefas.filter(t => !t.concluida);
        if (filter === 'completed') tarefasFiltradas = tarefas.filter(t => t.concluida);

        if (tarefasFiltradas.length === 0) {
            listaTarefas.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="text-muted">Nenhuma tarefa encontrada.</div>
                </div>
            `;
            return;
        }

        tarefasFiltradas.forEach(tarefa => {
            const hoje = new Date();
            const prazo = tarefa.prazo ? new Date(tarefa.prazo) : null;
            let yearPrazo = tarefa.prazo?.[0] + tarefa.prazo?.[1] + tarefa.prazo?.[2] + tarefa.prazo?.[3];
            let monthPrazo = tarefa.prazo?.[5] + tarefa.prazo?.[6];
            let dayPrazo = tarefa.prazo?.[8] + tarefa.prazo?.[9];
            let prazoFormatado = prazo ? `${dayPrazo}/${monthPrazo}/${yearPrazo}` : null;

            const atrasada = prazoFormatado && new Date(prazoFormatado.split('/').reverse().join('-')) < hoje && !tarefa.concluida;
            
            const nomesTurmas = tarefa.turmas.map(id => {
                const t = turmas.find(t => t.id === id);
                return t ? t.nome : `Turma ${id}`;
            }).join(', ');

            const card = document.createElement('div');
            card.className = 'col-md-6 col-lg-4';
            card.innerHTML = `
                <div class="card border-0 shadow-sm h-100 ${atrasada ? 'border-danger border-2' : ''}">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title fw-bold ${tarefa.concluida ? 'text-decoration-line-through text-muted' : ''}">
                                ${tarefa.titulo}
                            </h6>
                        </div>
                        ${tarefa.descricao ? `<p class="card-text text-muted small">${tarefa.descricao}</p>` : ''}
                        <div class="mt-auto">
                            <small class="text-primary d-block mb-1"><strong>Turmas:</strong> ${nomesTurmas}</small>
                            ${prazo ? `<small class="text-muted d-block">Prazo: ${prazoFormatado}</small>` : ''}
                            ${tarefa.recompensaGold > 0 ? 
                                `<small class="text-warning d-block mb-1">🪙 Recompensa: ${tarefa.recompensaGold} golds</small>` 
                                : ''}
                            ${atrasada ? `<small class="text-danger">⚠️ Atrasada</small>` : ''}
                            <div class="d-flex gap-2 mt-2">
                                <button class="btn btn-sm btn-outline-info btn-ver-alunos" data-id="${tarefa.id}">Ver Alunos</button>
                                <button class="btn btn-sm btn-outline-primary btn-editar" data-id="${tarefa.id}">Editar</button>
                                <button class="btn btn-sm btn-outline-danger btn-excluir" data-id="${tarefa.id}">Excluir</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            listaTarefas.appendChild(card);
        });

        // Eventos dos botões
        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const tarefa = tarefas.find(t => t.id === id);
                if (tarefa) {
                    tarefaEdicao = tarefa;
                    modalTitle.textContent = 'Editar Tarefa';
                    tituloInput.value = tarefa.titulo;
                    descricaoInput.value = tarefa.descricao || '';
                    prazoInput.value = tarefa.prazo || '';
                    recompensaInput.value = tarefa.recompensaGold || '0'; // ✅ Carrega recompensa
                    turmasSelect.querySelectorAll('option').forEach(opt => {
                        opt.selected = tarefa.turmas.includes(parseInt(opt.value));
                    });
                    new bootstrap.Modal(modalTarefa).show();
                }
            });
        });

        document.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                    const id = parseInt(btn.dataset.id);
                    const resultado = await deleteTarefa(id);
                    if (resultado && resultado.success) {
                        tarefas = tarefas.filter(t => t.id !== id);
                        renderizarTarefas();
                        showToast('Tarefa excluída!');
                    }
                }
            });
        });

        // Evento: Ver alunos da tarefa
        document.querySelectorAll('.btn-ver-alunos').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tarefaId = parseInt(btn.dataset.id);
                const tarefa = tarefas.find(t => t.id === tarefaId);
                if (!tarefa) return;

                document.getElementById('tituloTarefaModal').textContent = tarefa.titulo;
                const tbody = document.getElementById('listaAlunosTarefa');
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

                const modal = new bootstrap.Modal(document.getElementById('modalAlunosTarefa'));
                modal.show();

                try {
                    const alunosStatus = await carregarAlunosDaTarefa(tarefaId);
                    tbody.innerHTML = '';

                    if (alunosStatus.length === 0) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="5" class="text-center text-muted">Nenhum aluno encontrado.</td>
                            </tr>
                        `;
                    } else {
                        alunosStatus.forEach(aluno => {
                            const statusTexto = aluno.corrigida ? 'Corrigido' : (aluno.entregue ? 'Entregue' : 'Pendente');
                            const statusClasse = aluno.corrigida ? 'bg-success' : (aluno.entregue ? 'bg-warning' : 'bg-secondary');
                            const dataEntrega = aluno.dataEntrega 
                                ? new Date(aluno.dataEntrega).toLocaleDateString('pt-BR')
                                : '-';

                            let acoes = '-';
                            if (aluno.entregue && !aluno.corrigida) {
                                acoes = `
                                    <button class="btn btn-sm btn-outline-info me-1 btn-ver-foto" 
                                            data-foto="${aluno.fotoEntrega || ''}" 
                                            ${!aluno.fotoEntrega ? 'disabled' : ''}>
                                        👁️
                                    </button>
                                    <button class="btn btn-sm btn-outline-success me-1 btn-corrigir" 
                                            data-aluno-id="${aluno.id}" 
                                            data-tarefa-id="${tarefaId}" 
                                            data-status="completo">
                                        ✅ Corrigir
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger btn-corrigir" 
                                            data-aluno-id="${aluno.id}" 
                                            data-tarefa-id="${tarefaId}" 
                                            data-status="incompleto">
                                        ❌ Incompleto
                                    </button>
                                `;
                            }

                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${aluno.ctr}</td>
                                <td>${aluno.nome}</td>
                                <td><span class="badge ${statusClasse}">${statusTexto}</span></td>
                                <td>${dataEntrega}</td>
                                <td class="text-end">${acoes}</td>
                            `;
                            tbody.appendChild(row);

                            // 👁️ Visualizar foto
                            row.querySelectorAll('.btn-ver-foto').forEach(btnVer => {
                                btnVer.addEventListener('click', () => {
                                    const fotoUrl = btnVer.dataset.foto;
                                    if (fotoUrl) {
                                        document.getElementById('fotoGrande').src = fotoUrl;
                                        new bootstrap.Modal(document.getElementById('modalVerFoto')).show();
                                    }
                                });
                            });

                            // ✅/❌ Corrigir
                            row.querySelectorAll('.btn-corrigir').forEach(btnCorrigir => {
                                btnCorrigir.addEventListener('click', async () => {
                                    const alunoId = btnCorrigir.dataset.alunoId;
                                    const tarefaId = btnCorrigir.dataset.tarefaId;
                                    const status = btnCorrigir.dataset.status;
                                    const alunoCtr = aluno.ctr;
                                    console.log(`Corrigindo aluno ${alunoCtr} (ID: ${alunoId}) da tarefa ${tarefaId} como ${status}`);

                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await fetch('/api/tarefas/corrigir', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${token}`
                                            },
                                            body: JSON.stringify({ alunoId, tarefaId, status })
                                        });

                                        if (res.ok) {
                                            showToast(status === 'completo' 
                                                ? '✅ Tarefa corrigida! Recompensa enviada.' 
                                                : '❌ Tarefa marcada como incompleta.');
                                            // Recarrega o modal
                                            const tbody = document.getElementById('listaAlunosTarefa');
                                            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Recarregando...</td></tr>';
                                            
                                            const novosAlunos = await carregarAlunosDaTarefa(tarefaId);
                                            console.log('Alunos após correção:', novosAlunos); // ← Verifique se corrigida: true
                                            tbody.innerHTML = '';
                                            novosAlunos.forEach(aluno => {
                                                const statusTexto = aluno.corrigida ? 'Corrigido' : (aluno.entregue ? 'Entregue' : 'Pendente');
                                                const statusClasse = aluno.corrigida ? 'bg-success' : (aluno.entregue ? 'bg-warning' : 'bg-secondary');
                                                const dataEntrega = aluno.dataEntrega 
                                                    ? new Date(aluno.dataEntrega).toLocaleDateString('pt-BR')
                                                    : '-';
                                                let acoes = '-';
                                                if (aluno.entregue && !aluno.corrigida) {
                                                    acoes = `
                                                        <button class="btn btn-sm btn-outline-info me-1 btn-ver-foto" 
                                                                data-foto="${aluno.fotoEntrega || ''}" 
                                                                ${!aluno.fotoEntrega ? 'disabled' : ''}>
                                                            👁️
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-success me-1 btn-corrigir" 
                                                                data-aluno-id="${aluno.id}" 
                                                                data-tarefa-id="${tarefaId}" 
                                                                data-status="completo">
                                                            ✅ Corrigir
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-danger btn-corrigir" 
                                                                data-aluno-id="${aluno.id}" 
                                                                data-tarefa-id="${tarefaId}" 
                                                                data-status="incompleto">
                                                            ❌ Incompleto
                                                        </button>
                                                    `;
                                                }
                                                const newRow = document.createElement('tr');
                                                newRow.innerHTML = `
                                                    <td>${aluno.ctr}</td>
                                                    <td>${aluno.nome}</td>
                                                    <td><span class="badge ${statusClasse}">${statusTexto}</span></td>
                                                    <td>${dataEntrega}</td>
                                                    <td class="text-end">${acoes}</td>
                                                `;
                                                tbody.appendChild(newRow);

                                                // Re-attach listeners
                                                newRow.querySelectorAll('.btn-ver-foto').forEach(b => {
                                                    b.addEventListener('click', () => {
                                                        if (b.dataset.foto) {
                                                            document.getElementById('fotoGrande').src = b.dataset.foto;
                                                            new bootstrap.Modal(document.getElementById('modalVerFoto')).show();
                                                        }
                                                    });
                                                });
                                                newRow.querySelectorAll('.btn-corrigir').forEach(b => {
                                                    b.addEventListener('click', () => {
                                                        // Reaproveita a mesma lógica (poderia ser uma função separada)
                                                        // Mas para simplicidade, mantemos inline
                                                        const alunoId = b.dataset.alunoId;
                                                        const tarefaId = b.dataset.tarefaId;
                                                        const status = b.dataset.status;
                                                        // ... (mesma lógica acima)
                                                        // Para evitar repetição, você pode refatorar depois
                                                    });
                                                });
                                            });
                                        } else {
                                            const err = await res.json();
                                            showToast(`❌ ${err.message}`);
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        showToast('❌ Erro ao corrigir.');
                                    }
                                });
                            });
                        });
                    }
                } catch (err) {
                    console.error('Erro ao carregar alunos:', err);
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar alunos.</td></tr>';
                }
            });
        });
    }

    // Busca os alunos e status de entrega de uma tarefa
    async function carregarAlunosDaTarefa(tarefaId) {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`http://localhost:3000/api/tarefas/professor/${tarefaId}/alunos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Erro ao carregar alunos da tarefa.');
            return await res.json();
        } catch (err) {
            console.error('Erro em carregarAlunosDaTarefa:', err);
            showToast('Erro ao carregar lista de alunos.');
            return [];
        }
    }
}

async function loadPage(url) {
    try {
        const res = await fetch(`${url}?t=${Date.now()}`); // Cache-busting
        if (!res.ok) throw new Error(`Falha ao carregar ${url}: ${res.status}`);
        const html = await res.text();
        mainContent.innerHTML = html;
        document.querySelectorAll('.modal').forEach(modalEl => {
            new bootstrap.Modal(modalEl);
        });
    } catch (err) {
        mainContent.innerHTML = `<div class="alert alert-danger"><strong>Erro:</strong> ${err.message}</div>`;
        console.error('Erro ao carregar página:', err);
    }
}

function showMessage(title) {
    mainContent.innerHTML = `
        <div class="p-5 text-center">
            <h1>${title}</h1>
            <p>Funcionalidade em desenvolvimento</p>
        </div>
    `;
}

logoutBtn.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('account');
        window.location.href = 'index.html';
    }
});

sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
        const page = item.getAttribute('data-page');
        sidebarItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if (pages[page]) pages[page]();
    });
});

menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    const isSidebar = sidebar.contains(e.target);
    const isToggle = menuToggle.contains(e.target);
    if (!isSidebar && !isToggle && window.innerWidth <= 992) {
        sidebar.classList.remove('show');
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
        sidebar.classList.remove('show');
    }
});

// =================================================================================
// LÓGICA DO PERFIL
// =================================================================================
// =================================================================================
// LÓGICA DO PERFIL (CORRIGIDA E COMPLETA)
// =================================================================================
async function setupProfile() {
    // Garante que os elementos existam
    const profileName = document.getElementById('profileName');
    const profilePic = document.getElementById('profilePic');
    const bioText = document.getElementById('bioText');
    const bioInput = document.getElementById('bioInput');
    const bioView = document.getElementById('bioView');
    const bioEdit = document.getElementById('bioEdit');
    const editBioBtn = document.getElementById('editBioBtn');
    const saveBioBtn = document.getElementById('saveBioBtn');
    const cancelBioBtn = document.getElementById('cancelBioBtn');

    if (!profileName || !profilePic) {
        console.error('❌ Elementos do perfil não encontrados no DOM. Verifique se perfil.html foi carregado corretamente.');
        return;
    }

    // Carrega dados do professor
    let professor = await loadProfessor();
    console.log('✅ Dados do professor carregados:', professor);

    // ✅ Garante que coverPic exista
    if (!professor.coverPic) {
        professor.coverPic = 'assets/cover-placeholder.png';
    }

    // === UPLOAD DE CAPA DO PROFESSOR ===
    const coverPic = document.getElementById('coverPic');
    const coverGradient = document.getElementById('coverGradient');
    const coverUpload = document.getElementById('coverUpload');

    if (coverPic && coverGradient && coverUpload) {
    // Carrega capa salva
    if (professor.coverPic) {
        coverPic.src = professor.coverPic;
        coverPic.classList.remove('d-none');
        coverGradient.classList.add('d-none');
    }

    // Clique no botão → abre file input
    coverUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.match('image.*')) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
        const base64 = event.target.result;
        
        // Atualiza visualmente
        coverPic.src = base64;
        coverPic.classList.remove('d-none');
        coverGradient.classList.add('d-none');

        // Salva no backend
        professor.coverPic = base64;
        await saveProfessor(professor);
        showToast('Capa atualizada com sucesso!');
        };
        reader.readAsDataURL(file);
    });
    }

    // Atualiza UI
    profileName.textContent = professor.name || 'Carregando...';
    profilePic.src = professor.pic || 'assets/profile-placeholder.jpg';
    bioText.textContent = professor.bio || 'Nenhuma biografia definida.';
    if (bioInput) bioInput.value = professor.bio || '';


    // === ITENS EQUIPÁVEIS ===
    // Garantir estrutura mínima
    if (professor.gold == null) professor.gold = 0;
    if (!professor.equipamentos) {
        professor.equipamentos = { cabeca: null, camisa: null, calca: null, pes: null, artefato: null };
    }
    if (!professor.mochila) {
        professor.mochila = [];
    }

    // Atualiza gold
    document.getElementById('goldProfessor').textContent = professor.gold || 0;

    // Atualiza slots e poder
    const slots = ['cabeca', 'camisa', 'calca', 'pes', 'artefato'];
    const slotPlaceholders = { cabeca: '🧢', camisa: '👕', calca: '👖', pes: '👟', artefato: '✨' };
    let totalPower = 0;

    slots.forEach(slot => {
        const el = document.querySelector(`.equip-slot[data-slot="${slot}"] .fs-2`);
        if (el) {
            const item = professor.equipamentos[slot];
            if (item && item.icone) {
                el.innerHTML = `<img src="${item.icone}" width="40" height="40" style="object-fit: contain;">`;
                totalPower += item.power || 0;
            } else {
                el.textContent = slotPlaceholders[slot];
            }
        }
    });

    document.getElementById('poderTotal').textContent = totalPower;

    // Botão: Adicionar Gold
    document.getElementById('btnAdicionarGold')?.addEventListener('click', async () => {
        const quantidade = prompt('Digite a quantidade de gold (1 a 10.000):', '100');
        if (!quantidade) return;

        const valor = parseInt(quantidade, 10);
        if (isNaN(valor) || valor < 1 || valor > 10000) {
            alert('Por favor, insira um valor entre 1 e 10.000.');
            return;
        }

        professor.gold = (professor.gold || 0) + valor;
        document.getElementById('goldProfessor').textContent = professor.gold;

        // Salva no backend
        await saveProfessor(professor);
        showToast(`+${valor} gold adicionado!`);
    });

    // Abrir mochila
    document.getElementById('btnAbrirMochila')?.addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('modalMochilaProfessor'));
        const container = document.getElementById('itensMochilaProfessor');
        container.innerHTML = '';

        if (professor.mochila.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted py-3">Sua mochila está vazia.</div>';
        } else {
            professor.mochila.forEach((item, index) => {
                const col = document.createElement('div');
                col.className = 'col-6 col-md-4 col-lg-3';
                col.innerHTML = `
                    <div class="card border rounded-3 shadow-sm h-100 text-center p-3" style="cursor: pointer;" data-index="${index}">
                        <img src="${item.icone}" width="40" height="40" class="mx-auto mb-2" style="object-fit: contain;">
                        <div class="small fw-bold">${item.nome}</div>
                        <div class="text-muted small">+${item.power} Poder</div>
                        <div class="text-muted small">${item.efeito}</div>
                    </div>
                `;
                container.appendChild(col);
            });
        }

        // Equipar item
        container.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', async () => {
                const idx = card.dataset.index;
                const item = professor.mochila[idx];
                if (!item || !item.slot) return;

                if (!professor.equipamentos) professor.equipamentos = {};
                professor.equipamentos[item.slot] = item;

                await saveProfessor(professor);
                setupProfile(); // recarrega
                modal.hide();
            });
        });

        modal.show();

    });

    // === CORREÇÃO DE FOCO DO MODAL (ARIA-HIDDEN) ===
    const modalMochilaElement = document.getElementById('modalMochilaProfessor');
    const btnAbrirMochila = document.getElementById('btnAbrirMochila');

    if (modalMochilaElement) {
        // Adiciona um listener que é disparado APÓS a transição de ocultação do modal
        modalMochilaElement.addEventListener('hidden.bs.modal', function () {
            
            // 1. O passo crucial: Remove o foco de qualquer coisa ativa no momento
            document.activeElement?.blur();

            // 2. Retorna o foco explicitamente para o botão que abriu o modal.
            // Isso resolve o erro de acessibilidade e é a melhor prática.
            if (btnAbrirMochila) {
                btnAbrirMochila.focus();
            }
        });
    }

    // === UPLOAD DE FOTO ===
    let fileInput = document.getElementById('fileInput');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'fileInput';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }

    const handleFileSelect = async (files) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.type.match('image.*')) {
            return showToast('Por favor, selecione um arquivo de imagem válido.');
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const newPicBase64 = e.target.result;
            profilePic.src = newPicBase64;

            try {
                professor.pic = newPicBase64;
                await saveProfessor(professor);
                showToast('Foto de perfil atualizada com sucesso!');
            } catch (err) {
                console.error('Erro ao salvar foto:', err);
                showToast('Erro ao salvar a foto.');
                // Reverte em caso de erro
                profilePic.src = professor.pic || 'assets/profile-placeholder.jpg';
            }
        };
        reader.readAsDataURL(file);
    };

    profilePic.addEventListener('click', () => {
        fileInput.onchange = (e) => handleFileSelect(e.target.files);
        fileInput.click();
    });

    // === EDIÇÃO DE BIOGRAFIA ===
    if (editBioBtn && saveBioBtn && cancelBioBtn && bioInput && bioView && bioEdit) {
        editBioBtn.addEventListener('click', () => {
            bioView.style.display = 'none';
            bioEdit.style.display = 'block';
            bioInput.focus();
        });

        cancelBioBtn.addEventListener('click', () => {
            bioEdit.style.display = 'none';
            bioView.style.display = 'block';
            bioInput.value = professor.bio || '';
        });

        saveBioBtn.addEventListener('click', async () => {
            const novaBio = bioInput.value.trim();
            try {
                professor.bio = novaBio;
                await saveProfessor(professor);
                bioText.textContent = novaBio || 'Nenhuma biografia definida.';
                bioView.style.display = 'block';
                bioEdit.style.display = 'none';
                showToast('Biografia salva com sucesso!');
            } catch (err) {
                console.error('Erro ao salvar biografia:', err);
                showToast('Erro ao salvar a biografia.');
            }
        });
    }
}

// =================================================================================
// LÓGICA DAS TURMAS E ALUNOS (SETUPTURMAS)
// =================================================================================
function setupTurmas() {
    if (!document.getElementById('mainContent')) {
        console.error('❌ mainContent não encontrado!');
        return;
    }

    let currentDisplayMonth = (function() {
        const hoje = new Date();
        const dia = hoje.getDate();
        let mes = hoje.getMonth();
        let ano = hoje.getFullYear();
        if (dia <= 10) {
            mes = mes === 0 ? 11 : mes - 1;
            ano = (mes === 11 && hoje.getMonth() === 0) ? ano - 1 : ano;
        }
        console.log('📅 Mês de exibição calculado:', { mes: mes + 1, ano });
        return { mes, ano };
    })();

    const diasMap = {
        'S': 'Segunda',
        'T': 'Terça',
        'Q': 'Quarta',
        'I': 'Quinta',
        'X': 'Sexta',
        'A': 'Sábado'
    };

    function atualizarDatalist() {
        const datalist = document.getElementById('alunosList');
        if (!datalist) return;
        datalist.innerHTML = '';
        alunos.forEach(aluno => {
            const option = document.createElement('option');
            option.value = aluno.ctr;
            datalist.appendChild(option);
        });
    }

    function analisarTurma(nome) {
        const match = nome.match(/^([STQIXA]{2})(\d{4})_(\d+)$/);
        if (!match) return null;
        const [, prefixo, horario, codigo] = match;
        const diasMap = {
            'SQ': ['Segunda', 'Quarta'],
            'TQ': ['Terça', 'Quinta'],
            'SA': ['Sábado'],
            'ST': ['Segunda', 'Terça'],
            'QX': ['Quarta', 'Quinta'],
            'IX': ['Quinta', 'Sexta'],
            'SX': ['Sexta', 'Sábado'],
        };
        const dias = diasMap[prefixo];
        if (!dias) return null;
        const hora = `${horario.slice(0, 2)}:${horario.slice(2)}`;
        return { dias, horario: hora, codigo };
    }

    function gerarAulasMes(turma, mes, ano) {
        const aulas = [];
        const data = new Date(ano, mes, 1);
        while (data.getMonth() === mes) {
            const diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][data.getDay()];
            if (turma.diasAula.includes(diaSemana)) {
                aulas.push(new Date(data));
            }
            data.setDate(data.getDate() + 1);
        }
        return aulas;
    }

    function calcularFrequencia(aluno, turma) {
        if (aluno.status === 'EVA') {
            return {
                isEvadido: true,
                frequente: false,
                faltam: -1
            };
        }

        const aulas = gerarAulasMes(turma, currentDisplayMonth.mes, currentDisplayMonth.ano);
        const aulasAtivas = aulas.filter(aula => {
            const dataStr = aula.toISOString().split('T')[0]; // ✅ CORREÇÃO: usa YYYY-MM-DD
            return !(turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr));
        });

        const minAulas = Math.floor(aulasAtivas.length / 2) + 1;

        let presencas = 0;
        aulasAtivas.forEach(aula => {
            const dataStr = aula.toISOString().split('T')[0]; // ✅ CORREÇÃO
            const presente = aluno.presencas?.[turma.nome]?.[dataStr] !== false;
            if (presente) presencas++;
        });

        const reposicoes = aluno.reposicoes?.[turma.nome] || 0;
        const totalPresencas = presencas + reposicoes;
        const faltam = minAulas - totalPresencas;

        return {
            totalAulas: aulasAtivas.length,
            minAulas,
            presencas,
            reposicoes,
            totalPresencas,
            faltam,
            frequente: faltam <= 0,
            isEvadido: false
        };
    }

    function atualizarInterfaceFrequencia(aluno, turma) {
        const freq = calcularFrequencia(aluno, turma);
        const freqContent = freq.isEvadido ? '-' : (freq.frequente ? '🎉' : `+${freq.faltam}`);
        const linhas = document.querySelectorAll(`tr[data-aluno-ctr="${aluno.ctr}"][data-turma="${turma.nome}"]`);
        linhas.forEach(linha => {
            const celulaFreq = linha.querySelector('td.frequencia-cell');
            if (celulaFreq) {
                celulaFreq.textContent = freqContent;
                if (freq.frequente) {
                    linha.classList.add('frequente');
                } else {
                    linha.classList.remove('frequente');
                }
            }
        });
    }

    function renderizarTurmas() {
        const container = document.getElementById('listaTurmas');
        if (!container) return;
        container.innerHTML = '';

        const turmasAtivas = turmas.filter(t => !t.finalizada);
        const ativasHeader = document.createElement('h6');
        ativasHeader.className = 'fw-bold text-success px-4 pt-3';
        ativasHeader.textContent = 'Turmas Ativas';
        container.appendChild(ativasHeader);
        if (turmasAtivas.length === 0) {
            const vazio = document.createElement('div');
            vazio.className = 'p-4 text-center text-muted';
            vazio.textContent = 'Nenhuma turma ativa';
            container.appendChild(vazio);
        } else {
            turmasAtivas.forEach((turma, index) => {
                const aulas = gerarAulasMes(turma, currentDisplayMonth.mes, currentDisplayMonth.ano);
                const card = document.createElement('div');
                card.className = 'accordion-item border-0 border-bottom';
                card.innerHTML = `
                    <h2 class="accordion-header" id="heading${index}">
                        <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse"
                            data-bs-target="#collapse${index}" aria-expanded="false" aria-controls="collapse${index}">
                            <div class="d-flex w-100 justify-content-between align-items-center">
                                <div>
                                    <h5 class="mb-0">${turma.nome}</h5>
                                    <small class="text-muted">🧑‍🎓 ${turma.alunos.length} aluno(s)</small>
                                </div>
                                <div>
                                    <button class="btn btn-sm btn-outline-danger me-2 btn-finalizar-turma" data-nome="${turma.nome}">Finalizar</button>
                                    <!-- <button class="btn btn-sm btn-outline-info btn-fechar-mes" data-nome="${turma.nome}">Fechar mês</button> -->
                                </div>
                            </div>
                        </button>
                    </h2>
                    <div id="collapse${index}" class="accordion-collapse collapse" aria-labelledby="heading${index}"
                        data-bs-parent="#listaTurmas">
                        <div class="accordion-body p-0">
                            <p class="text-muted small px-3 text-bold">
                                Dias: ${turma.diasAula.join(', ')} |
                                Horário: ${turma.horario} |
                                Início: ${new Date(turma.dataInicio).toLocaleDateString()}
                            </p>
                            <div class="d-flex justify-content-end mb-3 px-3">
                                <button class="btn btn-sm btn-outline-primary me-2 btn-gerenciar-turma" data-turma-nome="${turma.nome}">Gerenciar aulas</button>
                                <button class="btn btn-sm btn-outline-success btn-add-aluno" data-nome="${turma.nome}">Adicionar Alunos</button>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-sm table-hover mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th>CTR</th>
                                            <th>Nome</th>
                                            ${aulas.map(aula => {
                                                const dataStr = aula.toISOString().split('T')[0];
                                                const estaDesativada = turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr);
                                                return `<th class="text-center ${estaDesativada ? 'text-muted' : ''}">${String(aula.getDate()).padStart(2, '0')}/${String(aula.getMonth() + 1).padStart(2, '0')}</th>`;
                                            }).join('')}
                                            <th>Reposições</th>
                                            <th>FREQ.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${turma.alunos.map(ctr => {
                                            const alunoData = alunos.find(a => a.ctr === ctr);
                                            if (!alunoData) return '';
                                            const isEvadido = alunoData.status === 'EVA';
                                            const isTrancado = alunoData.status === 'trancado';
                                            let nomeExibicao = alunoData.nome;
                                            let nomeClass = '';
                                            if (isEvadido) {
                                                nomeExibicao = `${alunoData.nome} [EVADIDO]`;
                                                nomeClass = 'text-danger fw-bold';
                                            } else if (isTrancado) {
                                                nomeExibicao = `${alunoData.nome} [TRANCADO]`;
                                                nomeClass = 'text-primary fw-bold';
                                            }
                                            const freq = calcularFrequencia(alunoData, turma);
                                            const freqContent = isTrancado || freq.isEvadido ? '-' : (freq.frequente ? '🎉' : `+${freq.faltam}`);
                                            const freqClass = freq.frequente && !isTrancado && !isEvadido ? 'frequente' : '';

                                            if (!alunoData.reposicoes) alunoData.reposicoes = {};
                                            if (!alunoData.reposicoes[turma.nome]) alunoData.reposicoes[turma.nome] = 0;

                                            return `
                                                <tr data-aluno-ctr="${alunoData.ctr}" data-turma="${turma.nome}" class="${freqClass}">
                                                    <td>${alunoData.ctr}</td>
                                                    <td class="${nomeClass}">${nomeExibicao}</td>
                                                    ${aulas.map(aula => {
                                                        const dataStr = aula.toISOString().split('T')[0]; // ✅ CORREÇÃO
                                                        const presente = alunoData.presencas?.[turma.nome]?.[dataStr] !== false;
                                                        const estaDesativada = turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr);
                                                        const disabledAttr = isEvadido || isTrancado || estaDesativada ? 'disabled' : '';
                                                        const aulaClass = estaDesativada || isTrancado || isEvadido ? 'aula-desativada' : '';
                                                        return `
                                                            <td class="text-center ${aulaClass}">
                                                                <input class="form-check-input presenca-checkbox" type="checkbox"
                                                                    data-ctr="${alunoData.ctr}"
                                                                    data-data="${dataStr}" // ✅ Usa YYYY-MM-DD
                                                                    data-turma="${turma.nome}"
                                                                    ${presente ? 'checked' : ''}
                                                                    ${disabledAttr}>
                                                            </td>
                                                        `;
                                                    }).join('')}
                                                    <td class="reposicoes-cell">
                                                        <select class="form-select form-select-sm reposicoes-select" 
                                                                data-ctr="${alunoData.ctr}" data-turma="${turma.nome}"
                                                                ${isEvadido || isTrancado ? 'disabled' : ''}>
                                                            ${Array.from({ length: 11 }, (_, i) => `
                                                                <option value="${i}" ${alunoData.reposicoes[turma.nome] === i ? 'selected' : ''}>${i}</option>
                                                            `).join('')}
                                                        </select>
                                                    </td>
                                                    <td class="text-center frequencia-cell">${freqContent}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        const turmasFinalizadas = turmas.filter(t => t.finalizada);
        const finalizadasHeader = document.createElement('h6');
        finalizadasHeader.className = 'fw-bold text-secondary px-4 pt-3';
        finalizadasHeader.textContent = 'Turmas Finalizadas';
        container.appendChild(finalizadasHeader);
        if (turmasFinalizadas.length === 0) {
            const vazio = document.createElement('div');
            vazio.className = 'p-4 text-center text-muted';
            vazio.textContent = 'Nenhuma turma finalizada';
            container.appendChild(vazio);
        } else {
            turmasFinalizadas.forEach((turma, index) => {
                const aulas = gerarAulasMes(turma, currentDisplayMonth.mes, currentDisplayMonth.ano);
                const card = document.createElement('div');
                card.className = 'accordion-item border-0 border-bottom';
                card.innerHTML = `
                    <h2 class="accordion-header" id="headingFinalizada${index}">
                        <button class="accordion-button collapsed py-3 text-secondary" type="button" data-bs-toggle="collapse"
                            data-bs-target="#collapseFinalizada${index}" aria-expanded="false" aria-controls="collapseFinalizada${index}">
                            <div class="d-flex w-100 justify-content-between align-items-center">
                                <div>
                                    <h5 class="mb-0">${turma.nome} <span class="badge bg-secondary">Finalizada</span></h5>
                                    <small class="text-muted">🧑‍🎓 ${turma.alunos.length} aluno(s)</small>
                                </div>
                            </div>
                        </button>
                    </h2>
                    <div id="collapseFinalizada${index}" class="accordion-collapse collapse" aria-labelledby="headingFinalizada${index}"
                        data-bs-parent="#listaTurmas">
                        <div class="accordion-body p-0">
                            <p class="text-muted small px-3">
                                *Dias:* ${turma.diasAula.join(', ')} |
                                *Horário:* ${turma.horario} |
                                *Início:* ${new Date(turma.dataInicio).toLocaleDateString()}
                            </p>
                            <div class="table-responsive">
                                <table class="table table-sm table-hover mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th>CTR</th>
                                            <th>Nome</th>
                                            ${aulas.map(aula => {
                                                const dataStr = aula.toISOString().split('T')[0];
                                                const estaDesativada = turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr);
                                                return `<th class="text-center ${estaDesativada ? 'text-muted' : ''}">${String(aula.getDate()).padStart(2, '0')}/${String(aula.getMonth() + 1).padStart(2, '0')}</th>`;
                                            }).join('')}
                                            <th>Reposições</th>
                                            <th>FREQ.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${turma.alunos.map(ctr => {
                                            const alunoData = alunos.find(a => a.ctr === ctr);
                                            if (!alunoData) return '';
                                            const isEvadido = alunoData.status === 'EVA';
                                            const nomeExibicao = isEvadido ? `[evadido] ${alunoData.nome}` : alunoData.nome;
                                            const nomeClass = isEvadido ? 'text-danger fw-bold' : '';
                                            const freq = calcularFrequencia(alunoData, turma);
                                            const freqClass = freq.frequente ? 'frequente' : '';
                                            const freqContent = freq.isEvadido ? '-' : (freq.frequente ? '🎉' : `+${freq.faltam}`);
                                            if (!alunoData.reposicoes) alunoData.reposicoes = {};
                                            if (!alunoData.reposicoes[turma.nome]) alunoData.reposicoes[turma.nome] = 0;
                                            return `
                                                <tr data-aluno-ctr="${alunoData.ctr}" data-turma="${turma.nome}" class="${freqClass} text-muted">
                                                    <td>${alunoData.ctr}</td>
                                                    <td class="${nomeClass}">${nomeExibicao}</td>
                                                    ${aulas.map(aula => {
                                                        const dataStr = aula.toISOString().split('T')[0];
                                                        const presente = alunoData.presencas?.[turma.nome]?.[dataStr] !== false;
                                                        const estaDesativada = turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr);
                                                        const disabledAttr = isEvadido || estaDesativada ? 'disabled' : '';
                                                        const aulaClass = estaDesativada ? 'aula-desativada' : '';
                                                        return `
                                                            <td class="text-center ${aulaClass}">
                                                                <input type="checkbox" class="form-check-input"
                                                                    ${disabledAttr}
                                                                    ${presente ? 'checked' : ''} disabled>
                                                            </td>
                                                        `;
                                                    }).join('')}
                                                    <td>
                                                        <select class="form-select form-select-sm"
                                                            data-ctr="${alunoData.ctr}"
                                                            data-turma="${turma.nome}"
                                                            disabled>
                                                            ${Array.from({ length: 11 }, (_, i) => `
                                                                <option value="${i}" ${alunoData.reposicoes[turma.nome] == i ? 'selected' : ''}>${i}</option>
                                                            `).join('')}
                                                        </select>
                                                    </td>
                                                    <td class="frequencia-cell">${freqContent}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    }

    // === MODAL: Deletar Turmas ===
    function abrirModalDeletarTurmas() {
        const modalEl = document.getElementById('modalDeletarTurmas');
        if (!modalEl) {
            console.error('Modal de deletar turmas não encontrado no DOM');
            return;
        }
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl);
        }
        if (!turmas) {
            console.error('Dados de turmas não carregados');
            return;
        }
        const container = document.getElementById('turmasFinalizadasParaDeletar');
        container.innerHTML = '';
        const turmasFinalizadas = turmas.filter(t => t.finalizada);
        if (turmasFinalizadas.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info text-center">
                    Nenhuma turma finalizada para deletar
                </div>
            `;
        } else {
            turmasFinalizadas.forEach(turma => {
                const item = document.createElement('div');
                item.className = 'list-group-item d-flex justify-content-between align-items-center rounded-3 mb-2';
                item.style.backgroundColor = '#f8f9fa';
                item.innerHTML = `
                    <span>
                        <input type="checkbox" class="form-check-input me-2" value="${turma.nome}">
                        *${turma.nome}*
                    </span>
                    <small class="text-muted">
                        ${turma.alunos.length} aluno(s) •
                        Início: ${new Date(turma.dataInicio).toLocaleDateString()}
                    </small>
                `;
                container.appendChild(item);
            });
        }
        modal.show();
    }

    async function deletarTurmasSelecionadas() {
        const checkboxes = document.querySelectorAll('#turmasFinalizadasParaDeletar input:checked');
        const turmasParaDeletar = Array.from(checkboxes).map(cb => {
            const nome = cb.value;
            return turmas.find(t => t.nome === nome);
        }).filter(Boolean);
        if (turmasParaDeletar.length === 0) {
            return alert('Selecione pelo menos uma turma para deletar');
        }
        if (!confirm(`Tem certeza que deseja deletar permanentemente ${turmasParaDeletar.length} turma(s)?`)) {
            return;
        }
        const promises = turmasParaDeletar.map(turma => deleteTurma(turma.id));
        const resultados = await Promise.all(promises);
        const sucesso = resultados.every(r => r && r.success);
        if (sucesso) {
            const idsDeletados = turmasParaDeletar.map(t => t.id);
            turmas = turmas.filter(t => !idsDeletados.includes(t.id));
            renderizarTurmas();
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalDeletarTurmas'));
            modal.hide();
            showToast(`${turmasParaDeletar.length} turma(s) deletada(s) com sucesso!`);
        } else {
            showToast('Ocorreu um erro ao deletar uma ou mais turmas. Tente novamente.');
        }
    }

    document.addEventListener('click', function(e) {
        if (e.target.id === 'btnDeletarTurmas' || e.target.closest('#btnDeletarTurmas')) {
            abrirModalDeletarTurmas();
        }
    });

    // === MODAL: Gerenciar Aulas ===
    function abrirModalGerenciarAulas(turmaNome) {
        const modalEl = document.getElementById('modalGerenciarAulas');
        if (!modalEl) {
            console.error('Modal de gerenciar aulas não encontrado no DOM. Verifique se o HTML foi adicionado corretamente.');
            return;
        }
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl);
        }
        modalEl.dataset.turmaNome = turmaNome;
        modal.show();
    }

    function abrirModalAulasMes(turma) {
        const modalEl = document.getElementById('modalAulasMes');
        if (!modalEl) {
            console.error('Modal de aulas do mês não encontrado no DOM.');
            return;
        }
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl);
        }
        modalEl.dataset.turma = turma.nome;
        const container = document.getElementById('containerAulasMes');
        container.innerHTML = '';
        const aulas = gerarAulasMes(turma, currentDisplayMonth.mes, currentDisplayMonth.ano);
        if (!turma.aulasDesativadas) {
            turma.aulasDesativadas = [];
        }
        aulas.forEach(aula => {
            const dataStr = aula.toISOString().split('T')[0];
            const estaDesativada = turma.aulasDesativadas.includes(dataStr);
            const item = document.createElement('div');
            item.className = 'col-md-4 col-sm-6';
            item.innerHTML = `
                <div class="form-check form-switch p-3 border rounded-3 mb-2 bg-light">
                    <input class="form-check-input aula-checkbox" type="checkbox" id="aula-${dataStr}" value="${dataStr}" ${estaDesativada ? 'checked' : ''}>
                    <label class="form-check-label" for="aula-${dataStr}">
                        ${String(aula.getDate()).padStart(2, '0')}/${String(aula.getMonth() + 1).padStart(2, '0')}
                    </label>
                </div>
            `;
            container.appendChild(item);
        });
        modal.show();
    }

    function abrirModalPlanejamentos(turma) {
        const modalEl = document.getElementById('modalPlanejamentos');
        if (!modalEl) {
            console.error('Modal de planejamentos não encontrado no DOM.');
            return;
        }
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl);
        }
        modalEl.dataset.turma = turma.nome;
        const container = document.getElementById('containerPlanejamentos');
        container.innerHTML = '';
        const aulas = gerarAulasMes(turma, currentDisplayMonth.mes, currentDisplayMonth.ano);
        if (!turma.planejamentos) {
            turma.planejamentos = {};
        }
        if (aulas.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info text-center">
                    Nenhuma aula programada para este mês
                </div>
            `;
        } else {
            const table = document.createElement('table');
            table.className = 'table table-hover';
            const thead = document.createElement('thead');
            thead.className = 'table-light';
            thead.innerHTML = `
                <tr>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Conteúdo Planejado</th>
                </tr>
            `;
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            aulas.forEach(aula => {
                const dataStr = aula.toISOString().split('T')[0];
                const conteudo = turma.planejamentos[dataStr] || '';
                const estaDesativada = turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${String(aula.getDate()).padStart(2, '0')}/${String(aula.getMonth() + 1).padStart(2, '0')}</td>
                    <td><span class="badge bg-${estaDesativada ? 'secondary' : 'success'}">${estaDesativada ? 'Desativada' : 'Ativa'}</span></td>
                    <td>
                        <input type="text" class="form-control form-control-sm planejamento-input"
                            data-data="${dataStr}"
                            placeholder="Conteúdo da aula"
                            value="${conteudo}"
                            ${estaDesativada ? 'disabled' : ''}>
                        ${estaDesativada ? '<small class="text-muted">Aula desativada (feriado/emenda)</small>' : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            container.appendChild(table);
        }
        modal.show();
    }

    async function salvarAulasMes() {
        const modalEl = document.getElementById('modalAulasMes');
        const turmaNome = modalEl.dataset.turma;
        if (!turmaNome) {
            console.error('Turma não definida no modal');
            return;
        }
        const turma = turmas.find(t => t.nome === turmaNome);
        if (!turma) {
            console.error('Turma não encontrada:', turmaNome);
            return;
        }
        const checkboxes = document.querySelectorAll('#containerAulasMes .aula-checkbox');
        const aulasDesativadas = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        turma.aulasDesativadas = aulasDesativadas;
        const resultado = await updateTurma(turma);
        if (resultado && resultado.success) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            renderizarTurmas();
            turma.alunos.forEach(ctr => {
                const aluno = alunos.find(a => a.ctr === ctr);
                if (aluno) {
                    atualizarInterfaceFrequencia(aluno, turma);
                }
            });
            showToast(`Aulas atualizadas para a turma ${turma.nome}! Frequência recalculada.`);
        } else {
            showToast('Falha ao salvar as alterações no servidor.');
        }
    }

    async function salvarPlanejamentos() {
        const modalEl = document.getElementById('modalPlanejamentos');
        const turmaNome = modalEl.dataset.turma;
        if (!turmaNome) {
            console.error('Turma não definida no modal');
            return;
        }
        const turma = turmas.find(t => t.nome === turmaNome);
        if (!turma) {
            console.error('Turma não encontrada:', turmaNome);
            return;
        }
        if (!turma.planejamentos) {
            turma.planejamentos = {};
        }
        const inputs = document.querySelectorAll('#containerPlanejamentos .planejamento-input');
        inputs.forEach(input => {
            const data = input.dataset.data;
            const conteudo = input.value.trim();
            if (conteudo) {
                turma.planejamentos[data] = conteudo;
            } else {
                delete turma.planejamentos[data];
            }
        });
        const resultado = await updateTurma(turma);
        if (resultado && resultado.success) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            showToast(`Planejamentos atualizados para a turma ${turma.nome}!`);
        } else {
            showToast('Falha ao salvar planejamentos no servidor.');
        }
    }

    function abrirModalTransferir(aluno) {
        const modalEl = document.getElementById('modalTransferir');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        const alunoData = alunos.find(a => a.ctr === aluno.ctr);
        if (!alunoData) {
            alert('Aluno não encontrado');
            return;
        }
        const turmaAtual = turmas.find(t => t.alunos.includes(alunoData.ctr) && !t.finalizada);
        document.getElementById('alunoSelecionadoLabel').textContent = `Aluno selecionado: ${alunoData.nome}`;
        document.getElementById('turmaAtualLabel').textContent = `Turma atual: ${turmaAtual ? turmaAtual.nome : 'Nenhuma'}`;
        const select = document.getElementById('turmaDestino');
        select.innerHTML = '';
        const turmasDisponiveis = turmas.filter(t => !t.finalizada && t !== turmaAtual);
        if (turmasDisponiveis.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'Nenhuma turma disponível';
            option.disabled = true;
            select.appendChild(option);
        } else {
            turmasDisponiveis.forEach(turma => {
                const option = document.createElement('option');
                option.value = turma.nome;
                option.textContent = turma.nome;
                select.appendChild(option);
            });
        }
        modal.show();
    }

    function abrirModalAdicionarAlunos(nomeTurma) {
        const turma = turmas.find(t => t.nome === nomeTurma);
        if (!turma) return;

        const modal = document.createElement('div');
        modal.classList.add('modal', 'fade');
        modal.id = 'modalAdicionarAlunos';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Adicionar Alunos à ${turma.nome}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <h6>Selecione alunos existentes:</h6>
                        <div class="mb-3">
                            <input type="text" id="buscaAlunosExistentes" class="form-control" placeholder="Buscar por nome ou CTR...">
                        </div>
                        <select id="selectAlunosExistentes" class="form-select" multiple size="6">
                            <!-- Será preenchido dinamicamente -->
                        </select>
                        <div class="form-text">Apenas alunos não matriculados em nenhuma turma são exibidos.</div>
                        <hr>
                        <h6>Ou registrar e adicionar novo aluno:</h6>
                        <div class="mb-2">
                            <input type="text" id="novoCTR" class="form-control" placeholder="CTR do novo aluno">
                        </div>
                        <div>
                            <input type="text" id="novoNome" class="form-control" placeholder="Nome do novo aluno">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        <button type="button" id="btnAdicionarAlunosModal" class="btn btn-primary">Adicionar à Turma</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        // Filtra apenas alunos não matriculados em nenhuma turma
        const candidatos = alunos.filter(a => !turma.alunos.includes(a.ctr) && (!a.turmas || a.turmas.length === 0));

        const select = document.getElementById('selectAlunosExistentes');
        const buscaInput = document.getElementById('buscaAlunosExistentes');

        function renderizarOpcoes(filtro = '') {
            select.innerHTML = '';
            const termo = filtro.toLowerCase();
            const filtrados = candidatos.filter(a =>
                a.ctr.toLowerCase().includes(termo) ||
                a.nome.toLowerCase().includes(termo)
            );
            if (filtrados.length === 0) {
                const option = document.createElement('option');
                option.textContent = 'Nenhum aluno encontrado';
                option.disabled = true;
                select.appendChild(option);
            } else {
                filtrados.forEach(a => {
                    const option = document.createElement('option');
                    option.value = a.ctr;
                    option.textContent = `${a.ctr} - ${a.nome}`;
                    select.appendChild(option);
                });
            }
        }

        // Renderiza inicialmente todos os candidatos
        renderizarOpcoes();

        // Aplica filtro ao digitar
        buscaInput.addEventListener('input', (e) => {
            renderizarOpcoes(e.target.value);
        });

        // Botão de adicionar
        modal.querySelector('#btnAdicionarAlunosModal').addEventListener('click', async () => {
            const select = document.getElementById('selectAlunosExistentes');
            const selecionados = Array.from(select.selectedOptions)
                .filter(opt => !opt.disabled)
                .map(el => el.value);

            const novoCTR = document.getElementById('novoCTR').value.trim();
            const novoNome = document.getElementById('novoNome').value.trim();

            // Validação dos selecionados
            selecionados.forEach(ctr => {
                if (!turma.alunos.includes(ctr)) {
                    turma.alunos.push(ctr);
                }
                const aluno = alunos.find(a => a.ctr === ctr);
                if (aluno) {
                    aluno.turmas = aluno.turmas || [];
                    if (!aluno.turmas.includes(turma.id)) {
                        aluno.turmas.push(turma.id);
                    }
                }
            });

            // Validação do novo aluno
            if (novoCTR && novoNome) {
                if (alunos.find(a => a.ctr === novoCTR)) {
                    alert('Um aluno com este CTR já existe.');
                    return;
                }
                const studentUserId = await createStudentUserAccount(novoNome, novoCTR);
                if (studentUserId) {
                    alunos.push({
                        ctr: novoCTR,
                        nome: novoNome,
                        userId: studentUserId,
                        role: 'student',
                        senha: 'aluno123',
                        status: 'ativo',
                        gold: 100,           // ✅ Inicializa com gold
                        mochila: [],         // ✅ Inicializa mochila vazia
                        equipamentos: {},    // ✅ Inicializa equipamentos vazios
                        turmas: [turma.id],
                        coverPic: '',      // URL da imagem de perfil
                        presencas: {}
                    });
                    turma.alunos.push(novoCTR);
                } else {
                    return;
                }
            }

            await updateTurma(turma);
            await saveAlunos(alunos);
            renderizarTurmas();
            showToast('Alunos adicionados à turma!');
            bsModal.hide();
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async function finalizarTurma(turma) {
        if (!turma || turma.finalizada) return;
        if (confirm(`Finalizar a turma ${turma.nome}?`)) {
            const marcarAlunos = confirm(`Marcar os ${turma.alunos.length} alunos como finalizados?`);
            turma.finalizada = true;
            await updateTurma(turma);
            if (marcarAlunos) {
                turma.alunos.forEach(ctr => {
                    const aluno = alunos.find(a => a.ctr === ctr);
                    if (aluno) aluno.status = 'finalizado';
                });
                await saveAlunos(alunos);
            }
            renderizarTurmas();
            showToast(`Turma ${turma.nome} finalizada!`);
        }
    }

    // === EVENT DELEGATION ===
    if (!window.turmasEventListenersAdicionados) {
        mainContent.addEventListener('click', async function(e) {
            // Registrar individual
            if (e.target.id === 'btnRegistrarIndividual') {
                const ctr = document.getElementById('ctrAluno').value.trim();
                const nome = document.getElementById('nomeAluno').value.trim();
                if (!ctr || !nome) return alert('Preencha CTR e nome');
                if (alunos.find(a => a.ctr === ctr)) return alert('Aluno já existe');
                const studentUserId = await createStudentUserAccount(nome, ctr);
                if (!studentUserId) return;
                alunos.push({
                    ctr,
                    nome,
                    userId: studentUserId,
                    role: 'student',
                    senha: 'aluno123',
                    status: 'ativo',
                    gold: 100,           // ✅ Inicializa com gold
                    mochila: [],         // ✅ Inicializa mochila vazia
                    equipamentos: {},    // ✅ Inicializa equipamentos vazios
                    turmas: [],
                    coverPic: '',      // URL da imagem de perfil
                    presencas: {}
                });
                await saveAlunos(alunos);
                atualizarDatalist();
                showToast('Aluno registrado!');
                bootstrap.Modal.getInstance(document.getElementById('modalAlunoIndividual')).hide();
                document.getElementById('ctrAluno').value = '';
                document.getElementById('nomeAluno').value = '';
            }

            // transferir aluno
            if (e.target.id === 'btnTransferirAluno') {
                const select = document.getElementById('turmaDestino');
                const ctrInput = document.getElementById('ctrTransferir');
                const ctr = ctrInput ? ctrInput.value.trim() : document.getElementById('alunoSelecionadoLabel').textContent.split(': ')[1];
                const aluno = alunos.find(a => a.ctr === ctr);
                const destinoNome = select.value;
                if (!aluno) return alert('Aluno não encontrado');
                if (!destinoNome || destinoNome === 'Nenhuma turma disponível') return alert('Selecione uma turma de destino válida');
                const turmaAtual = turmas.find(t => t.alunos.includes(ctr));
                const turmaDestino = turmas.find(t => t.nome === destinoNome);
                if (!turmaDestino) return alert('Turma de destino não encontrada');
                const promises = [];
                if (turmaAtual && turmaAtual !== turmaDestino) {
                    turmaAtual.alunos = turmaAtual.alunos.filter(c => c !== ctr);
                    promises.push(updateTurma(turmaAtual));
                }
                if (!turmaDestino.alunos.includes(ctr)) {
                    turmaDestino.alunos.push(ctr);
                }
                promises.push(updateTurma(turmaDestino));
                aluno.turmas = aluno.turmas || [];
                if (turmaAtual) {
                    aluno.turmas = aluno.turmas.filter(id => id !== turmaAtual.id);
                }
                if (!aluno.turmas.includes(turmaDestino.id)) {
                    aluno.turmas.push(turmaDestino.id);
                }
                promises.push(saveAlunos(alunos));
                await Promise.all(promises);
                renderizarTurmas();
                showToast(`Aluno transferido para ${turmaDestino.nome}`);
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalTransferir'));
                modal.hide();
            }

            // Registrar em massa
            if (e.target.id === 'btnRegistrarMassa') {
                const texto = document.getElementById('dadosMassa').value;
                const turmaNome = document.getElementById('turmaSelecionadaMassa').value;
                if (!texto.trim()) {
                    return alert('Cole os dados dos alunos na área de texto.');
                }

                const linhas = texto.trim().split('\n').slice(1); // Ignora cabeçalho
                let novosAlunosRegistrados = 0;
                const alunosAdicionadosCtrs = [];
                const promises = [];

                for (const linha of linhas) {
                    if (!linha.trim()) continue;

                    const partes = linha.split('\t').map(p => p.trim());

                    let ctr, nome;

                    // Detecta automaticamente o formato
                    if (partes.length >= 15) {
                        // Formato longo (ex: exportação do SIGA)
                        ctr = partes[12];
                        nome = partes[14];
                    } else if (partes.length >= 3) {
                        // Formato curto: Opções | CTR | Nome | Presença
                        ctr = partes[1];
                        nome = partes[2];
                    } else {
                        console.warn('Linha ignorada (formato inválido):', linha);
                        continue;
                    }

                    // Validação
                    if (!ctr || !nome || isNaN(ctr)) {
                        console.warn('Linha ignorada (CTR inválido ou nome ausente):', linha);
                        continue;
                    }

                    if (alunos.find(a => a.ctr === ctr)) {
                        console.warn('CTR já existe, ignorado:', ctr);
                        continue;
                    }

                    // Registra aluno
                    promises.push(
                        createStudentUserAccount(nome, ctr).then(studentUserId => {
                            if (studentUserId) {
                                alunos.push({
                                    ctr,
                                    nome,
                                    userId: studentUserId,
                                    role: 'student',
                                    senha: 'aluno123',
                                    status: 'ativo',
                                    gold: 100,           // ✅ Inicializa com gold
                                    mochila: [],         // ✅ Inicializa mochila vazia
                                    equipamentos: {},    // ✅ Inicializa equipamentos vazios
                                    turmas: [],
                                    coverPic: '',      // URL da imagem de perfil
                                    presencas: {}
                                });
                                alunosAdicionadosCtrs.push(ctr);
                                novosAlunosRegistrados++;
                            }
                        })
                    );
                }

                await Promise.all(promises);

                // Adiciona à turma selecionada
                if (turmaNome && novosAlunosRegistrados > 0) {
                    const turma = turmas.find(t => t.nome === turmaNome);
                    if (turma) {
                        alunosAdicionadosCtrs.forEach(ctr => {
                            if (!turma.alunos.includes(ctr)) {
                                turma.alunos.push(ctr);
                            }
                            const aluno = alunos.find(a => a.ctr === ctr);
                            if (aluno) {
                                aluno.turmas = aluno.turmas || [];
                                if (!aluno.turmas.includes(turma.id)) {
                                    aluno.turmas.push(turma.id);
                                }
                            }
                        });
                        await updateTurma(turma);
                    }
                }

                if (novosAlunosRegistrados > 0) {
                    await saveAlunos(alunos);
                }

                atualizarDatalist();
                renderizarTurmas();
                showToast(`${novosAlunosRegistrados} aluno(s) registrados${turmaNome ? ` e adicionados à ${turmaNome}` : ''}!`);
                bootstrap.Modal.getInstance(document.getElementById('modalAlunoMassa')).hide();
                document.getElementById('dadosMassa').value = '';
            }

            // Criar turma
            if (e.target.id === 'btnCriarTurma') {
                const nome = document.getElementById('nomeTurma').value.trim();
                const dataInicio = document.getElementById('dataInicio').value;
                const tipo = document.getElementById('tipoTurma').value;
                if (!nome || !dataInicio) return alert('Preencha todos os campos');
                if (!analisarTurma(nome)) return alert('Nome inválido. Use formato SQ2015_311');
                const analise = analisarTurma(nome);
                const novaTurma = {
                    nome,
                    diasAula: analise.dias,
                    horario: analise.horario,
                    codigo: analise.codigo,
                    dataInicio,
                    tipo,
                    duracao: tipo === 'ingles' ? 3 : 2,
                    alunos: [],
                    finalizada: false,
                    expandido: true
                };
                const turmaSalva = await createTurma(novaTurma);
                if (turmaSalva) {
                    turmas.push(turmaSalva);
                    renderizarTurmas();
                    showToast('Turma criada!');
                    const modalEl = document.getElementById('modalCriarTurma');
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                    document.getElementById('nomeTurma').value = '';
                    document.getElementById('dataInicio').value = '';
                }
            }

            // Deletar turmas
            if (e.target.id === 'btnConfirmarDelecaoTurmas') {
                deletarTurmasSelecionadas();
            }

            // Gerenciar aulas
            if (e.target.classList.contains('btn-gerenciar-turma')) {
                const turmaNome = e.target.dataset.turmaNome;
                if (turmaNome) {
                    abrirModalGerenciarAulas(turmaNome);
                }
            }

            // Aulas do mês
            if (e.target.id === 'btnAulasMes') {
                const modalGerenciar = document.getElementById('modalGerenciarAulas');
                const turmaNome = modalGerenciar.dataset.turmaNome;
                const turma = turmas.find(t => t.nome === turmaNome);
                if (turma) {
                    bootstrap.Modal.getInstance(modalGerenciar).hide();
                    setTimeout(() => abrirModalAulasMes(turma), 300);
                } else {
                    alert('Nenhuma turma ativa encontrada para este modal.');
                }
            }

            // Planejamentos
            if (e.target.id === 'btnPlanejamentos') {
                const modalGerenciar = document.getElementById('modalGerenciarAulas');
                const turmaNome = modalGerenciar.dataset.turmaNome;
                const turma = turmas.find(t => t.nome === turmaNome);
                if (turma) {
                    bootstrap.Modal.getInstance(modalGerenciar).hide();
                    setTimeout(() => abrirModalPlanejamentos(turma), 300);
                } else {
                    alert('Nenhuma turma ativa encontrada para este modal.');
                }
            }

            // Salvar aulas do mês
            if (e.target.id === 'btnSalvarAulasMes') {
                await salvarAulasMes();
            }

            // Salvar planejamentos
            if (e.target.id === 'btnSalvarPlanejamentos') {
                salvarPlanejamentos();
            }

            // btnTransferirAlunoModal
            if (e.target.id === 'btnTransferirAlunoModal') {
                const ctr = document.getElementById('ctrTransferir').value.trim();
                const aluno = alunos.find(a => a.ctr === ctr);
                if (!aluno) {
                    alert('Aluno não encontrado');
                    return;
                }
                abrirModalTransferir(aluno);
            }

            // Deletar Turmas
            if (e.target.id === 'btnDeletarTurmas') {
                abrirModalDeletarTurmas();
            }

            // Adicionar aluno
            if (e.target.classList.contains('btn-add-aluno')) {
                const nomeTurma = e.target.dataset.nome;
                if (nomeTurma) abrirModalAdicionarAlunos(nomeTurma);
            }

            // Finalizar turma
            if (e.target.classList.contains('btn-finalizar-turma')) {
                const nomeTurma = e.target.dataset.nome;
                if (nomeTurma) {
                    const turma = turmas.find(t => t.nome === nomeTurma);
                    if (turma && !turma.finalizada) {
                        finalizarTurma(turma);
                    }
                }
            }

            // Botão: Fechar mês
            if (e.target.classList.contains('btn-fechar-mes')) {
                //dia 10 do mês atual ou depois
                const hoje = new Date();
                if (hoje.getDate() < 10) {
                    const mesAtual = hoje.toLocaleString('pt-BR', { month: 'long' });
                    return alert(`A frequência do mês anterior só pode ser registrada a partir do dia 10 de ${mesAtual}.`);
                    // return alert('O mês anterior só pode ser registrado a partir do dia 10 deste mês.');
                }

                if (confirm(`Tem certeza que deseja registrar oficialmente a frequência do mês anterior?`)) {
                    if (typeof window.fecharMesManualmente === 'function') {
                        window.fecharMesManualmente(); // ✅ Só registra no backend
                        showToast(`Frequência do mês anterior registrada com sucesso!`);
                    } else {
                        showToast('Erro: função de fechamento não disponível.');
                    }
                }
            }


            // ✅ CORREÇÃO APLICADA AQUI: Presença com formato de data consistente
            if (e.target.classList.contains('presenca-checkbox')) {
                const { ctr, data, turma: nomeTurma } = e.target.dataset;
                const aluno = alunos.find(a => a.ctr === ctr);
                const turma = turmas.find(t => t.nome === nomeTurma);
                const dataStr = data; // Já está no formato YYYY-MM-DD graças à renderização corrigida
                const estaDesativada = turma?.aulasDesativadas?.includes(dataStr);
                const isEvadido = aluno?.status === 'EVA';
                const isTrancado = aluno?.status === 'trancado';

                if (estaDesativada || isEvadido || isTrancado) {
                    const estavaPresente = aluno?.presencas?.[nomeTurma]?.[dataStr] !== false;
                    e.target.checked = estavaPresente;
                    if (estaDesativada) {
                        alert('Esta aula está desativada (feriado/emenda) e não pode ter presença registrada.');
                    }
                    return;
                }

                if (aluno && turma) {
                    if (!aluno.presencas) aluno.presencas = {};
                    if (!aluno.presencas[nomeTurma]) aluno.presencas[nomeTurma] = {};
                    aluno.presencas[nomeTurma][dataStr] = e.target.checked;
                    await saveAlunos(alunos);
                    await updateTurma(turma);
                    atualizarInterfaceFrequencia(aluno, turma);
                }
            }
        });

        // Evento para o dropdown de reposições
        mainContent.addEventListener('change', async function(e) {
            if (e.target.classList.contains('reposicoes-select')) {
                const { ctr, turma: nomeTurma } = e.target.dataset;
                const valor = parseInt(e.target.value);
                const aluno = alunos.find(a => a.ctr === ctr);
                if (aluno) {
                    if (!aluno.reposicoes) aluno.reposicoes = {};
                    aluno.reposicoes[nomeTurma] = valor;
                    const turma = turmas.find(t => t.nome === nomeTurma);
                    await saveAlunos(alunos);
                    await updateTurma(turma);
                    atualizarInterfaceFrequencia(aluno, turma);
                    showToast(`Reposições atualizadas para ${aluno.nome} na turma ${nomeTurma}: ${valor}`);
                }
            }
        });

        window.turmasEventListenersAdicionados = true;
    }

    // Inicializa
    Promise.all([loadTurmas(), loadAlunos()]).then(([t, a]) => {
        turmas = t;
        alunos = a;
        window.turmasGlobal = t;
        window.alunosGlobal = a;
        atualizarDatalist();
        renderizarTurmas();
    });

    // Evento: Atualiza o modal de transferência ao digitar CTR
    const ctrInput = document.getElementById('ctrTransferir');
    if (ctrInput) {
        ctrInput.addEventListener('input', function() {
            const ctr = this.value.trim();
            const aluno = alunos.find(a => a.ctr === ctr);
            if (aluno) {
                const turmaAtual = turmas.find(t => t.alunos.includes(ctr) && !t.finalizada);
                document.getElementById('alunoSelecionadoLabel').textContent = `Aluno selecionado: ${aluno.nome}`;
                document.getElementById('turmaAtualLabel').textContent = `Turma atual: ${turmaAtual ? turmaAtual.nome : 'Nenhuma'}`;
                const select = document.getElementById('turmaDestino');
                select.innerHTML = '';
                turmas
                    .filter(t => !t.finalizada && t !== turmaAtual)
                    .forEach(turma => {
                        const option = document.createElement('option');
                        option.value = turma.nome;
                        option.textContent = turma.nome;
                        select.appendChild(option);
                    });
                if (select.children.length === 0) {
                    const option = document.createElement('option');
                    option.textContent = 'Nenhuma turma disponível';
                    option.disabled = true;
                    select.appendChild(option);
                }
            } else {
                document.getElementById('alunoSelecionadoLabel').textContent = 'Aluno selecionado: —';
                document.getElementById('turmaAtualLabel').textContent = 'Turma atual: —';
                document.getElementById('turmaDestino').innerHTML = '<option>Nenhum aluno selecionado</option>';
            }
        });
        const modalEl = document.getElementById('modalTransferir');
        if (modalEl) {
            modalEl.addEventListener('shown.bs.modal', () => {
                const event = new Event('input', { bubbles: true });
                ctrInput.dispatchEvent(event);
            });
        }
    }

    // Preenche o select de turmas no modal de registro em massa
    function atualizarSelectTurmasMassa() {
        const select = document.getElementById('turmaSelecionadaMassa');
        if (!select) return;
        select.innerHTML = '<option value="">Nenhuma (apenas registrar)</option>';
        const turmasAtivas = turmas.filter(t => !t.finalizada);
        turmasAtivas.forEach(turma => {
            const option = document.createElement('option');
            option.value = turma.nome;
            option.textContent = turma.nome;
            select.appendChild(option);
        });
    }
    atualizarSelectTurmasMassa();
    const renderizarOriginal = renderizarTurmas;
    renderizarTurmas = function() {
        renderizarOriginal();
        atualizarSelectTurmasMassa();
    };

    // Função de notificação
    if (!window.showToast) {
        window.showToast = function(message) {
            const toast = document.createElement('div');
            toast.className = 'position-fixed top-0 end-0 m-4 p-3 bg-primary text-white rounded-3 shadow-lg';
            toast.style.zIndex = '9999';
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.5s';
                setTimeout(() => document.body.removeChild(toast), 500);
            }, 2000);
        };
    }
}

// Função de notificação bonita
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 end-0 m-4 p-3 bg-primary text-white rounded-3 shadow-lg';
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => document.body.removeChild(toast), 500);
    }, 2000);
}


// Event delegation para botões com data-page
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (btn) {
        e.preventDefault();
        const page = btn.getAttribute('data-page');
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        const sidebarBtn = document.querySelector(`[data-page="${page}"]`);
        if (sidebarBtn) sidebarBtn.classList.add('active');
        if (pages[page]) {
            pages[page]();
        }
    }
});

// Carrega a página de perfil por padrão ao entrar no dashboard
document.addEventListener('DOMContentLoaded', () => {
    pages['perfil']();
});