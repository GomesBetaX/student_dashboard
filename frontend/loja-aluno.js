// loja-aluno.js

// 🔗 Detecta ambiente automaticamente
/** const API_BASE = window.location.origin.includes('localhost')
  ? 'http://localhost:3000'
  : 'https://student-dashboard-t5y0.onrender.com';
**/

// 🚀 Inicializa loja
function setupLojaAluno() {
  carregarSaldo();
  carregarItensLoja();
}

// 💰 Carrega o saldo de gold do aluno
async function carregarSaldo() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/api/student/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Falha ao carregar perfil.');
    const profile = await res.json();
    console.log('Perfil do aluno:', profile);

    document.getElementById('saldoGold').textContent = profile.gold || 0;
  } catch (err) {
    console.error('Erro ao carregar saldo:', err);
    document.getElementById('saldoGold').textContent = '0';
  }
}

// 🏪 Carrega todos os itens disponíveis na loja
async function carregarItensLoja() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/api/itens`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Erro ao buscar itens da loja.');

    const itens = await res.json();
    const container = document.getElementById('itensLoja');

    if (!Array.isArray(itens) || itens.length === 0) {
      container.innerHTML = '<div class="col-12 text-center text-muted">Nenhum item disponível.</div>';
      return;
    }

    container.innerHTML = itens.map(item => {
      const preco = item.preco;
      return `
        <div class="col-md-4">
          <div class="card p-3 text-center shadow-sm">
            <img src="${item.icone}" width="60" class="mx-auto mb-2" style="object-fit: contain;">
            <h6>${item.nome}</h6>
            <p class="small text-muted">${item.descricao}</p>
            <div class="small text-muted">${item.efeito}</div>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <span class="badge bg-primary">Power: ${item.power}</span>
              <span class="badge bg-success">💰 ${preco}</span>
            </div>
            <button class="btn btn-sm btn-outline-primary mt-2 btn-comprar"
                    data-id="${item.id}" data-preco="${preco}">
              Comprar
            </button>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-comprar').forEach(btn => {
      btn.addEventListener('click', comprarItem);
    });

  } catch (err) {
    console.error('Erro ao carregar itens da loja:', err);
    document.getElementById('itensLoja').innerHTML =
      '<div class="col-12 text-center text-danger">Erro ao carregar itens.</div>';
  }
}

// 🛒 Compra um item da loja
async function comprarItem(e) {
  const itemId = e.target.dataset.id;
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_BASE}/api/comprar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ itemId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Erro na compra:', err);
      showToast('❌ ' + (err.message || err.error || 'Falha na compra.'));
      return;
    }

    const data = await res.json();
    console.log('✅ Compra efetuada:', data);
    showToast(`🎉 ${data.message || 'Item comprado com sucesso!'}`);

    carregarSaldo();
    carregarItensLoja();

  } catch (err) {
    console.error('Erro de conexão ao comprar item:', err);
    showToast('⚠️ Erro de conexão com o servidor.');
  }
}
