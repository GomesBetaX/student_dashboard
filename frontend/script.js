document.addEventListener('DOMContentLoaded', function() {
  console.log('Script carregado!');
  const form = document.getElementById('authForm');
  const messageEl = document.createElement('div');
  messageEl.className = 'mt-3 text-center';
  form.appendChild(messageEl);

  const toggleForm = document.getElementById('toggleForm');
  const formTitle = document.getElementById('formTitle');
  const buttonText = document.getElementById('buttonText');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const nameField = document.getElementById('nameField');
  const codeField = document.getElementById('codeField'); 

  let isRegister = false;

  toggleForm.addEventListener('click', (e) => {
    e.preventDefault();
    isRegister = !isRegister;

    if (isRegister) {
      formTitle.textContent = 'Criar conta';
      buttonText.textContent = 'Registrar';
      toggleForm.textContent = 'Já tem conta? Entrar';
      nameField.style.display = 'block';
      codeField.style.display = 'block';

      // ✅ Torna os campos obrigatórios no registro
      document.getElementById('name').required = true;
      document.getElementById('registerCode').required = true;

    } else {
      formTitle.textContent = 'Entrar';
      buttonText.textContent = 'Entrar';
      toggleForm.textContent = 'Criar uma nova conta';
      nameField.style.display = 'none';
      codeField.style.display = 'none';

      // ✅ Remove obrigatoriedade no login
      document.getElementById('name').required = false;
      document.getElementById('registerCode').required = false;
    }

    // Limpa o formulário e mensagens
    authForm.reset();
    messageEl.textContent = '';
    authForm.classList.remove('was-validated');
  });

  authForm.addEventListener('submit', function (event) {
    console.log('📤 Formulário submetido!'); // Deve aparecer
    event.preventDefault();

    if (!authForm.checkValidity()) {
      console.log('❌ Formulário inválido');
      event.stopPropagation();
      authForm.classList.add('was-validated');
    } else {
      console.log('✅ Formulário válido — chamando handleSubmit()');
      handleSubmit();
    }
  }, false);

  async function handleSubmit() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    let userData = { username, password };
    if (isRegister) {
      const name = document.getElementById('name').value;
      const registerCode = document.getElementById('registerCode').value;
      if (!name || !registerCode) {
        showError('Nome completo é obrigatório');
        return;
      }
      userData.name = name;
      userData.registerCode = registerCode;
    }

    loadingSpinner.classList.remove('d-none');
    buttonText.textContent = isRegister ? 'Registrando...' : 'Entrando...';

    try {
      const res = await fetch(
        `http://localhost:3000/api/auth/${isRegister ? 'register' : 'login'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        }
      );

      const data = await res.json();

      if (res.ok) {
          messageEl.className = 'mt-3 text-center text-success fw-medium';
          messageEl.textContent = data.message;
          if (!isRegister) { // Bloco de LOGIN [22]
              localStorage.setItem('token', data.token); [22]
              localStorage.setItem('account', JSON.stringify(data.account)); [22]
              messageEl.textContent = 'Redirecionando...';
              setTimeout(() => {
                  // **NOVO**: Redirecionar com base na role do usuário
                  if (data.account.role === 'student') {
                      window.location.href = 'aluno-dashboard.html'; // Redireciona para o dashboard do aluno
                  } else {
                      window.location.href = 'dashboard.html'; // Redireciona para o dashboard padrão (professor/admin)
                  }
              }, 1000);
          } else { // Bloco de REGISTRO (para professor/admin que se auto-registra) [22]
              messageEl.textContent = 'Registro bem-sucedido! Redirecionando...';
              setTimeout(() => {
                  window.location.href = 'dashboard.html'; // Admins/professores vão para o dashboard principal
              }, 1000);
          }
      } else {
        showError(data.message || 'Erro');
      }
    } catch (err) {
      showError('Erro de conexão. Verifique sua internet.');
    } finally {
      loadingSpinner.classList.add('d-none');
      buttonText.textContent = isRegister ? 'Registrar' : 'Entrar';
    }
  }

  function showError(message) {
    messageEl.className = 'mt-3 text-center text-danger fw-medium';
    messageEl.textContent = message;
  }
});