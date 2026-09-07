function abrirAba(nome, elemento) {
    document.querySelectorAll('.tab-content').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.getElementById('aba-' + nome).style.display = 'block';
    elemento.classList.add('active');
    if (nome === 'alunos') carregarAlunos();
    if (nome === 'professores') carregarProfessores();
    if (nome === 'turmas') carregarTurmas();
    if (nome === 'matriculas') carregarSelectTurmasMatricula();
}

async function carregarAlunos() {
    const token = localStorage.getItem('token');
    const lista = document.getElementById('lista-alunos');
    const res = await fetch('/api/diretor/alunos', { headers: { 'Authorization': `Bearer ${token}` } });
    const alunos = await res.json();
    lista.innerHTML = alunos.map(a => `<li>${a.nome} - ${a.matricula || 'Sem matrícula'} <button onclick="excluirUsuario(${a.id})">Excluir</button></li>`).join('');
}

async function carregarProfessores() {
    const token = localStorage.getItem('token');
    const lista = document.getElementById('lista-professores');
    const res = await fetch('/api/diretor/professores', { headers: { 'Authorization': `Bearer ${token}` } });
    const profs = await res.json();
    lista.innerHTML = profs.map(p => `<li>${p.nome} - ${p.disciplinas.join(', ')} <button onclick="excluirUsuario(${p.id})">Excluir</button></li>`).join('');
}

async function carregarTurmas() {
    const token = localStorage.getItem('token');
    const lista = document.getElementById('lista-turmas');
    const res = await fetch('/api/turmas', { headers: { 'Authorization': `Bearer ${token}` } });
    const turmas = await res.json();
    lista.innerHTML = turmas.map(t => `<li>${t.nome} (${t.ano_letivo}) - Prof: ${t.professor_nome || 'Sem professor'} <button onclick="excluirTurma(${t.id})">Excluir</button></li>`).join('');
    const resProf = await fetch('/api/diretor/professores', { headers: { 'Authorization': `Bearer ${token}` } });
    const profs = await resProf.json();
    document.getElementById('turma-professor').innerHTML = profs.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
}

function mostrarFormTurma() {
    document.getElementById('form-turma').style.display = 'block';
}

async function criarTurma() {
    const token = localStorage.getItem('token');
    const nome = document.getElementById('turma-nome').value;
    const ano = document.getElementById('turma-ano').value;
    const professor_id = document.getElementById('turma-professor').value;
    const res = await fetch('/api/turmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome, ano_letivo: ano, professor_id })
    });
    if (res.ok) { alert('Turma criada!'); carregarTurmas(); } else alert('Erro');
}

async function excluirTurma(id) {
    if (!confirm('Excluir turma?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/turmas/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    carregarTurmas();
}

async function carregarSelectTurmasMatricula() {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/turmas', { headers: { 'Authorization': `Bearer ${token}` } });
    const turmas = await res.json();

    const container = document.getElementById('lista-turmas-matricula');
    container.innerHTML = '';

    if (turmas.length === 0) {
        container.innerHTML = '<p style="color:#999;">Nenhuma turma cadastrada. Crie uma na aba "Turmas".</p>';
        return;
    }

    turmas.forEach(turma => {
        const card = document.createElement('div');
        card.className = 'card-turma-matricula';
        card.id = `card-turma-${turma.id}`;
        card.onclick = () => selecionarTurmaMatricula(turma.id, turma);

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${turma.nome}</strong>
                <span style="font-size:12px; color:#999;">${turma.ano_letivo}</span>
            </div>
            <div style="font-size:12px; color:#666; margin-top:5px;">
                <i class="fas fa-chalkboard-teacher"></i> ${turma.professor_nome || 'Sem professor'}
            </div>
        `;
        container.appendChild(card);
    });
}

// Variável global para guardar a turma atual
let turmaAtualId = null;
let turmaAtualData = null;

async function selecionarTurmaMatricula(turmaId, turmaData) {
    turmaAtualId = turmaId;
    turmaAtualData = turmaData;

    // Atualiza visual dos cards
    document.querySelectorAll('.card-turma-matricula').forEach(c => c.classList.remove('active'));
    document.getElementById(`card-turma-${turmaId}`).classList.add('active');

    const token = localStorage.getItem('token');
    const painel = document.getElementById('painel-detalhes-turma');

    // Buscar alunos da turma
    const res = await fetch(`/api/turmas/${turmaId}/alunos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const alunosTurma = await res.json();

    // Buscar todos os usuários (para listar os não matriculados)
    const resUsers = await fetch('/users', { headers: { 'Authorization': `Bearer ${token}` } });
    const allUsers = await resUsers.json();
    const alunosDisponiveis = allUsers.filter(u => u.papel === 'aluno' && !alunosTurma.find(a => a.id === u.id));

    // Montar HTML do painel direito
    painel.innerHTML = `
        <div class="matricula-title">
            <i class="fas fa-layer-group"></i> ${turmaData.nome}
        </div>
        
        <div class="matricula-stats">
            <div class="stat-item">
                <strong>${turmaData.ano_letivo}</strong>
                <span>Ano</span>
            </div>
            <div class="stat-item">
                <strong>${alunosTurma.length}</strong>
                <span>Alunos</span>
            </div>
            <div class="stat-item">
                <strong>${turmaData.professor_nome ? 'Ativo' : 'Pendente'}</strong>
                <span>Professor</span>
            </div>
        </div>

        <div style="border-top: 2px solid #eee; margin-bottom:20px;"></div>

        <h4 style="margin-bottom:15px;"><i class="fas fa-user-plus"></i> Matricular Novo Aluno</h4>
        
        <div class="search-input">
            <i class="fas fa-search"></i>
            <input type="text" id="search-aluno" placeholder="Buscar por nome ou matrícula..." oninput="filtrarAlunosDisponiveis()">
        </div>

        <select id="select-aluno-adicionar" style="margin-bottom:10px;" size="4">
            ${alunosDisponiveis.map(a => `<option value="${a.id}">${a.nome} ${a.matricula ? ' - ' + a.matricula : ''}</option>`).join('')}
        </select>
        <button onclick="matricularAlunoSelecionado()" style="width:100%;" ${alunosDisponiveis.length === 0 ? 'disabled' : ''}>
            <i class="fas fa-check-circle"></i> Matricular Aluno
        </button>

        <div style="border-top: 2px solid #eee; margin:20px 0;"></div>

        <h4 style="margin-bottom:15px;"><i class="fas fa-list"></i> Alunos Matriculados</h4>
        <div id="lista-alunos-matriculados" style="max-height: 250px; overflow-y:auto;">
            ${alunosTurma.length === 0 ?
            '<p style="color:#999; font-size:13px;">Nenhum aluno matriculado.</p>' :
            alunosTurma.map(a => `
                    <div class="aluno-list-item">
                        <div class="aluno-info">
                            <div class="aluno-avatar">${a.nome.charAt(0)}</div>
                            <div>
                                <strong style="display:block;">${a.nome}</strong>
                                <span style="font-size:12px; color:#888;">${a.matricula || 'Sem matrícula'}</span>
                            </div>
                        </div>
                        <button class="btn-remover" onclick="removerAlunoDaTurma(${turmaId}, ${a.id})">
                            <i class="fas fa-trash"></i> Remover
                        </button>
                    </div>
                `).join('')
        }
        </div>
    `;
}

function filtrarAlunosDisponiveis() {
    const termo = document.getElementById('search-aluno').value.toLowerCase();
    const select = document.getElementById('select-aluno-adicionar');
    const options = select.querySelectorAll('option');

    options.forEach(opt => {
        opt.style.display = opt.textContent.toLowerCase().includes(termo) ? 'block' : 'none';
    });
}

async function matricularAlunoSelecionado() {
    const alunoId = document.getElementById('select-aluno-adicionar').value;
    if (!alunoId) return alert('Selecione um aluno da lista para matricular.');

    const token = localStorage.getItem('token');
    const res = await fetch(`/api/turmas/${turmaAtualId}/matricular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ aluno_id: alunoId })
    });

    if (res.ok) {
        alert('Aluno matriculado com sucesso!');
        selecionarTurmaMatricula(turmaAtualId, turmaAtualData); // Recarrega o painel
    } else {
        alert('Erro ao matricular aluno.');
    }
}

async function removerAlunoDaTurma(turmaId, alunoId) {
    if (!confirm('Tem certeza que deseja remover este aluno da turma? (Os dados dele serão mantidos no sistema)')) return;

    const token = localStorage.getItem('token');
    const res = await fetch(`/api/turmas/${turmaId}/matricular/${alunoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
        alert('Aluno removido da turma.');
        selecionarTurmaMatricula(turmaAtualId, turmaAtualData); // Recarrega o painel
    } else {
        alert('Erro ao remover aluno.');
    }
}

async function carregarAlunosTurma() {
    const token = localStorage.getItem('token');
    const turmaId = document.getElementById('select-turma-matricula').value;
    const res = await fetch(`/api/turmas/${turmaId}/alunos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const alunos = await res.json();
    const div = document.getElementById('dados-matricula');
    div.innerHTML = `
        <h3>Alunos na turma</h3>
        <ul>${alunos.map(a => `<li>${a.nome} <button onclick="removerAluno(${turmaId}, ${a.id})">Remover</button></li>`).join('')}</ul>
        <h3>Adicionar aluno (matricular)</h3>
        <select id="select-aluno-adicionar"></select>
        <button onclick="matricularAluno(${turmaId})">Matricular</button>
    `;
    const resAlunos = await fetch('/users', { headers: { 'Authorization': `Bearer ${token}` } });
    const allUsers = await resAlunos.json();
    const alunosNaoMatriculados = allUsers.filter(u => u.papel === 'aluno' && !alunos.find(a => a.id === u.id));
    const selectAdd = document.getElementById('select-aluno-adicionar');
    selectAdd.innerHTML = alunosNaoMatriculados.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
}

async function matricularAluno(turmaId) {
    const token = localStorage.getItem('token');
    const alunoId = document.getElementById('select-aluno-adicionar').value;
    if (!alunoId) return alert('Selecione um aluno');
    await fetch(`/api/turmas/${turmaId}/matricular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ aluno_id: alunoId })
    });
    carregarAlunosTurma();
}

async function removerAluno(turmaId, alunoId) {
    if (!confirm('Remover este aluno da turma? (dados dele serão mantidos)')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/turmas/${turmaId}/matricular/${alunoId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    carregarAlunosTurma();
}

// Mostrar/esconder formulário de aluno e disciplinas
function mostrarCampoDisciplina() {
    const papel = document.getElementById('cad-papel').value;
    document.getElementById('cad-disciplinas').style.display = papel === 'professor' ? 'block' : 'none';

    // Mostrar campo de senha apenas para Professor e Direção
    const campoSenha = document.getElementById('cad-senha');
    if (papel === 'professor' || papel === 'direcao') {
        campoSenha.style.display = 'block';
    } else {
        campoSenha.style.display = 'none';
        campoSenha.value = ''; // limpa se for aluno
    }

    // Mostrar ou esconder o formulário completo do aluno
    const formAluno = document.getElementById('form-aluno');
    if (papel === 'aluno') {
        formAluno.style.display = 'block';
    } else {
        formAluno.style.display = 'none';
    }
}

// Função de cadastro completa
async function cadastrarUsuario() {
    const token = localStorage.getItem('token');
    const papel = document.getElementById('cad-papel').value;
    const nome = document.getElementById('cad-nome').value;
    const email = document.getElementById('cad-email').value;
    const senha = document.getElementById('cad-senha').value; // Pega a senha digitada
    const disciplinasTexto = document.getElementById('cad-disciplinas').value;
    const disciplinas = disciplinasTexto.split(',').map(s => s.trim()).filter(Boolean);

    // Monta o objeto de dados
    const dados = { nome, email, papel, disciplinas, senha }; // Inclui senha

    // Se for aluno, pega os campos da ficha
    if (papel === 'aluno') {
        // (mantenha todos os campos do aluno como já estão)
        // ...
    }

    try {
        const res = await fetch('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(dados)
        });

        const data = await res.json();
        if (res.ok) {
            alert('Usuário cadastrado com sucesso!');
            // Limpa formulário
            // ...
        } else {
            alert(data.message || 'Erro ao cadastrar.');
        }
    } catch (err) {
        console.error(err);
        alert('Erro ao cadastrar usuário.');
    }
}


async function excluirUsuario(id) {
    if (!confirm('Excluir usuário?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
}