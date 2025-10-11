// arena-aluno.js
let meuId = null; // Será definido ao carregar o perfil

// Função principal
// arena-aluno.js
async function setupArenaAluno() {
  try {

    meuId = JSON.parse(localStorage.getItem('account'))?.id;

    // 1. Carrega MEU estado de cansaço
    const meuEstadoRes = await fetch('/api/arena/meu-estado', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const meuEstado = await meuEstadoRes.json();

    const statusTopo = document.getElementById('statusTopoArena');
    if (statusTopo) {
      const agora = new Date();
      if (meuEstado.cansadoAte && new Date(meuEstado.cansadoAte) > agora) {
        const fim = new Date(meuEstado.cansadoAte);
        statusTopo.innerHTML = `⚠️ Você está cansado até ${fim.toLocaleTimeString()}`;
        statusTopo.className = 'text-danger mb-3';
      } else {
        statusTopo.innerHTML = '✅ Pronto para batalhar!';
        statusTopo.className = 'text-success mb-3';
      }
    }

    // 2. Carrega adversários
    const res = await fetch('/api/arena/alunos', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const adversarios = await res.json();

    const container = document.getElementById('listaAlunosArena');
    container.innerHTML = adversarios.map(a => {
      const poder = Object.values(a.equipamentos).reduce((sum, item) => sum + (item?.power || 0), 0);
      
      // Estado do adversário
      const agora = new Date();
      const estaCansado = a.cansadoAte && new Date(a.cansadoAte) > agora;
      const statusAdversario = estaCansado ? 
        '<span class="badge bg-warning text-dark">Cansado</span>' : 
        '<span class="badge bg-success">Disponível</span>';

      // Monta slots com tooltip
      const slots = ['cabeca', 'camisa', 'calca', 'pes', 'artefato'];
      const slotHTML = slots.map(slot => {
        const item = a.equipamentos[slot];
        if (item) {
          return `
            <div class="position-relative d-inline-block mx-1" data-bs-toggle="tooltip" 
                 title="${item.nome || 'Item'}\n+${item.power || 0} Poder\n${item.efeito || ''}">
              <img src="${item.icone}" width="32" height="32" style="object-fit: contain;">
            </div>
          `;
        } else {
          return `<div class="d-inline-block mx-1" style="width:32px;height:32px;background:#eee;border-radius:4px;"></div>`;
        }
      }).join('');

      return `
        <div class="col-md-4">
          <div class="card p-3 text-center shadow-sm">
            <img src="${a.pic}" class="rounded-circle mx-auto mb-2" width="60" height="60" style="object-fit: cover;">
            <h6 class="mb-1">${a.nome}</h6>
            <small class="text-muted">${a.ctr}</small>
            <div class="mt-2">
              <span class="badge bg-warning text-dark">🪙 ${a.gold}</span>
              <span class="badge bg-primary ms-1">⚔️ ${poder}</span>
              ${statusAdversario}
            </div>
            <div class="mt-2">${slotHTML}</div>
            <button class="btn btn-sm btn-${estaCansado ? 'secondary' : 'danger'} mt-3 btn-batalhar" 
                    data-id="${a.idSeguro}" ${estaCansado ? 'disabled' : ''}>
              ${estaCansado ? 'Cansado' : 'BATALHAR'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Ativa tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(el => new bootstrap.Tooltip(el, { html: true }));

    // logs de batalha
    document.getElementById('btnLogs')?.addEventListener('click', async () => {
      await carregarLogsBatalha();
      const modal = new bootstrap.Modal(document.getElementById('modalLogs'));
      modal.show();
    });

    // Evento de batalha
    document.querySelectorAll('.btn-batalhar').forEach(btn => {
      btn.addEventListener('click', () => {
        const alvoId = btn.dataset.id;
        iniciarBatalha(alvoId);
      });
    });

  } catch (err) {
    console.error('Erro na Arena:', err);
    document.getElementById('listaAlunosArena').innerHTML = 
      `<div class="col-12 text-center text-danger py-5">❌ ${err.message}</div>`;
  }
}

// Inicia batalha (tudo no backend)
// Inicia batalha (tudo no backend)
async function iniciarBatalha(alvoId) {
  try {
    const res = await fetch('/api/arena/batalha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ alvoId })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao iniciar batalha.');
    }

    const resultado = await res.json();

    // Mostra animação
    await mostrarAnimacaoBatalha(
      resultado.dadoAtacante,
      resultado.dadoAlvo,
      resultado.danoAtacante,
      resultado.danoAlvo
    );

    // Mostra resultado
    mostrarResultadoFinal(resultado);

    // ✅ Atualiza automaticamente status de cansaço e botões
    // (para refletir o novo estado “Cansado”)
    await atualizarArenaDepoisDaBatalha();

  } catch (err) {
    console.error('Erro na batalha:', err);
    showToast(`❌ ${err.message}`);
  }
}

// Atualiza a arena depois da batalha
// Atualiza arena após batalha (recarrega status e lista)
async function atualizarArenaDepoisDaBatalha() {
  try {
    // Recarrega meu status de cansaço
    const meuEstadoRes = await fetch('/api/arena/meu-estado', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const meuEstado = await meuEstadoRes.json();
    const statusTopo = document.getElementById('statusTopoArena');
    const agora = new Date();

    if (statusTopo) {
      if (meuEstado.cansadoAte && new Date(meuEstado.cansadoAte) > agora) {
        const fim = new Date(meuEstado.cansadoAte);
        statusTopo.innerHTML = `⚠️ Você está cansado até ${fim.toLocaleTimeString()}`;
        statusTopo.className = 'text-danger mb-3';
      } else {
        statusTopo.innerHTML = '✅ Pronto para batalhar!';
        statusTopo.className = 'text-success mb-3';
      }
    }

    // Recarrega a lista de adversários
    const res = await fetch('/api/arena/alunos', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const adversarios = await res.json();

    const container = document.getElementById('listaAlunosArena');
    if (!container) return;

    const agora2 = new Date();
    container.innerHTML = adversarios.map(a => {
      const poder = Object.values(a.equipamentos).reduce((s, i) => s + (i?.power || 0), 0);
      const estaCansado = a.cansadoAte && new Date(a.cansadoAte) > agora2;
      const statusAdversario = estaCansado
        ? '<span class="badge bg-warning text-dark">Cansado</span>'
        : '<span class="badge bg-success">Disponível</span>';
      const slots = ['cabeca', 'camisa', 'calca', 'pes', 'artefato'];
      const slotHTML = slots.map(slot => {
        const item = a.equipamentos[slot];
        return item
          ? `<img src="${item.icone}" width="32" height="32" class="mx-1 rounded" title="${item.nome || 'Item'} (+${item.power || 0})">`
          : `<div class="d-inline-block mx-1" style="width:32px;height:32px;background:#eee;border-radius:4px;"></div>`;
      }).join('');
      return `
        <div class="col-md-4">
          <div class="card p-3 text-center shadow-sm">
            <img src="${a.pic}" class="rounded-circle mx-auto mb-2" width="60" height="60" style="object-fit: cover;">
            <h6 class="mb-1">${a.nome}</h6>
            <small class="text-muted">${a.ctr}</small>
            <div class="mt-2">
              <span class="badge bg-warning text-dark">🪙 ${a.gold}</span>
              <span class="badge bg-primary ms-1">⚔️ ${poder}</span>
              ${statusAdversario}
            </div>
            <div class="mt-2">${slotHTML}</div>
            <button class="btn btn-sm btn-${estaCansado ? 'secondary' : 'danger'} mt-3 btn-batalhar" 
                    data-id="${a.idSeguro}" ${estaCansado ? 'disabled' : ''}>
              ${estaCansado ? 'Cansado' : 'BATALHAR'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Reativa eventos
    document.querySelectorAll('.btn-batalhar').forEach(btn => {
      btn.addEventListener('click', () => iniciarBatalha(btn.dataset.id));
    });

  } catch (err) {
    console.error('Erro ao atualizar arena:', err);
  }
}


// Animação da batalha
async function mostrarAnimacaoBatalha(d1, d2, dmg1, dmg2) {
  const modalEl = document.getElementById('modalBatalha');
  const arena = document.getElementById('arenaAnimation');
  arena.innerHTML = `
    <div id="jogador1" class="position-absolute start-0 bottom-0 fs-1">🧑‍🎓</div>
    <div id="jogador2" class="position-absolute end-0 bottom-0 fs-1">🧑‍🎓</div>
    <div id="dados" class="position-absolute top-50 start-50 translate-middle text-center">
      <div class="fs-2">🎲</div>
    </div>
  `;

  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  return new Promise(resolve => {
    setTimeout(() => {
      document.getElementById('jogador1').style.transform = 'translateX(80px)';
      document.getElementById('jogador2').style.transform = 'translateX(-80px)';
      const dadoEl = document.getElementById('dados');
      dadoEl.innerHTML = `<div class="fs-3">${d1} vs ${d2}</div>`;
      setTimeout(() => {
        dadoEl.innerHTML = `<div class="fs-1 text-danger">💥</div>`;
        setTimeout(resolve, 600);
      }, 800);
    }, 300);
  });
}

// Mostra resultado final
function mostrarResultadoFinal(resultado) {
  const modalEl = document.getElementById('modalBatalha');
  const el = document.getElementById('resultadoBatalha');

  if (resultado.empate) {
    el.textContent = 'EMPATE!';
    el.className = 'text-warning fw-bold fs-4';
  } else if (resultado.vencedor == meuId) {
    el.innerHTML = `VOCÊ VENCEU!<br>+${resultado.goldTransferido} 🪙`;
    el.className = 'text-success fw-bold fs-4';
  } else {
    el.innerHTML = `VOCÊ PERDEU!<br>-${resultado.goldTransferido} 🪙`;
    el.className = 'text-danger fw-bold fs-4';
  }

  // Ao fechar, recarrega a página
  const fecharBtn = modalEl.querySelector('.btn-primary');
  fecharBtn.onclick = () => {
    window.location.reload();
  };

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}


document.getElementById('btnPVP').addEventListener('click', togglePVP);

// Alterna o modo PVP do aluno logado
async function togglePVP() {
  try {
    const res = await fetch('/api/arena/toggle-pvp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao alternar PVP.');
    }

    const data = await res.json();
    const btn = document.getElementById('btnPVP');
    const status = document.getElementById('pvpStatus');

    if (data.pvpAtivado) {
      btn.classList.remove('bg-secondary');
      btn.classList.add('bg-dark', 'text-white');
      status.textContent = 'PVP ON';
      showToast('⚔️ PVP ativado!');
    } else {
      btn.classList.remove('bg-dark', 'text-white');
      btn.classList.add('bg-secondary');
      status.textContent = 'PVP OFF';
      showToast('🕊️ PVP desativado.');
    }
  } catch (err) {
    console.error('Erro ao alternar PVP:', err);
    showToast(`❌ ${err.message}`);
  }
}



// Carrega status do PVP do aluno logado
async function carregarStatusPVP() {
  const res = await fetch('/api/arena/meu-status', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  const status = await res.json();
  atualizarBotaoPVP(status.pvpAtivado);
}

function atualizarBotaoPVP(ativo) {
  const btn = document.getElementById('btnPVP');
  const span = document.getElementById('pvpStatus');
  if (ativo) {
    btn.className = 'btn btn-sm rounded-pill btn-success';
    span.textContent = 'PVP ON';
  } else {
    btn.className = 'btn btn-sm rounded-pill btn-secondary';
    span.textContent = 'PVP OFF';
  }
}

// Carrega e exibe logs de batalha
async function carregarLogsBatalha() {
  try {
    const res = await fetch('/api/arena/logs', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!res.ok) {
      throw new Error('Erro ao carregar logs de batalha.');
    }

    const logs = await res.json();
    const lista = document.getElementById('listaLogs');

    if (!logs || logs.length === 0) {
      lista.innerHTML = '<div class="text-center text-muted py-3">Nenhuma batalha registrada.</div>';
      return;
    }

    // Monta HTML
    lista.innerHTML = logs.map(log => `
      <div class="border rounded p-2 mb-2">
        <div class="fw-bold">${log.data}</div>
        <div>
          <span class="text-primary">${log.atacante}</span> 
          (<small>⚔️ ${log.atacantePoder} | 🎲 ${log.atacanteDado} | 💥 ${log.atacanteDano}</small>)
          <br>
          <span class="text-danger">${log.defensor}</span>
          (<small>⚔️ ${log.defensorPoder} | 🎲 ${log.defensorDado} | 💥 ${log.defensorDano}</small>)
        </div>
        <div class="mt-1">
          <b>Resultado:</b> ${log.resultado}<br>
          <b>Vencedor:</b> ${log.vencedor}<br>
          <b>Gold:</b> ${log.gold} 🪙
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Erro ao carregar logs de batalha:', err);
    document.getElementById('listaLogs').innerHTML =
      '<div class="text-danger text-center">Erro ao carregar logs de batalha.</div>';
  }
}

