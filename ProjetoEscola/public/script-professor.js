const professorHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('topbar-name').textContent = localStorage.getItem('nome') || '';
    document.getElementById('topbar-date').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
    abrirAba('turmas', document.querySelector('.menu-item.active'));
});

async function abrirAba(nome, elemento) {
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    if (elemento) elemento.classList.add('active');
    if (nome === 'turmas') await renderizarInicio();
    if (nome === 'diarios') await renderizarDiario();
    if (nome === 'frequencia') await renderizarFrequencia();
    if (nome === 'notas') await renderizarNotas();
    if (nome === 'relatorios') await renderizarRelatorios();
}

async function buscarTurmasProfessor() {
    const res = await fetch('/professor/turmas', { headers: professorHeaders() });
    return res.ok ? res.json() : [];
}

function opcoesTurmas(turmas) { return turmas.map(turma => `<option value="${turma.id}">${turma.nome} · ${turma.ano_letivo}</option>`).join(''); }

function pageHeader(eyebrow, title, description, action = '') {
    return `<div class="page-header"><div><div class="breadcrumb">Início <span>/</span> <strong>${eyebrow}</strong></div><h2>${title}</h2><p>${description}</p></div>${action ? `<div class="page-actions">${action}</div>` : ''}</div>`;
}

async function renderizarInicio() {
    const [turmas, disciplinas] = await Promise.all([
        buscarTurmasProfessor(),
        fetch('/professor/disciplinas', { headers: professorHeaders() }).then(res => res.ok ? res.json() : [])
    ]);
    const totalAlunos = turmas.reduce((total, turma) => total + Number(turma.total_alunos || 0), 0);
    document.getElementById('conteudo-principal').innerHTML = `${pageHeader('Início', `Olá, ${localStorage.getItem('nome') || 'Professor'}!`, 'Bem-vindo ao seu espaço de trabalho.')}
        <div class="metric-grid"><div class="metric-card"><span class="label">Minhas turmas</span><strong class="value">${turmas.length}</strong><span class="trend"><i class="fas fa-layer-group"></i> turmas vinculadas</span></div><div class="metric-card"><span class="label">Alunos acompanhados</span><strong class="value">${totalAlunos || '—'}</strong><span class="trend"><i class="fas fa-user-graduate"></i> neste ano letivo</span></div><div class="metric-card"><span class="label">Disciplinas</span><strong class="value">${disciplinas.length}</strong><span class="trend"><i class="fas fa-book"></i> em andamento</span></div><div class="metric-card"><span class="label">Ano letivo</span><strong class="value">${new Date().getFullYear()}</strong><span class="trend"><i class="fas fa-calendar"></i> período atual</span></div></div>
        <div class="section-heading"><h3>Minhas turmas</h3><span class="muted">Acesso rápido ao diário e às notas</span></div>
        <div id="lista-turmas" class="card-grid">${turmas.length ? turmas.map(turmaCard).join('') : '<div class="empty-state">Nenhuma turma foi vinculada ao seu perfil.</div>'}</div>`;
}

function turmaCard(turma) {
    const nome = String(turma.nome).replace(/'/g, "\\'");
    return `<article class="card turma-card"><div class="card-icon"><i class="fas fa-users"></i></div><span class="status-badge">${turma.ano_letivo}</span><h3>${turma.nome}</h3><p>${turma.total_alunos || '—'} alunos matriculados</p><div class="card-actions"><button class="btn-secondary" onclick="abrirNotas(${turma.id}, '${nome}')">Notas <i class="fas fa-arrow-right"></i></button><button class="icon-action" title="Abrir diário" onclick="abrirDiarioTurma(${turma.id})"><i class="fas fa-book-open"></i></button></div></article>`;
}

function abrirDiarioTurma(turmaId) { renderizarDiario(turmaId); }
function abrirNotas(turmaId) { renderizarNotas(turmaId); }

async function renderizarDiario(turmaSelecionada) {
    const turmas = await buscarTurmasProfessor();
    const turmaId = turmaSelecionada || turmas[0]?.id;
    document.getElementById('conteudo-principal').innerHTML = pageHeader('Diário de Classe', 'Diário de classe', 'Registre os conteúdos e acompanhe as aulas ministradas.', '<button onclick="mostrarFormularioAula()"><i class="fas fa-plus"></i> Nova aula</button>') + `<div class="toolbar"><select id="diario-turma" onchange="carregarDiario(this.value)">${opcoesTurmas(turmas)}</select><span class="muted"><i class="fas fa-info-circle"></i> Apenas suas turmas são exibidas</span></div><div id="form-aula" class="card form-inline" style="display:none"><div><label>Data da aula</label><input id="diario-data" type="date"></div><div class="field-grow"><label>Conteúdo trabalhado</label><input id="diario-conteudo" placeholder="Ex.: Introdução à Biologia"></div><button onclick="salvarAula()">Salvar aula</button></div><div id="lista-diario"></div>`;
    if (turmaId) { document.getElementById('diario-turma').value = turmaId; carregarDiario(turmaId); }
}

function mostrarFormularioAula() { document.getElementById('form-aula').style.display = 'flex'; document.getElementById('diario-data').valueAsDate = new Date(); }

async function carregarDiario(turmaId) {
    const res = await fetch(`/professor/turmas/${turmaId}/diario`, { headers: professorHeaders() });
    const aulas = res.ok ? await res.json() : [];
    document.getElementById('lista-diario').innerHTML = aulas.length ? `<table class="data-table"><thead><tr><th>Data</th><th>Conteúdo</th><th>Registrado em</th><th>Ação</th></tr></thead><tbody>${aulas.map(aula => `<tr><td><strong>${new Date(`${aula.data_aula}T12:00:00`).toLocaleDateString('pt-BR')}</strong></td><td>${aula.conteudo}</td><td>${new Date(aula.created_at).toLocaleDateString('pt-BR')}</td><td><button class="btn-secondary" title="Visualizar"><i class="fas fa-eye"></i></button></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><i class="fas fa-book-open"></i><br>Nenhuma aula registrada para esta turma.</div>';
}

async function salvarAula() {
    const turmaId = document.getElementById('diario-turma').value;
    const res = await fetch(`/professor/turmas/${turmaId}/diario`, { method: 'POST', headers: { ...professorHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ data_aula: document.getElementById('diario-data').value, conteudo: document.getElementById('diario-conteudo').value }) });
    if (res.ok) { document.getElementById('form-aula').style.display = 'none'; document.getElementById('diario-conteudo').value = ''; carregarDiario(turmaId); } else alert((await res.json()).message);
}

async function renderizarFrequencia() {
    const turmas = await buscarTurmasProfessor();
    document.getElementById('conteudo-principal').innerHTML = pageHeader('Diário de Classe', 'Frequência', 'Marque a presença dos alunos por aula.') + `<div class="toolbar"><select id="frequencia-turma" onchange="carregarFrequencia(this.value)">${opcoesTurmas(turmas)}</select><input id="frequencia-data" type="date" onchange="carregarFrequencia(document.getElementById('frequencia-turma').value)"><span class="muted">Selecione uma data para carregar a turma</span></div><div id="tabela-frequencia"></div>`;
    document.getElementById('frequencia-data').valueAsDate = new Date();
    if (turmas[0]) carregarFrequencia(turmas[0].id);
}

async function carregarFrequencia(turmaId) {
    const data = document.getElementById('frequencia-data').value;
    if (!data) return;
    const res = await fetch(`/professor/turmas/${turmaId}/frequencia?data=${data}`, { headers: professorHeaders() });
    const alunos = res.ok ? await res.json() : [];
    document.getElementById('tabela-frequencia').innerHTML = alunos.length ? `<table class="data-table"><thead><tr><th>Aluno</th><th>Status da presença</th><th>Observação</th></tr></thead><tbody>${alunos.map(aluno => `<tr><td><strong>${aluno.nome}</strong></td><td><select onchange="salvarFrequencia(${turmaId}, ${aluno.aluno_id}, this.value)"><option value="presente" ${aluno.status === 'presente' ? 'selected' : ''}>Presente</option><option value="ausente" ${aluno.status === 'ausente' ? 'selected' : ''}>Ausente</option><option value="justificada" ${aluno.status === 'justificada' ? 'selected' : ''}>Falta justificada</option></select></td><td>${aluno.observacao || '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Nenhum aluno matriculado nesta turma.</div>';
}

async function salvarFrequencia(turmaId, alunoId, status) {
    await fetch(`/professor/turmas/${turmaId}/frequencia`, { method: 'POST', headers: { ...professorHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ aluno_id: alunoId, data_aula: document.getElementById('frequencia-data').value, status }) });
}

async function renderizarNotas(turmaSelecionada) {
    const turmas = await buscarTurmasProfessor();
    const disciplinas = await fetch('/professor/disciplinas-academicas', { headers: professorHeaders() }).then(res => res.ok ? res.json() : []);
    const turmaId = turmaSelecionada || turmas[0]?.id;
    document.getElementById('conteudo-principal').innerHTML = pageHeader('Avaliações', 'Lançamento de notas', 'Acompanhe o desempenho e registre as notas bimestrais.') + `<div class="toolbar"><select id="notas-turma" onchange="carregarTabelaNotas(this.value)">${opcoesTurmas(turmas)}</select><select id="notas-disciplina" onchange="carregarTabelaNotas(document.getElementById('notas-turma').value)">${disciplinas.map(disciplina => `<option value="${disciplina.id}">${disciplina.nome}</option>`).join('')}</select><button class="btn-secondary" onclick="window.print()"><i class="fas fa-download"></i> Exportar</button></div><div id="tabela-notas"></div>`;
    if (turmaId) { document.getElementById('notas-turma').value = turmaId; carregarTabelaNotas(turmaId); }
}

async function carregarTabelaNotas(turmaId) {
    const disciplinaId = document.getElementById('notas-disciplina')?.value || '';
    const res = await fetch(`/professor/turmas/${turmaId}/alunos?disciplina_id=${disciplinaId}`, { headers: professorHeaders() });
    const data = res.ok ? await res.json() : { alunos: [] };
    document.getElementById('tabela-notas').innerHTML = data.alunos.length ? `<table class="data-table grades-table"><thead><tr><th>Aluno</th><th>1º Bimestre</th><th>2º Bimestre</th><th>3º Bimestre</th><th>4º Bimestre</th><th>Média</th><th></th></tr></thead><tbody>${data.alunos.map(aluno => { const notas = [aluno.nota_b1, aluno.nota_b2, aluno.nota_b3, aluno.nota_b4]; const validas = notas.filter(nota => nota !== '').map(Number); const media = validas.length ? (validas.reduce((a, b) => a + b, 0) / validas.length).toFixed(2) : '—'; return `<tr><td><strong>${aluno.nome}</strong><small>${aluno.email || ''}</small></td>${notas.map((nota, indice) => `<td><input class="grade-input" type="number" min="0" max="10" step="0.1" id="nota-${indice + 1}-${aluno.id}" value="${nota}"></td>`).join('')}<td><strong class="grade-average">${media}</strong></td><td><button onclick="salvarNota(${turmaId}, ${aluno.id})">Salvar</button></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty-state">Nenhum aluno matriculado nesta turma.</div>';
}

async function salvarNota(turmaId, alunoId) {
    const campos = [1, 2, 3, 4].map(bimestre => document.getElementById(`nota-${bimestre}-${alunoId}`));
    const disciplinaId = document.getElementById('notas-disciplina')?.value;
    const respostas = await Promise.all(campos.map((campo, indice) => campo.value === '' ? null : fetch('/professor/notas-academicas', { method: 'POST', headers: { ...professorHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ turma_id: turmaId, aluno_id: alunoId, disciplina_id: disciplinaId, bimestre: indice + 1, nota: campo.value, ano_letivo: new Date().getFullYear() }) })).filter(Boolean));
    if (respostas.every(resposta => resposta.ok)) carregarTabelaNotas(turmaId); else alert('Não foi possível salvar todas as notas.');
}

async function renderizarRelatorios() {
    const turmas = await buscarTurmasProfessor();
    document.getElementById('conteudo-principal').innerHTML = pageHeader('Relatórios', 'Relatórios da turma', 'Gere visões consolidadas para acompanhar sua turma.') + `<div class="report-grid"><button class="report-card" onclick="carregarRelatorio()"><i class="fas fa-file-invoice"></i><strong>Boletim da turma</strong><span>Notas e médias bimestrais</span><b>Gerar <i class="fas fa-arrow-right"></i></b></button><button class="report-card" onclick="carregarRelatorio()"><i class="fas fa-calendar-check"></i><strong>Relatório de frequência</strong><span>Presenças e faltas por aluno</span><b>Gerar <i class="fas fa-arrow-right"></i></b></button><button class="report-card" onclick="carregarRelatorio()"><i class="fas fa-chart-line"></i><strong>Desempenho da turma</strong><span>Resumo de médias e frequência</span><b>Gerar <i class="fas fa-arrow-right"></i></b></button><button class="report-card" onclick="carregarBoletimAcademico()"><i class="fas fa-graduation-cap"></i><strong>Boletim acadêmico</strong><span>Disciplinas, notas e situação</span><b>Gerar <i class="fas fa-arrow-right"></i></b></button></div><div class="toolbar"><select id="relatorio-turma">${opcoesTurmas(turmas)}</select></div><div id="tabela-relatorio"></div>`;
}

async function carregarBoletimAcademico() {
    const turmaId = document.getElementById('relatorio-turma').value;
    const res = await fetch(`/professor/turmas/${turmaId}/boletim?ano_letivo=${new Date().getFullYear()}`, { headers: professorHeaders() });
    const linhas = res.ok ? await res.json() : [];
    document.getElementById('tabela-relatorio').innerHTML = linhas.length ? `<table class="data-table"><thead><tr><th>Aluno</th><th>Disciplina</th><th>B1</th><th>B2</th><th>B3</th><th>B4</th><th>Média</th></tr></thead><tbody>${Object.values(linhas.reduce((grupos, linha) => { const chave = `${linha.aluno_id}-${linha.disciplina_id}`; grupos[chave] ||= []; grupos[chave].push(linha); return grupos; }, {})).map(grupo => { const notas = [1, 2, 3, 4].map(bimestre => grupo.find(linha => linha.bimestre === bimestre)?.nota ?? '—'); const validas = notas.filter(nota => nota !== '—').map(Number); const media = validas.length ? (validas.reduce((a, b) => a + b, 0) / validas.length).toFixed(2) : '—'; return `<tr><td>${grupo[0].aluno_nome}</td><td>${grupo[0].disciplina_nome}</td>${notas.map(nota => `<td>${nota}</td>`).join('')}<td><strong>${media}</strong></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty-state">Nenhuma nota acadêmica lançada para esta turma.</div>';
}

async function carregarRelatorio() {
    const turmaId = document.getElementById('relatorio-turma').value;
    const res = await fetch(`/professor/turmas/${turmaId}/relatorio`, { headers: professorHeaders() });
    const alunos = res.ok ? await res.json() : [];
    document.getElementById('tabela-relatorio').innerHTML = alunos.length ? `<table class="data-table"><thead><tr><th>Aluno</th><th>Média anual</th><th>Notas lançadas</th><th>Frequência</th><th>Situação</th></tr></thead><tbody>${alunos.map(aluno => `<tr><td><strong>${aluno.nome}</strong></td><td><strong>${aluno.media_anual || '—'}</strong></td><td>${aluno.notas_lancadas}</td><td>${aluno.frequencia_percentual}%</td><td><span class="status-badge">Em acompanhamento</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Selecione uma turma para gerar o relatório.</div>';
}
