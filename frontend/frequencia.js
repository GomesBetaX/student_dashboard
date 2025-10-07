function setupFrequencia() {
  // Variáveis globais para armazenar os resultados
  window.totalAlunosAtivos = 0;
  window.totalTurmasAtivas = 0;
  window.alunosFrequentes = 0;
  window.porcentagemFrequencia = 0;
  
  // Verifica autenticação
  const token = localStorage.getItem('token');
  const account = JSON.parse(localStorage.getItem('account'));
  if (!token || !account || !['professor', 'admin'].includes(account.role)) {
    window.location.href = 'index.html';
    return;
  }

  // Elementos
  const totalAlunosEl = document.getElementById('totalAlunos');
  const totalTurmasEl = document.getElementById('totalTurmas');
  const alunosFrequentesEl = document.getElementById('alunosFrequentes');
  const porcentagemFrequenciaEl = document.getElementById('porcentagemFrequencia');
  const barraFrequenciaEl = document.getElementById('barraFrequencia');
  const mensagemCarregamentoEl = document.getElementById('mensagemCarregamento');
  const historicoFrequenciasEl = document.getElementById('historicoFrequencias');
  const btnFecharMes = document.getElementById('btnFecharMes');
  
  // Função para obter o mês de frequência atual considerando a regra de dia 11
  function getMesFrequenciaAtual() {
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
  
  // Função para renderizar o gráfico de frequência
  function renderizarGrafico() {
    const ctx = document.getElementById('graficoFrequencia');
    if (!ctx) return;
    
    // Garante que o texto central do gráfico está atualizado
    if (porcentagemFrequenciaEl) {
      porcentagemFrequenciaEl.textContent = `${window.porcentagemFrequencia}%`;
    }
    
    const chartCtx = ctx.getContext('2d');
    
    // Remove gráfico existente se houver
    if (window.frequenciaChart) {
      window.frequenciaChart.destroy();
    }
    
    // Usa os valores já calculados nas variáveis globais
    const frequente = window.porcentagemFrequencia;
    const infrequente = 100 - frequente;
    
    window.frequenciaChart = new Chart(chartCtx, {
      type: 'doughnut',
       data: {
        datasets: [{
          data: [frequente, infrequente],
          backgroundColor: [
            '#4caf50',
            '#f44336'
          ],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '70%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
    document.getElementById('pF').textContent = `${window.porcentagemFrequencia}%`;
    document.getElementById('alunosF').textContent = `${window.alunosFrequentes}`;
    document.getElementById('alunosInfrequentesCount').textContent = `${window.totalAlunosAtivos - window.alunosFrequentes}`;  
  }
  
  // Função para gerar as aulas de um mês
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
  
  // Função para calcular a frequência de um aluno
  function calcularFrequenciaAluno(aluno, turma) {
    const hoje = new Date();
    const { mes, ano } = getMesFrequenciaAtual();
    
    const aulas = gerarAulasMes(turma, mes, ano);
    
    // Filtra as aulas ativas (não desativadas)
    const aulasAtivas = aulas.filter(aula => {
      const dataStr = aula.toISOString().split('T')[0];
      return !(turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr));
    });
    
    // Número mínimo de aulas para ser frequente: metade do total arredondado para baixo + 1
    const minAulas = Math.floor(aulasAtivas.length / 2) + 1;
    
    // Conta as presenças
    let presencas = 0;
    aulasAtivas.forEach(aula => {
      const dataStr = aula.toISOString().split('T')[0];
      const presente = aluno.presencas?.[turma.nome]?.[dataStr] !== false;
      if (presente) presencas++;
    });
    
    // Conta as reposições
    const reposicoes = aluno.reposicoes?.[turma.nome] || 0;
    const totalPresencas = presencas + reposicoes;
    
    return {
      totalAulas: aulasAtivas.length,
      minAulas,
      presencas,
      reposicoes,
      totalPresencas,
      frequente: totalPresencas >= minAulas
    };
  }
  
  // Função para calcular a frequência do mês
  function calcularFrequenciaMes(turmas, alunos) {
    let alunosFrequentes = 0;
    let totalAlunos = 0;
    
    // Filtra turmas ativas (não finalizadas)
    const turmasAtivas = turmas.filter(turma => !turma.finalizada);
    
    // Filtra alunos ativos (não trancados/cancelados/evadidos)
    const alunosAtivos = alunos.filter(aluno => 
      aluno.status !== 'trancado' && 
      aluno.status !== 'CANCELADO' &&
      aluno.status !== 'finalizado'
    );
    console.log('Alunos ativos para cálculo de frequência:', alunosAtivos.length);
    
    // Para cada turma ativa
    turmasAtivas.forEach(turma => {
      // Para cada aluno da turma
      turma.alunos.forEach(ctr => {
        const aluno = alunosAtivos.find(a => a.ctr === ctr);
        if (!aluno) return;
        
        if (aluno.status === 'EVA') return; // Ignora alunos evadidos

        // Calcula a frequência do aluno
        const freq = calcularFrequenciaAluno(aluno, turma);
        
        // Atualiza contadores
        totalAlunos++;
        if (freq.frequente) {
          console.log(`Aluno ${aluno.nome} (CTR: ${aluno.ctr}) é frequente na turma ${turma.nome} de status ${aluno.status}.`);
          alunosFrequentes++;
        }
      });
    });
    
    // Calcula porcentagem (alunos frequentes / total alunos) * 100
    const porcentagem = alunosAtivos.length > 0 ? Math.round((alunosFrequentes / alunosAtivos.length) * 100) : 0;
    
    console.log('Total alunos:', alunosAtivos.length);
    console.log('Alunos frequentes:', alunosFrequentes);
    //console.log('Porcentagem:', porcentagem);

    return {
      totalAlunos,
      alunosFrequentes,
      porcentagem
    };
  }
  
  // Nova função para registrar a frequência do mês anterior
  function registrarFrequenciaMesAnterior() {
    const hoje = new Date();
    const dia = hoje.getDate();
    if (dia !== 10) {
      //console.log('Hoje não é dia 10. O registro de frequência não será feito.');
      return;
    }
    
    // Calcula a frequência para o mês anterior
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mes = mesAnterior.getMonth();
    const ano = mesAnterior.getFullYear();
    const mesAno = `${String(mes + 1).padStart(2, '0')}/${ano}`;
    
    // Busca os dados mais recentes para o cálculo
    Promise.all([
      fetch('/api/turmas', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json()),
      fetch('/api/alunos', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json())
    ]).then(([turmas, alunos]) => {
      // Usa a função de cálculo para o mês anterior
      let alunosFrequentes = 0;
      const turmasAtivas = turmas.filter(turma => !turma.finalizada);
      const alunosAtivos = alunos.filter(aluno => 
        aluno.status !== 'trancado' && 
        aluno.status !== 'CANCELADO' &&
        aluno.status !== 'finalizado'

      );
      
      turmasAtivas.forEach(turma => {
        turma.alunos.forEach(ctr => {
          const aluno = alunosAtivos.find(a => a.ctr === ctr);
          if (!aluno) return;
          
          const aulas = gerarAulasMes(turma, mes, ano);
          const aulasAtivas = aulas.filter(aula => {
            const dataStr = aula.toISOString().split('T')[0];
            return !(turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr));
          });
          const minAulas = Math.floor(aulasAtivas.length / 2) + 1;
          
          let presencas = 0;
          aulasAtivas.forEach(aula => {
            const dataStr = aula.toISOString().split('T')[0];
            const presente = aluno.presencas?.[turma.nome]?.[dataStr] !== false;
            if (presente) presencas++;
          });
          const reposicoes = aluno.reposicoes?.[turma.nome] || 0;
          const totalPresencas = presencas + reposicoes;
          
          if (totalPresencas >= minAulas) {
            alunosFrequentes++;
          }
        });
      });
      
      const porcentagemMesAnterior = alunosAtivos.length > 0 ? Math.round((alunosFrequentes / alunosAtivos.length) * 100) : 0;
      
      //console.log('Registrando frequência do mês anterior:', mesAno, porcentagemMesAnterior, '%');
      
      // Envia para o backend para registrar no banco de dados
      fetch('/api/frequencia/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mesAno,
          porcentagem: porcentagemMesAnterior,
          userId: account.id
        })
      }).then(res => {
        if (res.ok) {
          //console.log('Frequência do mês anterior registrada com sucesso!');
        } else {
          //console.error('Erro ao registrar frequência do mês anterior.');
        }
      }).catch(err => {
        //console.error('Erro de rede ao registrar frequência:', err);
      });
    }).catch(err => {
      //onsole.error('Erro ao carregar dados para registrar frequência:', err);
    });
  }

  // Nova função para fechar o mês manualmente
  window.fecharMesManualmente = function() {
    const hoje = new Date();
    const { mes, ano } = getMesFrequenciaAtual();
    const mesAno = `${String(mes + 1).padStart(2, '0')}/${ano}`;
    
    // Busca os dados mais recentes para o cálculo
    Promise.all([
      fetch('api/turmas', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json()),
      fetch('/api/alunos', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json())
    ]).then(([turmas, alunos]) => {
      // Usa a função de cálculo para o mês atual (que está sendo fechado)
      let alunosFrequentes = 0;
      const turmasAtivas = turmas.filter(turma => !turma.finalizada);
      const alunosAtivos = alunos.filter(aluno => 
        aluno.status !== 'trancado' && 
        aluno.status !== 'CANCELADO' &&
        aluno.status !== 'finalizado'
      );
      
      turmasAtivas.forEach(turma => {
        turma.alunos.forEach(ctr => {
          const aluno = alunosAtivos.find(a => a.ctr === ctr);
          if (!aluno) return;
          
          const aulas = gerarAulasMes(turma, mes, ano);
          const aulasAtivas = aulas.filter(aula => {
            const dataStr = aula.toISOString().split('T')[0];
            return !(turma.aulasDesativadas && turma.aulasDesativadas.includes(dataStr));
          });
          const minAulas = Math.floor(aulasAtivas.length / 2) + 1;
          
          let presencas = 0;
          aulasAtivas.forEach(aula => {
            const dataStr = aula.toISOString().split('T')[0];
            const presente = aluno.presencas?.[turma.nome]?.[dataStr] !== false;
            if (presente) presencas++;
          });
          const reposicoes = aluno.reposicoes?.[turma.nome] || 0;
          const totalPresencas = presencas + reposicoes;
          
          if (totalPresencas >= minAulas) {
            alunosFrequentes++;
          }
        });
      });
      
      const porcentagemMes = alunosAtivos.length > 0 ? Math.round((alunosFrequentes / alunosAtivos.length) * 100) : 0;
      
      //console.log('Fechando mês manualmente:', mesAno, porcentagemMes, '%');
      
      // Envia para o backend para registrar no banco de dados
      fetch('/api/frequencia/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mesAno,
          porcentagem: porcentagemMes,
          userId: account.id
        })
      }).then(res => {
        if (res.ok) {
          //console.log('Frequência do mês registrado com sucesso!');
          showToast('Mês fechado com sucesso! Frequência registrada no histórico.');
          
          // Forçar atualização do histórico
          carregarHistorico();
          
          // Forçar atualização dos dados para refletir a mudança
          atualizarDados();
        } else {
          console.error('Erro ao registrar frequência do mês.');
          showToast('Erro ao registrar frequência. Tente novamente.');
        }
      }).catch(err => {
        console.error('Erro de rede ao registrar frequência:', err);
        showToast('Erro de rede ao registrar frequência.');
      });
    }).catch(err => {
      console.error('Erro ao carregar dados para registrar frequência:', err);
      showToast('Erro ao carregar dados para registro.');
    });
  }

  // Nova função para carregar e exibir o histórico de frequências
  function carregarHistorico() {
    fetch('/api/frequencia/historico', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (!res.ok) {
        throw new Error('Erro ao carregar histórico de frequências');
      }
      return res.json();
    }).then(historico => {
      if (historicoFrequenciasEl) {
        if (historico.length === 0) {
          historicoFrequenciasEl.innerHTML = `<div class="text-center text-muted py-3">Nenhuma frequência registrada anteriormente.</div>`;
        } else {
          historicoFrequenciasEl.innerHTML = ''; // Limpa o conteúdo
          historico.forEach(item => {
            const itemHtml = `
              <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                <span class="text-muted">${item.mesAno}</span>
                <span class="fw-bold fs-5">${item.porcentagem}%</span>
              </div>
            `;
            historicoFrequenciasEl.innerHTML += itemHtml;
          });
        }
      }
    }).catch(err => {
      console.error('Erro ao carregar histórico:', err);
      if (historicoFrequenciasEl) {
        historicoFrequenciasEl.innerHTML = `<div class="alert alert-danger">Erro ao carregar histórico.</div>`;
      }
    });
  }
  
  // Função para atualizar os dados
  function atualizarDados() {
    // Sempre busca os dados mais recentes do backend
    Promise.all([
      fetch('/api/turmas', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (!res.ok) throw new Error('Erro ao carregar turmas');
        return res.json();
      }),
      fetch('/api/alunos', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (!res.ok) throw new Error('Erro ao carregar alunos');
        return res.json();
      })
    ]).then(([turmas, alunos]) => {
      // Filtra turmas ativas (não finalizadas)
      const turmasAtivas = turmas.filter(turma => !turma.finalizada);
      
      // Filtra alunos ativos (não trancados/cancelados)
      const alunosAtivos = alunos.filter(aluno => 
        aluno.status !== 'trancado' && 
        aluno.status !== 'CANCELADO' &&
        aluno.status !== 'finalizado'
      );
      
      // Calcula a frequência do mês
      const resultadoFrequencia = calcularFrequenciaMes(turmas, alunos);
      
      // Atualiza as variáveis globais
      window.totalAlunosAtivos = alunosAtivos.length;
      window.totalTurmasAtivas = turmasAtivas.length;
      window.alunosFrequentes = resultadoFrequencia.alunosFrequentes;
      window.porcentagemFrequencia = resultadoFrequencia.porcentagem;
      
      // Atualiza os contadores
      if (totalAlunosEl) {
        totalAlunosEl.textContent = window.totalAlunosAtivos;
      }
      
      if (totalTurmasEl) {
        totalTurmasEl.textContent = window.totalTurmasAtivas;
      }
      
      if (alunosFrequentesEl) {
        alunosFrequentesEl.textContent = window.alunosFrequentes;
      }
      
      if (porcentagemFrequenciaEl) {
        porcentagemFrequenciaEl.textContent = `${window.porcentagemFrequencia}%`;
      }
      
      if (barraFrequenciaEl) {
        barraFrequenciaEl.style.width = `${window.porcentagemFrequencia}%`;
        //console.log('Largura da barra de frequência:', barraFrequenciaEl.style.width);
       // console.log('Porcentagem de frequência:', window.porcentagemFrequencia);
        //console.log('totalAlunosAtivos:', window.totalAlunosAtivos);
        //console.log('alunosFrequentes:', window.alunosFrequentes);
        barraFrequenciaEl.textContent = `${window.porcentagemFrequencia}%`;
      }
      
      // Garante que o texto central do gráfico está atualizado antes de renderizar
      if (porcentagemFrequenciaEl) {
        porcentagemFrequenciaEl.textContent = `${window.porcentagemFrequencia}%`;
      }
      
      // Verifica se o Chart.js está carregado
      if (typeof Chart === 'undefined') {
        // Carrega o Chart.js dinamicamente
        const chartScript = document.createElement('script');
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        chartScript.onload = () => {
          // Após carregar o Chart.js, renderiza o gráfico
          renderizarGrafico();
        };
        document.body.appendChild(chartScript);
      } else {
        // Chart.js já está carregado, renderiza o gráfico
        renderizarGrafico();
      }
      
      // Oculta mensagem de carregamento
      if (mensagemCarregamentoEl) {
        mensagemCarregamentoEl.style.display = 'none';
      }
    }).catch(err => {
      console.error('Erro ao carregar dados:', err);
      
      // Mostra mensagem de erro
      if (mensagemCarregamentoEl) {
        mensagemCarregamentoEl.innerHTML = `
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-circle me-2"></i>
            Erro ao carregar dados. Verifique sua conexão e tente novamente.
          </div>
        `;
      }
      
      // Define valores padrão em caso de erro
      if (totalAlunosEl) {
        totalAlunosEl.textContent = '0';
      }
      
      if (totalTurmasEl) {
        totalTurmasEl.textContent = '0';
      }
      
      if (alunosFrequentesEl) {
        alunosFrequentesEl.textContent = '0';
      }
      
      if (porcentagemFrequenciaEl) {
        porcentagemFrequenciaEl.textContent = '0%';
      }
      
      if (barraFrequenciaEl) {
        barraFrequenciaEl.style.width = '0%';
        barraFrequenciaEl.textContent = '0%';
      }
      
      // Tenta renderizar gráfico mesmo em caso de erro
      if (typeof Chart !== 'undefined') {
        // Garante que o texto central do gráfico está atualizado
        if (porcentagemFrequenciaEl) {
          porcentagemFrequenciaEl.textContent = '0%';
        }
        renderizarGrafico();
      }
    });
  }
  
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
  
  // Inicializa
  atualizarDados();
  registrarFrequenciaMesAnterior();
  carregarHistorico();
  
  // Adiciona evento ao botão de fechar mês
  if (btnFecharMes) {
    btnFecharMes.addEventListener('click', fecharMesManualmente);
  }
}