async function abrirAba(nome, elemento) {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    elemento.classList.add('active');
    const conteudo = document.getElementById('conteudo-principal');
    if (nome === 'turmas') {
        conteudo.innerHTML = `
            <h2>Minhas Turmas</h2>
            <div id="box-disciplinas" style="background:white; padding:20px; border-radius:10px; margin-bottom:30px;">
                <h3 style="margin-bottom:15px; color:#333;">Minhas Disciplinas</h3>
                <div id="lista-disciplinas" style="display:flex; flex-wrap:wrap; gap:10px;"></div>
            </div>
            <div id="lista-turmas" class="card-grid"></div>
        `;
        await carregarDisciplinas();
        await carregarTurmas();
    }
}

async function carregarDisciplinas() {
    const token = localStorage.getItem('token');
    const lista = document.getElementById('lista-disciplinas');
    const res = await fetch('/professor/disciplinas', { headers: { 'Authorization': `Bearer ${token}` } });
    const disciplinas = await res.json();
    lista.innerHTML = disciplinas.map(d => `<span style="background:#E8F5E9; color:#2E7D32; padding:8px 15px; border-radius:20px; font-weight:600;">${d.nome}</span>`).join('');
}

async function carregarTurmas() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('lista-turmas');
    const res = await fetch('/professor/turmas', { headers: { 'Authorization': `Bearer ${token}` } });
    const turmas = await res.json();
    container.innerHTML = turmas.map(t => `
        <div class="card">
            <h3>${t.nome}</h3>
            <p>Ano: ${t.ano_letivo}</p>
            <button onclick="abrirTurma(${t.id}, '${t.nome}')" style="background:#007bff; color:white; border:none; padding:8px; border-radius:4px;">Lançar Notas</button>
        </div>
    `).join('');
}

async function abrirTurma(turmaId, turmaNome) {
    const token = localStorage.getItem('token');
    const modalHTML = `
        <div class="modal-overlay" id="modal-notas">
            <div class="modal-content">
                <h3>Lançar Notas - ${turmaNome}</h3>
                <table style="width:100%; border-collapse: collapse;">
                    <thead><tr style="background:#f4f6f9;"><th>Aluno</th><th>B1</th><th>B2</th><th>B3</th><th>B4</th><th>Salvar</th></tr></thead>
                    <tbody id="tabela-alunos"></tbody>
                </table>
                <button onclick="fecharModalNotas()" style="margin-top:20px; background:#ccc; color:black;">Fechar</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const res = await fetch(`/professor/turmas/${turmaId}/alunos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const tabela = document.getElementById('tabela-alunos');
    tabela.innerHTML = data.alunos.map(a => `
        <tr>
            <td>${a.nome}</td>
            <td><input type="number" id="n1-${a.id}" value="${a.nota_b1}" style="width:60px;"></td>
            <td><input type="number" id="n2-${a.id}" value="${a.nota_b2}" style="width:60px;"></td>
            <td><input type="number" id="n3-${a.id}" value="${a.nota_b3}" style="width:60px;"></td>
            <td><input type="number" id="n4-${a.id}" value="${a.nota_b4}" style="width:60px;"></td>
            <td><button onclick="salvarNota(${turmaId}, ${a.id})">Salvar</button></td>
        </tr>
    `).join('');
}

function fecharModalNotas() {
    const modal = document.getElementById('modal-notas');
    if (modal) modal.remove();
}

async function salvarNota(turmaId, alunoId) {
    const token = localStorage.getItem('token');
    const notas = [1, 2, 3, 4].map(b => ({ bimestre: b, nota: document.getElementById(`n${b}-${alunoId}`).value }));
    for (const n of notas) {
        if (n.nota !== '') {
            await fetch('/professor/notas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ turma_id: turmaId, aluno_id: alunoId, bimestre: n.bimestre, nota: n.nota })
            });
        }
    }
    alert('Notas salvas!');
}