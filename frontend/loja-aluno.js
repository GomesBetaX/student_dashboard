// loja-aluno.js
function setupLojaAluno() {
    carregarSaldo();
    carregarItensLoja();
}

async function carregarSaldo() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/student/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const profile = await res.json();
        console.log('Perfil do aluno:', profile);
        document.getElementById('saldoGold').textContent = profile.gold || 0;
    } catch (err) {
        console.error('Erro ao carregar saldo:', err);
        document.getElementById('saldoGold').textContent = '0';
    }
}

async function carregarItensLoja() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/itens', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const itens = await res.json();
        const container = document.getElementById('itensLoja');
        container.innerHTML = itens.map(item => {
            const preco = item.preco; // ✅ vem do backend
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

async function comprarItem(e) {
    const itemId = e.target.dataset.id;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/comprar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ itemId })
        });

        if (res.ok) {
            showToast('Item comprado! Verifique sua mochila.');
            carregarSaldo();
            carregarItensLoja();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast('Erro: ' + (err.error || 'Falha na compra.'));
        }
    } catch (err) {
        console.error('Erro na compra:', err);
        showToast('Erro de conexão ao comprar item.');
    }
}