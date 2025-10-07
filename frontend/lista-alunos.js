// Adicione estas funções no início do arquivo
function loadAlunos() {
  const token = localStorage.getItem('token');
  return fetch('http://localhost:3000/api/alunos', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(res => res.ok ? res.json() : []);
}

function loadTurmas() {
  const token = localStorage.getItem('token');
  return fetch('http://localhost:3000/api/turmas', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(res => res.ok ? res.json() : []);
}

function saveAlunos(alunos) {
  const token = localStorage.getItem('token');
  return fetch('http://localhost:3000/api/alunos', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(alunos)
  });
}

function saveTurmas(turmas) {
  const token = localStorage.getItem('token');
  return fetch('http://localhost:3000/api/turmas', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(turmas)
  });
}

// Função global para renderizar o modal de detalhes do aluno
window.renderizarModalDetalhesAluno = function(aluno, salvarDadosCallback, renderizarCallback) {
  const modalNome = document.getElementById('modalNomeAluno');
  const modalStatus = document.getElementById('modalStatusAluno');
  
  if (!modalNome || !modalStatus) {
    console.error('Elementos do modal não encontrados. Certifique-se de que o modal está presente no DOM.');
    return;
  }
  
  modalNome.textContent = aluno.nome;
  const statusExibicao = aluno.status === 'EVA' ? 'Evadido' : aluno.status;
  modalStatus.textContent = `Status: ${statusExibicao}`;

  const modal = new bootstrap.Modal(document.getElementById('modalDetalhesAluno'));
  modal.show();

  // === Botão Trancar/Destrancar ===
  const btnTrancar = document.getElementById('btnTrancarAluno');
  if (btnTrancar) {
    if (aluno.status === 'trancado') {
      btnTrancar.textContent = 'Destrancar Matrícula';
      btnTrancar.classList.remove('btn-outline-warning');
      btnTrancar.classList.add('btn-outline-success');
      btnTrancar.innerHTML = '<i class="bi bi-play-circle me-2"></i> Destrancar Matrícula';
    } else {
      btnTrancar.textContent = 'Trancar Matrícula';
      btnTrancar.classList.remove('btn-outline-success');
      btnTrancar.classList.add('btn-outline-warning');
      btnTrancar.innerHTML = '<i class="bi bi-pause-circle me-2"></i> Trancar Matrícula';
    }
  }

  // === Botão Evadido ===
  const btnEvadido = document.getElementById('btnMarcarEvadido');
  if (btnEvadido) {
    if (aluno.status === 'EVA') {
      btnEvadido.textContent = 'Remover status "Evadido"';
      btnEvadido.classList.remove('btn-outline-danger');
      btnEvadido.classList.add('btn-outline-success');
      btnEvadido.innerHTML = '<i class="bi bi-check-circle me-2"></i> Remover Evadido';
    } else {
      btnEvadido.textContent = 'Evadido';
      btnEvadido.classList.remove('btn-outline-success');
      btnEvadido.classList.add('btn-outline-danger');
      btnEvadido.innerHTML = '<i class="bi bi-x-circle me-2"></i> Evadido';
    }
  }

  if (btnTrancar) {
    btnTrancar.onclick = () => {
      if (aluno.status === 'trancado') {
        if (confirm(`Destrancar a matrícula de ${aluno.nome}?`)) {
          aluno.status = 'ativo';
          delete aluno.dataTrancamento;
          salvarDadosCallback();
          renderizarCallback();
          modal.hide();
          showToast('Matrícula destrancada!');
        }
      } else {
        if (confirm(`Trancar a matrícula de ${aluno.nome}?`)) {
          aluno.status = 'trancado';
          aluno.dataTrancamento = new Date().toISOString();
          salvarDadosCallback();
          renderizarCallback();
          modal.hide();
          showToast('Matrícula trancada!');
        }
      }
    };
  }

  // === Botão Evadido ===
  if (btnEvadido) {
    btnEvadido.onclick = () => {
      if (aluno.status === 'EVA') {
        if (confirm(`Remover status de evadido de ${aluno.nome}?`)) {
          aluno.status = 'ativo';
          salvarDadosCallback();
          renderizarCallback();
          modal.hide();
          showToast('Status de evadido removido!');
        }
      } else {
        if (confirm(`Marcar ${aluno.nome} como evadido?`)) {
          aluno.status = 'EVA';
          salvarDadosCallback();
          renderizarCallback();
          modal.hide();
          showToast('Aluno marcado como evadido!');
        }
      }
    };
  }

  // === Botão Transferir Aluno ===
  const btnTransferir = document.getElementById('btnTransferirAlunoModal');
  if (btnTransferir) {
    btnTransferir.onclick = () => {
      modal.hide();
      setTimeout(() => {
        const modalEl = document.getElementById('modalTransferirLista');
        if (!modalEl) {
          console.error('❌ Modal de transferência não encontrado');
          return;
        }

        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        // Preenche dados
        document.getElementById('nomeAlunoTransferir').value = aluno.nome;
        document.getElementById('ctrAlunoTransferir').value = aluno.ctr;

        const turmaAtual = window.appData.turmas.find(t => t.alunos.includes(aluno.ctr) && !t.finalizada);
        document.getElementById('turmaAtualTransferir').value = turmaAtual ? turmaAtual.nome : 'Nenhuma';

        // Preenche dropdown
        const select = document.getElementById('turmaDestinoTransferir');
        select.innerHTML = '<option disabled selected>Selecione uma turma</option>';

        const turmasDisponiveis = window.appData.turmas.filter(t => !t.finalizada && t !== turmaAtual);
        turmasDisponiveis.forEach(turma => {
          const option = document.createElement('option');
          option.value = turma.nome;
          option.textContent = turma.nome;
          select.appendChild(option);
        });

        if (turmasDisponiveis.length === 0) {
          const option = document.createElement('option');
          option.textContent = 'Nenhuma turma disponível';
          option.disabled = true;
          select.appendChild(option);
        }

        modal.show();
      }, 300);
    };
  }

  // === Botão Ver Registros ===
  const btnRegistros = document.getElementById('btnVerRegistros');
  if (btnRegistros) {
    btnRegistros.onclick = () => {
      modal.hide();
      setTimeout(() => {
        const modalEl = document.getElementById('modalRegistros');
        if (!modalEl) {
          console.error('❌ Modal de registros não encontrado');
          return;
        }
        
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        document.getElementById('registrosNomeAluno').textContent = aluno.nome;
        const lista = document.getElementById('listaRegistros');
        if (!lista) {
          console.error('❌ Elemento listaRegistros não encontrado');
          return;
        }
        
        lista.innerHTML = '';

        if (!aluno.registros || aluno.registros.length === 0) {
          lista.innerHTML = '<p class="text-muted">Nenhum registro encontrado.</p>';
        } else {
          aluno.registros.slice().reverse().forEach(registro => {
            const item = document.createElement('div');
            item.className = 'alert alert-light border rounded-3 small mb-2';
            item.innerHTML = `
              <div class="d-flex justify-content-between">
                <strong>${new Date(registro.data).toLocaleString()}</strong>
              </div>
              <p class="mb-0 mt-1">${registro.texto}</p>
            `;
            lista.appendChild(item);
          });
        }

        const btnAdicionar = document.getElementById('btnAdicionarRegistro');
        if (btnAdicionar) {
          btnAdicionar.onclick = () => {
            const texto = document.getElementById('novoRegistroTexto').value.trim();
            if (texto) {
              if (!aluno.registros) aluno.registros = [];
              aluno.registros.push({
                data: new Date().toISOString(),
                texto
              });
              salvarDadosCallback();
              
              // Atualizar a lista de registros
              lista.innerHTML = '';
              aluno.registros.slice().reverse().forEach(registro => {
                const item = document.createElement('div');
                item.className = 'alert alert-light border rounded-3 small mb-2';
                item.innerHTML = `
                  <div class="d-flex justify-content-between">
                    <strong>${new Date(registro.data).toLocaleString()}</strong>
                  </div>
                  <p class="mb-0 mt-1">${registro.texto}</p>
                `;
                lista.appendChild(item);
              });
              
              showToast('Registro adicionado!');
            }
          };
        }

        modal.show();
      }, 300);
    };
  }
};

// === FUNÇÃO PRINCIPAL: setupListaAlunos ===
function setupListaAlunos() {
  // Armazenamento local
  let alunos = [];
  let turmas = [];

  // Adicione esta função no início de setupTurmas()
  function showLoading() {
    const container = document.getElementById('tabelaAlunos');
    if (container) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Carregando...</span>
            </div>
            <p class="mt-2">Carregando alunos...</p>
          </td>
        </tr>
      `;
    }
  }

  // Salva dados
  function salvarDados() {
    saveAlunos(alunos);
    if (window.appData) {
      window.appData.alunos = alunos;
    }
  }

  // === Renderiza alunos com filtro por nome, CTR e status ===
  function renderizarAlunos(filtro = '') {
    const container = document.getElementById('tabelaAlunos');
    if (!container) return;
    container.innerHTML = '';

    const termos = filtro.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const filtrados = alunos.filter(aluno => {
      // Encontra a turma do aluno para usar na pesquisa
      const turmaAtual = turmas.find(t => t.alunos.includes(aluno.ctr) && !t.finalizada);
      const nomeTurmaAtual = turmaAtual ? turmaAtual.nome.toLowerCase() : '';

      const nomeAluno = aluno.nome.toLowerCase();
      const ctrAluno = aluno.ctr;
      const statusAluno = aluno.status.toLowerCase();

      // Verifica se todos os termos da pesquisa correspondem a algum campo
      return termos.every(termo =>
        nomeAluno.includes(termo) ||
        ctrAluno.includes(termo) ||
        statusAluno.includes(termo) ||
        nomeTurmaAtual.includes(termo)
      );
    });

    if (filtrados.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-5">
            Nenhum aluno encontrado.
          </td>
        </tr>
      `;
      return;
    }

    filtrados.forEach(aluno => {
      const turmaAtual = turmas.find(t => t.alunos.includes(aluno.ctr) && !t.finalizada);
      const statusClass = {
        'ativo': 'bg-success bg-opacity-10 text-success',
        'trancado': 'bg-info bg-opacity-10 text-info',
        'cancelado': 'bg-danger bg-opacity-10 text-danger',
        'finalizado': 'bg-secondary bg-opacity-10 text-secondary',
        'EVA': 'bg-danger bg-opacity-10 text-danger'
      }[aluno.status] || 'bg-light text-dark';

      const nomeClass = aluno.status === 'EVA' ? 'text-danger fw-bold' : '';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="ps-4 fw-medium">${aluno.ctr}</td>
        <td class="${nomeClass}">${aluno.nome}</td>
        <td><span class="badge ${statusClass} px-3 py-2 rounded-pill">${aluno.status === 'EVA' ? 'Evadido' : aluno.status}</span></td>
        <td>${turmaAtual ? turmaAtual.nome : 'Nenhuma'}</td>
        <td class="pe-4">
          <button class="btn btn-sm btn-outline-primary btn-ver-detalhes" data-ctr="${aluno.ctr}">
            <i class="bi bi-eye"></i>
          </button>
        </td>
      `;
      container.appendChild(row);
    });

    // Re-conecta eventos
    document.querySelectorAll('.btn-ver-detalhes').forEach(btn => {
      btn.addEventListener('click', () => {
        const ctr = btn.dataset.ctr;
        const aluno = alunos.find(a => a.ctr === ctr);
        if (aluno && window.renderizarModalDetalhesAluno) {
          window.renderizarModalDetalhesAluno(aluno, salvarDados, renderizarAlunos);
        }
      });
    });
  }

  // === Abre modal de transferência (novo, específico) ===
  function abrirModalTransferir(aluno) {
    const modalEl = document.getElementById('modalTransferirLista');
    if (!modalEl) {
      console.error('❌ Modal de transferência não encontrado');
      return;
    }

    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

    // Preenche dados
    document.getElementById('nomeAlunoTransferir').value = aluno.nome;
    document.getElementById('ctrAlunoTransferir').value = aluno.ctr;

    const turmaAtual = turmas.find(t => t.alunos.includes(aluno.ctr) && !t.finalizada);
    document.getElementById('turmaAtualTransferir').value = turmaAtual ? turmaAtual.nome : 'Nenhuma';

    // Preenche dropdown
    const select = document.getElementById('turmaDestinoTransferir');
    select.innerHTML = '<option disabled selected>Selecione uma turma</option>';

    const turmasDisponiveis = turmas.filter(t => !t.finalizada && t !== turmaAtual);
    turmasDisponiveis.forEach(turma => {
      const option = document.createElement('option');
      option.value = turma.nome;
      option.textContent = turma.nome;
      select.appendChild(option);
    });

    if (turmasDisponiveis.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'Nenhuma turma disponível';
      option.disabled = true;
      select.appendChild(option);
    }

    modal.show();
  }

  // === Inicializa ===
  showLoading();
  Promise.all([loadAlunos(), loadTurmas()]).then(([a, t]) => {
    alunos = a;
    turmas = t;
    
    // Garante que window.appData existe
    if (!window.appData) {
      window.appData = { alunos: [], turmas: [] };
    }
    window.appData.alunos = alunos;
    window.appData.turmas = turmas;
    
    renderizarAlunos();
  }).catch(error => {
    console.error('Erro ao carregar dados:', error);
    const container = document.getElementById('tabelaAlunos');
    if (container) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-danger py-5">
            <strong>Erro:</strong> Não foi possível carregar os alunos.
          </td>
        </tr>
      `;
    }
  });

  // Pesquisa
  const pesquisaInput = document.getElementById('pesquisaAluno');
  if (pesquisaInput) {
    pesquisaInput.addEventListener('input', (e) => {
      renderizarAlunos(e.target.value);
    });
  }

  // Botão Voltar
  const btnVoltar = document.getElementById('btnVoltarLista');
  if (btnVoltar) {
    btnVoltar.addEventListener('click', () => {
      const turmasItem = document.querySelector('[data-page="turmas"]');
      if (turmasItem) turmasItem.click();
    });
  }

  // Notificação
  if (!window.showToast) {
    window.showToast = function(message) {
      const toast = document.createElement('div');
      toast.className = 'position-fixed top-0 end-0 m-4 p-3 bg-primary text-white rounded-3 shadow-lg';
      toast.style.zIndex = '9999';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => document.body.removeChild(toast), 500);
      }, 2000);
    };
  }

  // === Evento: Confirmar transferência ===
  document.getElementById('btnConfirmarTransferencia')?.addEventListener('click', () => {
    const ctr = document.getElementById('ctrAlunoTransferir').value;
    const destinoNome = document.getElementById('turmaDestinoTransferir').value;

    if (!destinoNome || destinoNome === 'Nenhuma turma disponível') {
      alert('Selecione uma turma de destino válida');
      return;
    }

    const aluno = alunos.find(a => a.ctr === ctr);
    if (!aluno) {
      alert('Erro: Aluno não encontrado');
      return;
    }

    const turmaAtual = turmas.find(t => t.alunos.includes(ctr));
    const turmaDestino = turmas.find(t => t.nome === destinoNome);

    if (!turmaDestino) {
      alert('Turma de destino não encontrada');
      return;
    }

    if (turmaAtual) {
      turmaAtual.alunos = turmaAtual.alunos.filter(c => c !== ctr);
    }

    if (!turmaDestino.alunos.includes(ctr)) {
      turmaDestino.alunos.push(ctr);
    }

    salvarDados();
    renderizarAlunos();
    showToast(`Aluno transferido para ${turmaDestino.nome}`);

    const modalEl = document.getElementById('modalTransferirLista');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
  });
}