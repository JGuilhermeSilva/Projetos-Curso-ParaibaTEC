//Variável global para guardar o token
let token = null;

// Função de Login
async function fazerLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const erro = document.getElementById('login-erro');

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (!response.ok) {
            erro.textContent = data.message;
        } else {
            token = data.token;
            document.getElementById('user-nome').textContent = data.nome;

            // Esconde o login e mostra o painel
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('painel-screen').style.display = 'flex';

            // Chama a função para listar os usuários automaticamente
            listarUsuarios();
        }
    } catch (err) {
        erro.textContent = 'Erro de conexão com o servidor.';
    }
}

// Mostrar formulário de cadastro
function mostrarCadastro() {
    document.getElementById('form-cadastro').style.display = 'block';
}

// Função para Cadastrar
async function cadastrarUsuario() {
    const nome = document.getElementById('cad-nome').value;
    const email = document.getElementById('cad-email').value;
    const senha = document.getElementById('cad-senha').value;
    const papel = document.getElementById('cad-papel').value;

    if (!token) return alert('Faça login novamente!');

    try {
        const response = await fetch('/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nome, email, senha, papel })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Cadastro realizado com sucesso!');
            // Limpar campos e atualizar lista
            document.getElementById('cad-nome').value = '';
            document.getElementById('cad-email').value = '';
            document.getElementById('cad-senha').value = '';
            listarUsuarios();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Erro ao cadastrar.');
    }
}

// Função para listar Usuários
async function listarUsuarios() {
    if (!token) return;
    const lista = document.getElementById('lista');
    lista.innerHTML = '<li>Carregando...</li>';

    try {
        const response = await fetch('/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const users = await response.json();

        lista.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span><strong>${user.nome}</strong> (${user.email}) - ${user.papel}</span>
                <button onclick="deletarUsuario(${user.id})" style="background:red; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Excluir</button>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        lista.innerHTML = '<li>Erro ao carregar usuários.</li>';
    }
}

// Função para deletar
async function deletarUsuario(id) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    const response = await fetch(`/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        listarUsuarios(); // Atualiza a lista
    } else {
        alert('Não foi possível excluir.');
    }
}

// Função de Logout
function sair() {
    token = null;
    document.getElementById('painel-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}