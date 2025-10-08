// frontend/aluno-dashboard.js
const API_BASE = window.location.origin.includes('localhost')
  ? 'http://localhost:3000'
  : 'https://student-dashboard-t5y0.onrender.com';


// **NOVO**: Verifica autenticação para alunos
const token = localStorage.getItem('token');
const account = JSON.parse(localStorage.getItem('account'));

if (!token || !account || account.role !== 'student') {
    alert('Acesso negado! Faça login como aluno.');
    window.location.href = 'index.html';
}

// Elementos da UI
const mainContentAluno = document.getElementById('mainContentAluno');
const logoutBtnAluno = document.getElementById('logoutBtnAluno');
const menuToggleAluno = document.getElementById('menuToggleAluno');
const sidebarAluno = document.getElementById('sidebar-wrapper-aluno');
const sidebarItemsAluno = document.querySelectorAll('#sidebar-wrapper-aluno .list-group-item[data-page]');

// Variáveis globais
let studentProfile = {}; // Variável global para armazenar os dados do perfil do aluno
let turmasGlobal = []; // Para armazenar as turmas carregadas

// Função para obter o mês atual considerando a regra de dia 11
function getMesAtualParaInterface() {
  const hoje = new Date();
  const dia = hoje.getDate();
  let mes = hoje.getMonth();
  let ano = hoje.getFullYear();
  
  // Se for até o dia 10, considera o mês anterior
  if (dia <= 10) {
    mes = mes === 0 ? 11 : mes - 1;
    ano = mes === 11 ? ano - 1 : ano;
  }
  
  return { mes, ano };
}

// Gera dias de aula no mês
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

// --- Funções API para Aluno ---
async function loadAlunoProfile() {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/student/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        console.error('Falha ao carregar perfil do aluno:', res.status, await res.text());
        return null;
    }
    
    const profile = await res.json();
    turmasGlobal = profile.turmas || []; // agora vem junto na resposta
    
    console.log("Perfil do aluno carregado:", profile);
    console.log("Turmas do aluno carregadas:", turmasGlobal);
    return profile;
}



// Função para carregar uma página HTML externa no mainContentAluno
async function loadPageAluno(url) {
    try {
        const res = await fetch(`${url}?t=${Date.now()}`); // Cache-busting
        if (!res.ok) throw new Error(`Falha ao carregar ${url}: ${res.status}`);
        const html = await res.text();
        mainContentAluno.innerHTML = html;
        
        // Executa funções específicas de inicialização baseadas na página
        if (url.includes('meu-perfil-aluno.html')) {
            await setupMeuPerfilAluno();
        }
    } catch (err) {
        mainContentAluno.innerHTML = `<p class="text-danger">Erro ao carregar página: ${err.message}</p>`;
        console.error('Erro ao carregar página do aluno:', err);
    }
}

// Adicione esta função global para atualizar o perfil do aluno
function atualizarPerfilAluno(profile) { // [32]
    if (!profile) return;

    // Atualiza elementos de perfil [32, 44]
    const profileNameAluno = document.getElementById('profileNameAluno'); // [32]
    const profilePicAluno = document.getElementById('profilePicAluno'); // [32]
    const coverPicAluno = document.getElementById('coverPicAluno'); // [32]
    const ctrAluno = document.getElementById('ctrAluno'); // [32]
    const statusAluno = document.getElementById('statusAluno'); // [32]

    if (profileNameAluno) profileNameAluno.textContent = profile.nome || 'Aluno';
    if (profilePicAluno) profilePicAluno.src = profile.pic || 'assets/profile-placeholder.jpg';
    if (coverPicAluno) coverPicAluno.src = profile.coverPic || 'assets/cover-placeholder.png';
    if (ctrAluno) ctrAluno.textContent = profile.ctr || '-';
    if (statusAluno) { // [44]
        const statusText = profile.status === 'ativo' ? 'Ativo' :
            (profile.status === 'EVA' ? 'Evadido' :
            (profile.status === 'trancado' ? 'Trancado' : 'Desconhecido')); // [44]
        statusAluno.textContent = statusText;

        statusAluno.className = 'mb-0 fw-medium'; // [44]
        if (profile.status === 'ativo') {
            statusAluno.classList.add('text-success');
        } else if (profile.status === 'EVA' || profile.status === 'trancado') {
            statusAluno.classList.add('text-danger');
        } else {
            statusAluno.classList.add('text-muted');
        }
    }

    atualizarTurmasAluno(profile); // [8]
    atualizarFrequenciaAluno(profile); // [8]
}

// Atualiza as turmas do aluno
function atualizarTurmasAluno(profile) { // [8]
    const container = document.getElementById('turmasAlunoContainer'); // [8]
    if (!container) return;

    // ✅ MODIFICAÇÃO: profile.turmas já contém os objetos de turma detalhados do backend [7]
    if (!profile.turmas || profile.turmas.length === 0) { // [8]
        container.innerHTML = `
            <div class="alert alert-info" role="alert">
                Você não está matriculado em nenhuma turma.
            </div>
        `;
        return;
    }

    // ✅ REMOVIDO: Não precisa mais buscar turmas separadamente, pois profile.turmas já está detalhado [9]
    // fetch('http://localhost:3000/api/turmas', { ... }).then(res => res.json()).then(turmas => { ... })
    let turmasHTML = '';
    profile.turmas.forEach(turma => { // ✅ Iterar diretamente sobre os objetos de turma [7]
        // O objeto 'turma' aqui já vem com 'id', 'nome', 'diasAula', 'horario', 'finalizada', 'dataInicio'
        // diretamente do backend (routes/student.js) [7]
        turmasHTML += `
            <div class="card mb-3 shadow-sm">
                <div class="card-body">
                    <h5 class="card-title text-primary">${turma.nome}</h5>
                    <p class="card-text mb-1"><strong>Dias:</strong> ${turma.diasAula.join(', ')}</p>
                    <p class="card-text mb-1"><strong>Horário:</strong> ${turma.horario}</p>
                    <p class="card-text"><strong>Início:</strong> ${new Date(turma.dataInicio).toLocaleDateString()}</p>
                    <span class="badge ${turma.finalizada ? 'bg-secondary' : 'bg-success'}">
                        ${turma.finalizada ? 'Finalizada' : 'Ativa'}
                    </span>
                </div>
            </div>
        `;
    });

    if (!turmasHTML) {
        container.innerHTML = `
            <div class="alert alert-info" role="alert">
                Você não está matriculado em nenhuma turma ativa.
            </div>
        `;
    } else {
        container.innerHTML = turmasHTML;
    }

    // ✅ REMOVIDO o .catch do fetch, pois não estamos mais fazendo um fetch aqui. [45]
}

// Atualiza a frequência do aluno
async function atualizarFrequenciaAluno(profile) { // [45]
    const mesesRegistrados = document.getElementById('mesesRegistrados'); // [45]
    const frequenciaAtual = document.getElementById('frequenciaAtual'); // [46]
    const statusFrequencia = document.getElementById('statusFrequencia'); // [46]

    if (!mesesRegistrados) console.error("❌ Elemento 'mesesRegistrados' não encontrado no DOM!");
    if (!frequenciaAtual) console.error("❌ Elemento 'frequenciaAtual' não encontrado no DOM! O card mostra '-'?");
    if (!statusFrequencia) console.error("❌ Elemento 'statusFrequencia' não encontrado no DOM!");

    if (!mesesRegistrados || !frequenciaAtual || !statusFrequencia) return;

    // Função interna para calcular aulas faltantes
    const calcularStatus = (totalPresencas, totalAulas) => {
        if (totalAulas === 0) {
            return { 
                porcentagem: 'N/A', 
                statusText: 'Sem aulas', 
                statusClass: 'text-muted', 
                aulasFaltantes: 0 
            };
        }

        const porcentagem = Math.round((totalPresencas / totalAulas) * 100);
        let aulasFaltantes = 0;
        let statusText = 'Frequente';
        let statusClass = 'text-success';

        if (porcentagem < 75) {
            statusText = 'Infrequente';
            statusClass = 'text-danger';
            
            // Lógica para calcular aulas faltantes:
            // Queremos que (totalPresencas + X) / totalAulas >= 0.75
            // totalPresencas + X >= totalAulas * 0.75
            // X >= (totalAulas * 0.75) - totalPresencas
            
            // Usamos Math.ceil para garantir que o número seja inteiro e suficiente
            aulasFaltantes = Math.max(0, Math.ceil((totalAulas * 0.75) - totalPresencas));
        }

        return { porcentagem, statusText, statusClass, aulasFaltantes };
    };

    // Carrega o histórico de frequência [46]
    try {
        const historicoRes = await fetch('/api/frequencia/historico', { // [46]
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } // [46]
        });
        if (!historicoRes.ok) throw new Error('Erro ao carregar histórico de frequências');
        const historico = await historicoRes.json();

        mesesRegistrados.textContent = historico.length; // [46]

        if (historico.length > 0) {
            const ultimoMes = historico[historico.length - 1]; // [46]
            const totalPresencas = (ultimoMes.totalAulas * ultimoMes.porcentagem) / 100; // Recria a contagem de presença
            
            const resultado = calcularStatus(totalPresencas, ultimoMes.totalAulas);

            frequenciaAtual.textContent = `${resultado.porcentagem}%`; // [47]
            statusFrequencia.textContent = resultado.statusText; // [47]
            statusFrequencia.className = `mb-0 fw-medium ${resultado.statusClass}`; // [47]

            // ✅ NOVO: Adiciona o feedback de aulas faltantes no elemento de frequência
            if (resultado.aulasFaltantes > 0) {
                frequenciaAtual.textContent += ` (+${resultado.aulasFaltantes} aulas)`;
            }

        } else {
            // ✅ MODIFICAÇÃO: Calcula frequência atual do mês sem refetch de todas as turmas
            const { mes, ano } = getMesAtualParaInterface(); // [47]
            let totalPresencas = 0; // [48]
            let totalAulas = 0; // [48]

            // Para cada turma do aluno
            profile.turmas.forEach(turma => { 
                if (!turma) return;

                // Calcula aulas do mês [48]
                const aulas = gerarAulasMes(turma, mes, ano); // [48]
                const aulasAtivas = aulas.filter(aula => {
                    const dataStr = aula.toISOString().split('T')[0]; // Corrigindo para data
                    return !(turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr)); // [48]
                });

                // Conta presenças [49]
                const presencas = aulasAtivas.filter(aula => {
                    const dataStr = aula.toISOString().split('T')[0]; // Corrigindo para data
                    return profile.presencas?.[turma.nome]?.[dataStr] !== false; // [49]
                }).length;

                totalPresencas += presencas; // [49]
                totalAulas += aulasAtivas.length; // [49]
            });

            const resultado = calcularStatus(totalPresencas, totalAulas);

            frequenciaAtual.textContent = `${resultado.porcentagem}%`; // [50]
            statusFrequencia.textContent = resultado.statusText; // [50]
            statusFrequencia.className = `mb-0 fw-medium ${resultado.statusClass}`; // [50]

            // ✅ NOVO: Adiciona o feedback de aulas faltantes no elemento de frequência
            if (resultado.aulasFaltantes > 0) {
                frequenciaAtual.textContent += ` (+${resultado.aulasFaltantes} aulas)`;
            }
        }

    } catch (err) { // [45]
        console.error('Erro ao carregar histórico de frequência ou calcular atual:', err); // [45]
        frequenciaAtual.textContent = 'Erro'; // [45]
        statusFrequencia.textContent = 'Indisponível'; // [45]
        statusFrequencia.className = 'mb-0 fw-medium text-warning'; // [45]
    }
}

// Exemplo de função para configurar a página "Meu Perfil" do aluno
async function setupMeuPerfilAluno() {
    // === 1. Carrega perfil básico (nome, CTR, turmas, etc.) ===
    if (!studentProfile || Object.keys(studentProfile).length === 0) {
        const profile = await loadAlunoProfile();
        if (profile) {
            studentProfile = profile;
        } else {
            showToast('Erro ao carregar seu perfil.');
            return;
        }
    }

    // Atualiza UI com dados básicos (nome, CTR, status, turmas, frequência)
    atualizarPerfilAluno(studentProfile);

    // === UPLOAD DE CAPA DO ALUNO ===
    const coverPic = document.getElementById('coverPic');
    const coverGradient = document.getElementById('coverGradient');
    const coverUpload = document.getElementById('coverUpload');

    if (coverPic && coverGradient && coverUpload) {
        // Carrega capa salva
        if (studentProfile.coverPic) {
            coverPic.src = studentProfile.coverPic;
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
            await saveMeuAluno({ coverPic: base64 });
            studentProfile.coverPic = base64;
            showToast('Capa atualizada com sucesso!');
            };
            reader.readAsDataURL(file);
        });
    }

    // === 2. Upload de foto de perfil (mantido do seu código original) ===
    const profilePicAluno = document.getElementById('profilePicAluno');
    if (profilePicAluno) {
        let fileInput = document.getElementById('alunoFileInput');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'alunoFileInput';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
        }

        const handleFileSelect = async (files) => {
            if (!files?.length) return;
            const file = files[0];
            if (!file.type.match('image.*')) {
                return showToast('Por favor, selecione um arquivo de imagem válido.');
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const newPicBase64 = e.target.result;
                profilePicAluno.src = newPicBase64;

                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch('/api/student/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ pic: newPicBase64 })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Erro ao salvar a foto.');

                    if (studentProfile) studentProfile.pic = newPicBase64;
                    showToast('Foto de perfil atualizada com sucesso!');
                } catch (err) {
                    console.error('Erro ao salvar foto do aluno:', err);
                    showToast(`Erro: ${err.message}`);
                    if (studentProfile) {
                        profilePicAluno.src = studentProfile.pic || 'assets/profile-placeholder.jpg';
                    }
                }
            };
            reader.readAsDataURL(file);
        };

        profilePicAluno.addEventListener('click', () => {
            fileInput.onchange = (e) => handleFileSelect(e.target.files);
            fileInput.click();
        });
    }

    // === 3. Carrega dados de jogo (gold, mochila, equipamentos) ===
    try {
        const alunoCompleto = await loadAlunoProfile(); // ← Função que criei (usa /api/alunos)

        // Atualiza gold
        const goldEl = document.getElementById('goldAluno');
        if (goldEl) goldEl.textContent = alunoCompleto.gold || 0;

        // Atualiza slots e poder
        const equip = alunoCompleto.equipamentos || {};
        const slots = ['cabeca', 'camisa', 'calca', 'pes', 'artefato'];
        const slotPlaceholders = {
            cabeca: '🧢',
            camisa: '👕',
            calca: '👖',
            pes: '👟',
            artefato: '✨'
        };
        let totalPower = 0;

        slots.forEach(slot => {
            const el = document.querySelector(`.equip-slot[data-slot="${slot}"] .fs-2`);
            if (el) {
                const item = equip[slot];
                if (item && item.icone) {
                    // Usa <img> para suportar imagens reais (não só emojis)
                    el.innerHTML = `<img src="${item.icone}" width="40" height="40" style="object-fit: contain;">`;
                    totalPower += item.power || 0;
                } else {
                    el.textContent = slotPlaceholders[slot];
                }
            }
        });

        const poderEl = document.getElementById('poderTotal');
        if (poderEl) poderEl.textContent = totalPower;

        // === 4. Modal da mochila ===
        const btnMochila = document.getElementById('btnAbrirMochilaAluno');
        if (btnMochila) {
            btnMochila.onclick = () => {
                const modal = new bootstrap.Modal(document.getElementById('modalMochilaAluno'));
                const container = document.getElementById('itensMochilaAluno');
                const goldEl = document.getElementById('goldMochila');

                goldEl.textContent = alunoCompleto.gold || 0;
                container.innerHTML = '';

                if (!alunoCompleto.mochila || alunoCompleto.mochila.length === 0) {
                    container.innerHTML = '<div class="col-12 text-center text-muted py-3">Sua mochila está vazia.</div>';
                } else {
                    alunoCompleto.mochila.forEach((item, index) => {
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
                        const item = alunoCompleto.mochila[idx];
                        if (!item || !item.slot) return;

                        if (!alunoCompleto.equipamentos) alunoCompleto.equipamentos = {};
                        alunoCompleto.equipamentos[item.slot] = item;

                        // Salva no backend
                        await saveMeuAluno({
                            gold: alunoCompleto.gold,
                            mochila: alunoCompleto.mochila,
                            equipamentos: alunoCompleto.equipamentos
                        });

                        showToast(`Item "${item.nome}" equipado!`);
                        setupMeuPerfilAluno(); // Recarrega tudo
                        modal.hide();
                    });
                });

                modal.show();
            };
        }

    } catch (err) {
        console.error('Erro ao carregar dados de equipamentos:', err);
        showToast('Erro ao carregar seus itens.');
    }
}


// Salva apenas os dados do aluno logado (não o array completo)
async function saveMeuAluno(updates) {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/student/profile', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Erro ao salvar seus dados.');
    return await res.json();
}


// Carrega tarefas do aluno
async function loadTarefasAluno() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/api/tarefas/aluno`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Erro ao buscar tarefas:', res.status, text);
      showToast('Erro ao carregar tarefas.');
      return [];
    }

    const data = await res.json();
    console.log('📋 Tarefas recebidas:', data);
    return data;
  } catch (err) {
    console.error('⚠️ Falha na conexão ao buscar tarefas:', err);
    showToast('Erro de conexão com o servidor.');
    return [];
  }
}

// Marca tarefa como concluída
async function concluirTarefaAluno(tarefaId) {
    const token = localStorage.getItem('token');
    await fetch('/api/tarefas/concluir', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tarefaId })
    });
}

// Configura a página de tarefas do aluno
async function setupTarefasAluno() {
    const listaTarefas = document.getElementById('listaTarefasAluno');
    if (!listaTarefas) return;

    const tarefas = await loadTarefasAluno();

    if (tarefas.length === 0) {
        listaTarefas.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="text-muted">Nenhuma tarefa atribuída.</div>
            </div>
        `;
        return;
    }

    // Limpa a lista
    listaTarefas.innerHTML = '';

    tarefas.forEach(tarefa => {
        const hoje = new Date();
        const prazo = tarefa.prazo ? new Date(tarefa.prazo) : null;
        const atrasada = prazo && prazo < hoje && !tarefa.entregue;

        // Determina o status da tarefa
        let statusBadge = '';
        let acoes = '';

         if (tarefa.corrigida) {
            statusBadge = `<span class="badge bg-success">Corrigida</span>`;
            acoes = tarefa.recompensaGold ? 
                `<small class="text-success mt-1 d-block">+${tarefa.recompensaGold} 🪙 recebidos!</small>` : '';
        } else if (tarefa.entregue) {
            statusBadge = `<span class="badge bg-warning">Entregue</span>`;
            acoes = `<small class="text-muted mt-1 d-block">Aguardando correção...</small>`;
        } else {
            acoes = `<button class="btn btn-sm btn-primary mt-2 btn-entregar-tarefa" data-id="${tarefa.id}">📤 Entregar com Foto</button>`;
        }
        
        console.log("Renderizando tarefa:", tarefa);
        // Cria o card da tarefa
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4';
        card.innerHTML = `
            <div class="card border-0 shadow-sm h-100 ${atrasada && !tarefa.entregue ? 'border-danger border-2' : ''}">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title fw-bold ${tarefa.corrigida ? 'text-decoration-line-through text-muted' : ''}">
                            ${tarefa.titulo} - <span class="bg-warning text-white rounded">${tarefa.recompensaGold} 🪙</span>
                        </h6>
                        ${statusBadge}
                    </div>
                    ${tarefa.descricao ? `<p class="card-text text-muted small">${tarefa.descricao}</p>` : ''}
                    <div class="mt-auto">
                        ${prazo ? `<small class="text-muted d-block">Prazo: ${prazo.toLocaleDateString('pt-BR')}</small>` : ''}
                        ${atrasada && !tarefa.entregue ? `<small class="text-danger">⚠️ Atrasada</small>` : ''}
                        ${acoes}
                    </div>
                </div>
            </div>
        `;
        listaTarefas.appendChild(card);
    });

    // Configura botões de entrega
    document.querySelectorAll('.btn-entregar-tarefa').forEach(btn => {
        btn.addEventListener('click', () => {
            const tarefaId = btn.dataset.id;
            abrirModalEntrega(tarefaId);
        });
    });
}

// Abre modal para entrega de tarefa com foto
function abrirModalEntrega(tarefaId) {
    // Cria o modal dinamicamente (se não existir)
    let modalEl = document.getElementById('modalEntregaTarefa');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'modalEntregaTarefa';
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Entregar Tarefa</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Envie uma foto clara do exercício resolvido.</p>
                        <input type="file" class="form-control" id="inputFotoEntrega" accept="image/*" required>
                        <div class="mt-2 text-center">
                            <img id="previewFotoEntrega" src="" class="img-thumbnail d-none" style="max-height: 200px; object-fit: cover;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" id="btnConfirmarEntrega">Enviar Foto</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        // Preview da imagem
        document.getElementById('inputFotoEntrega').addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('previewFotoEntrega');
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    preview.src = reader.result;
                    preview.classList.remove('d-none');
                };
                reader.readAsDataURL(file);
            } else {
                preview.classList.add('d-none');
            }
        });
    }

    // Configura o botão de confirmação
    const btnConfirmar = document.getElementById('btnConfirmarEntrega');
    btnConfirmar.onclick = async () => {
        const fileInput = document.getElementById('inputFotoEntrega');
        const file = fileInput.files[0];
        if (!file) {
            showToast('⚠️ Selecione uma foto do exercício.');
            return;
        }

        const formData = new FormData();
        formData.append('tarefaId', tarefaId);
        formData.append('foto', file);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/tarefas/entregar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const modal = bootstrap.Modal.getInstance(modalEl);
            if (res.ok) {
                showToast('✅ Tarefa entregue! Aguarde a correção.');
                modal.hide();
                // Recarrega as tarefas
                setupTarefasAluno();
            } else {
                const err = await res.json();
                showToast(`❌ ${err.message || 'Erro ao entregar.'}`);
            }
        } catch (err) {
            console.error('Erro na entrega:', err);
            showToast('❌ Falha na conexão.');
        }
    };

    // Mostra o modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// Mapeamento de páginas para o aluno
const pagesAluno = {
    'meu-perfil-aluno': () => loadPageAluno('meu-perfil-aluno.html'),
    'minhas-turmas-aluno': () => loadPageAluno('aluno-minhas-turmas.html'),
    'minha-frequencia-aluno': () => loadPageAluno('aluno-minha-frequencia.html'),
    'tarefas-aluno': () => loadPageAluno('tarefas-aluno.html').then(() => {
        if (typeof setupTarefasAluno === 'function') {
            setupTarefasAluno();
        }
    }),
    'loja-aluno': () => {
        loadPageAluno('loja-aluno.html').then(() => {
            // Evita carregar o mesmo script duas vezes
            if (!window.lojaScriptCarregado) {
                window.lojaScriptCarregado = true;
                const script = document.createElement('script');
                script.src = 'loja-aluno.js?v=' + Date.now(); // cache-busting
                script.onload = () => {
                    if (typeof setupLojaAluno === 'function') {
                        setupLojaAluno();
                    } else {
                        console.error('❌ setupLojaAluno não está definido após carregar loja-aluno.js');
                    }
                };
                document.body.appendChild(script);
            } else {
                if (typeof setupLojaAluno === 'function') {
                    setupLojaAluno();
                }
            }
        });
    },
    'arena-aluno': () => {
        loadPageAluno('arena-aluno.html').then(() => {
            // Se você criar um arquivo arena-aluno.js:
            if (typeof setupArenaAluno !== 'function') {
                const script = document.createElement('script');
                script.src = 'arena-aluno.js';
                script.onload = () => {
                    if (typeof setupArenaAluno === 'function') {
                        setupArenaAluno();
                    } else {
                        console.error('❌ setupArenaAluno não está definido após carregar arena-aluno.js');
                    }
                };
                document.body.appendChild(script);
            } else {
                // Já foi carregado (ex: em cache ou SPA)
                setupArenaAluno();
            }
        });
    },
};

// Event Listeners para a navegação e logout
logoutBtnAluno?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('account');
        window.location.href = 'index.html';
    }
});

sidebarItemsAluno.forEach(item => {
    item.addEventListener('click', () => {
        const page = item.getAttribute('data-page');
        sidebarItemsAluno.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if (pagesAluno[page]) {
            pagesAluno[page]();
        } else {
            mainContentAluno.innerHTML = `<p class="text-info">Funcionalidade em desenvolvimento.</p>`;
        }
    });
});

menuToggleAluno?.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebarAluno.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    const isSidebar = sidebarAluno?.contains(e.target);
    const isToggle = menuToggleAluno?.contains(e.target);
    if (!isSidebar && !isToggle && window.innerWidth <= 992) {
        sidebarAluno?.classList.remove('show');
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
        sidebarAluno?.classList.remove('show');
    }
});

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

// Inicializa o dashboard do aluno ao carregar a página
document.addEventListener('DOMContentLoaded', async () => {
    loadAlunoProfile().then(profile => {
        if (profile) {
            studentProfile = profile;
            // Carrega a página inicial do aluno (ex: perfil)
            pagesAluno['meu-perfil-aluno']();
        } else {
            // Lidar com o caso de perfil não encontrado ou erro
            mainContentAluno.innerHTML = `<p class="text-danger">Não foi possível carregar seu perfil. Tente novamente mais tarde.</p>`;
        }
    }).catch(err => {
        console.error("Erro na inicialização do dashboard do aluno:", err);
        mainContentAluno.innerHTML = `<p class="text-danger">Ocorreu um erro ao carregar o dashboard.</p>`;
    });
});