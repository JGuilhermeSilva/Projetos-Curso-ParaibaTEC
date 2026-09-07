let alunosDirecao = [];
let alunoFichaAtual = null;

function formatarData(data) {
    if (!data) return '—';
    const texto = String(data).slice(0, 10);
    const partes = texto.split('-');
    if (partes.length === 3 && partes[0].length === 4) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    const dataConvertida = new Date(data);
    return Number.isNaN(dataConvertida.getTime()) ? '—' : dataConvertida.toLocaleDateString('pt-BR');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('topbar-name').textContent = localStorage.getItem('nome') || '';
    document.getElementById('topbar-date').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
    carregarDashboard();
    carregarEscolasCadastro();
});

function abrirAba(nome, elemento) {
    document.querySelectorAll('.tab-content').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.getElementById('aba-' + nome).style.display = 'block';
    elemento.classList.add('active');
    if (nome === 'geral') carregarDashboard();
    if (nome === 'alunos') { carregarEscolasCadastro(); carregarAlunos(); }
    if (nome === 'professores') carregarProfessores();
    if (nome === 'turmas') { carregarTurmas(); carregarEscolasCadastro(); }
    if (nome === 'matriculas') carregarSelectTurmasMatricula();
    if (nome === 'cadastro') carregarEscolasCadastro();
}

async function buscarEscolas() {
    const res = await fetch('/api/escolas', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    return res.ok ? res.json() : [];
}

async function carregarEscolasCadastro() {
    const escolas = await buscarEscolas();
    const select = document.getElementById('cad-unidade');
    if (select && escolas.length) select.innerHTML = escolas.map(escola => `<option value="${escola.nome}" data-escola-id="${escola.id}" data-decreto="${escola.decreto_criacao || ''}">${escola.nome}</option>`).join('');
    const turmaEscola = document.getElementById('turma-escola');
    if (turmaEscola && escolas.length) turmaEscola.innerHTML = `<option value="">Selecione a escola</option>${escolas.map(escola => `<option value="${escola.id}">${escola.nome}</option>`).join('')}`;
    const filtroEscola = document.getElementById('filtro-escola');
    if (filtroEscola && escolas.length) filtroEscola.innerHTML = `<option value="">Todas as escolas</option>${escolas.map(escola => `<option value="${escola.id}">${escola.nome}</option>`).join('')}`;
}

async function carregarAlunos() {
    const token = localStorage.getItem('token');
    const lista = document.getElementById('lista-alunos');
    const parametros = new URLSearchParams();
    const campoBusca = document.getElementById('busca-alunos');
    const filtros = {
        busca: campoBusca?.value.trim(),
        escola_id: document.getElementById('filtro-escola')?.value,
        idade_min: document.getElementById('filtro-idade-min')?.value,
        idade_max: document.getElementById('filtro-idade-max')?.value,
        transporte_escolar: document.getElementById('filtro-transporte')?.value,
        regiao: document.getElementById('filtro-regiao')?.value,
        necessidades_alimentares: document.getElementById('filtro-alimentar')?.value,
        bolsa_familia: document.getElementById('filtro-bolsa')?.value,
        autorizacao_imagem: document.getElementById('filtro-imagem')?.value
    };
    Object.entries(filtros).forEach(([chave, valor]) => { if (valor) parametros.set(chave, valor); });
    const res = await fetch(`/api/diretor/alunos?${parametros}`, { headers: { 'Authorization': `Bearer ${token}` } });
    alunosDirecao = res.ok ? await res.json() : [];
    renderizarAlunos(alunosDirecao);
}

function renderizarAlunos(alunos) {
    const lista = document.getElementById('lista-alunos');
    lista.innerHTML = alunos.length ? `<table class="data-table"><thead><tr><th>Aluno</th><th>Escola atual</th><th>Matrícula</th><th>Idade</th><th>Transporte</th><th>Ações</th></tr></thead><tbody>${alunos.map(aluno => `<tr><td><strong>${aluno.nome}</strong><small>${aluno.email}</small></td><td>${aluno.escola_nome || '—'}</td><td>${aluno.matricula || '—'}</td><td>${calcularIdade(aluno.data_nascimento)}</td><td><span class="status-badge">${aluno.transporte_escolar ? 'Sim' : 'Não'}</span></td><td><button class="btn-secondary" onclick="abrirFichaAluno(${aluno.id})"><i class="fas fa-eye"></i> Ficha</button><button class="btn-danger" onclick="excluirUsuario(${aluno.id})"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Nenhum aluno encontrado para os critérios selecionados.</div>';
}

function calcularIdade(data) {
    if (!data) return '—';
    const nascimento = new Date(`${String(data).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(nascimento.getTime())) return '—';
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const aniversarioAindaNaoChegou = hoje.getMonth() < nascimento.getMonth() || (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
    if (aniversarioAindaNaoChegou) idade--;
    return `${idade} anos`;
}

function filtrarAlunos() {
    carregarAlunos();
}

function limparFiltrosAlunos() {
    ['busca-alunos', 'filtro-idade-min', 'filtro-idade-max'].forEach(id => { const campo = document.getElementById(id); if (campo) campo.value = ''; });
    ['filtro-situacao', 'filtro-escola', 'filtro-transporte', 'filtro-regiao', 'filtro-alimentar', 'filtro-bolsa', 'filtro-imagem'].forEach(id => { const campo = document.getElementById(id); if (campo) campo.selectedIndex = 0; });
    carregarAlunos();
}

async function abrirFichaAluno(alunoId) {
    const res = await fetch(`/api/diretor/alunos/${alunoId}/ficha`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        return alert(erro.message || 'Não foi possível carregar a ficha.');
    }
    const aluno = await res.json();
    const historicoRes = await fetch(`/api/diretor/alunos/${alunoId}/matriculas`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const historico = historicoRes.ok ? await historicoRes.json() : [];
    alunoFichaAtual = aluno;
    const foto = aluno.avatar_url ? `<img src="${aluno.avatar_url}" alt="Foto de ${aluno.nome}">` : '<span>' + aluno.nome.charAt(0).toUpperCase() + '</span>';
    const acaoFoto = aluno.avatar_url ? `<button class="remove-photo-button" onclick="removerFotoPerfil(${aluno.id})"><i class="fas fa-trash"></i> Remover foto</button>` : '';
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="modal-ficha"><div class="modal-content ficha-modal"><div class="modal-heading"><div><div class="breadcrumb">Alunos <span>/</span> Ficha</div><h2>Ficha do aluno</h2></div><button class="btn-secondary" onclick="document.getElementById('modal-ficha').remove()"><i class="fas fa-times"></i></button></div><div class="student-summary"><div class="student-avatar">${foto}</div><div class="student-summary-main"><h3>${aluno.nome}</h3><p>Matrícula: ${aluno.matricula || 'Não informada'} · ${aluno.email}</p><label class="upload-photo-button"><i class="fas fa-camera"></i> Alterar foto<input type="file" accept="image/jpeg,image/png,image/webp" onchange="enviarFotoPerfil(${aluno.id}, this)"></label></div></div><div class="detail-tabs"><button class="detail-tab active" data-tab="pessoal" onclick="alternarAbaFicha('pessoal')">Dados pessoais</button><button class="detail-tab" data-tab="documentos" onclick="alternarAbaFicha('documentos')">Documentos (${aluno.documentos.length})</button><button class="detail-tab" data-tab="inscricao" onclick="alternarAbaFicha('inscricao')">Ficha de inscrição</button></div><section id="ficha-pessoal" class="ficha-tab-content"><div class="detail-grid"><div><label>Data de nascimento</label><strong>${formatarData(aluno.data_nascimento)}</strong></div><div><label>Responsável</label><strong>${aluno.nome_responsavel || '—'}</strong></div><div><label>Telefone</label><strong>${aluno.telefone || '—'}</strong></div><div><label>Endereço</label><strong>${aluno.endereco || '—'}</strong></div><div><label>CPF</label><strong>${aluno.cpf || '—'}</strong></div><div><label>Naturalidade</label><strong>${aluno.natural_de || '—'}</strong></div></div></section><section id="ficha-documentos" class="ficha-tab-content" style="display:none"><div class="documents-header"><h3 class="subheading">Documentos do aluno</h3><button class="btn-secondary" onclick="alert('O upload de documentos será liberado nesta ficha.')"><i class="fas fa-plus"></i> Adicionar documento</button></div><div class="document-list">${aluno.documentos.length ? aluno.documentos.map(documento => `<div><i class="fas fa-file-alt"></i><span>${documento.nome}<small>${documento.tipo}</small></span><a class="btn-secondary" href="${documento.caminho}" target="_blank" rel="noopener" title="Abrir documento"><i class="fas fa-external-link-alt"></i></a></div>`).join('') : '<p class="muted document-empty">Nenhum documento anexado.</p>'}</div></section><section id="ficha-inscricao" class="ficha-tab-content" style="display:none"><div class="detail-grid"><div><label>Status da inscrição</label><strong>${aluno.status_inscricao || 'Pendente'}</strong></div><div><label>Última atualização</label><strong>${formatarData(aluno.updated_at)}</strong></div><div class="detail-wide"><label>Observações</label><strong>${aluno.observacoes_inscricao || 'Nenhuma observação registrada.'}</strong></div></div><div class="documents-header"><h3 class="subheading">Histórico de matrículas</h3><button class="btn-secondary" onclick="abrirFormularioTransferencia(${aluno.id})"><i class="fas fa-exchange-alt"></i> Transferir aluno</button></div><div class="document-list">${historico.length ? historico.map(item => `<div><i class="fas fa-school"></i><span><strong>${item.escola_nome || 'Escola não informada'}</strong><small>${item.serie || 'Etapa não informada'} · ${item.ano_letivo || '—'} · ${item.status} · entrada ${formatarData(item.data_matricula)}${item.data_saida ? ` · saída ${formatarData(item.data_saida)}` : ''}</small></span></div>`).join('') : '<p class="muted document-empty">Nenhuma matrícula registrada.</p>'}</div></section></div></div>`);
    const documentButton = document.querySelector('#ficha-documentos .documents-header button');
    if (documentButton) documentButton.onclick = () => abrirUploadDocumento(aluno.id);
    const abas = document.querySelector('#modal-ficha .detail-tabs');
    if (abas) {
        abas.insertAdjacentHTML('beforeend', `<button class="detail-tab" data-tab="historico" onclick="alternarAbaFicha('historico')">Histórico escolar</button><button class="detail-tab" data-tab="boletim" onclick="alternarAbaFicha('boletim')">Boletim</button>`);
        abas.insertAdjacentHTML('afterend', '<section id="ficha-historico" class="ficha-tab-content" style="display:none"><div class="empty-state">Carregando histórico...</div></section><section id="ficha-boletim" class="ficha-tab-content" style="display:none"><div class="empty-state">Carregando boletim...</div></section>');
    }
}

function abrirUploadDocumento(alunoId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/jpeg,image/png,image/webp';
    input.onchange = async () => {
        if (!input.files[0]) return;
        const tipo = prompt('Tipo do documento:', 'Documento escolar');
        if (tipo === null) return;
        const dados = new FormData();
        dados.append('documento', input.files[0]);
        dados.append('tipo', tipo || 'Documento escolar');
        const res = await fetch(`/api/diretor/alunos/${alunoId}/documentos/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: dados });
        const resposta = await res.json().catch(() => ({}));
        if (!res.ok) return alert(resposta.message || 'Não foi possível enviar o documento.');
        alert('Documento enviado com sucesso.');
        document.getElementById('modal-ficha')?.remove();
        abrirFichaAluno(alunoId);
    };
    input.click();
}

async function abrirFormularioTransferencia(alunoId) {
    const turmasRes = await fetch('/api/turmas', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const turmas = turmasRes.ok ? await turmasRes.json() : [];
    const area = document.querySelector('#ficha-inscricao .documents-header');
    if (document.getElementById('form-transferencia')) return;
    area.insertAdjacentHTML('afterend', `<div id="form-transferencia" class="transfer-form"><label>Nova turma</label><select id="transferencia-turma">${turmas.map(turma => `<option value="${turma.id}">${turma.escola_nome || 'Escola'} · ${turma.nome} (${turma.ano_letivo})</option>`).join('')}</select><label>Série / etapa</label><input id="transferencia-serie" placeholder="Ex.: 6º ano"><label>Ano letivo</label><input id="transferencia-ano" type="number" value="${new Date().getFullYear()}"><button onclick="salvarTransferencia(${alunoId})">Confirmar transferência</button></div>`);
}

async function salvarTransferencia(alunoId) {
    const res = await fetch(`/api/diretor/alunos/${alunoId}/transferir`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ turma_id: document.getElementById('transferencia-turma').value, serie: document.getElementById('transferencia-serie').value, ano_letivo: document.getElementById('transferencia-ano').value }) });
    const resposta = await res.json();
    if (!res.ok) return alert(resposta.message || 'Não foi possível transferir o aluno.');
    alert('Transferência registrada com sucesso.');
    document.getElementById('modal-ficha').remove();
    abrirFichaAluno(alunoId);
}

function alternarAbaFicha(aba) {
    document.querySelectorAll('.detail-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === aba));
    document.querySelectorAll('.ficha-tab-content').forEach(conteudo => conteudo.style.display = 'none');
    document.getElementById(`ficha-${aba}`).style.display = 'block';
    if (aba === 'historico') carregarHistoricoFicha();
    if (aba === 'boletim') carregarBoletimFicha();
    if (aba === 'inscricao' && !document.getElementById('imprimir-ficha-inscricao')) {
        document.getElementById('ficha-inscricao').insertAdjacentHTML('afterbegin', '<div class="print-inscription-action"><button class="edit-student-button" onclick="abrirEditorAluno()"><i class="fas fa-edit"></i> Editar dados</button><button id="imprimir-ficha-inscricao" onclick="imprimirFichaInscricao(alunoFichaAtual.id)"><i class="fas fa-print"></i> Imprimir ficha de inscrição</button></div>');
    }
}

async function carregarHistoricoFicha() {
    const area = document.getElementById('ficha-historico');
    const res = await fetch(`/api/diretor/alunos/${alunoFichaAtual.id}/historico`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const historico = res.ok ? await res.json() : [];
    area.innerHTML = historico.length ? `<table class="data-table"><thead><tr><th>Ano</th><th>Escola</th><th>Série</th><th>Disciplina</th><th>Carga horária</th><th>Média</th><th>Frequência</th><th>Situação</th></tr></thead><tbody>${historico.map(item => `<tr><td>${item.ano_letivo}</td><td>${item.escola_nome || '—'}</td><td>${item.serie || '—'}</td><td>${item.disciplina_nome || '—'}</td><td>${item.carga_horaria || '—'}</td><td>${item.media_final || '—'}</td><td>${item.frequencia_percentual ? `${item.frequencia_percentual}%` : '—'}</td><td>${item.situacao || '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Nenhum registro de histórico escolar.</div>';
}

async function carregarBoletimFicha() {
    const area = document.getElementById('ficha-boletim');
    const res = await fetch(`/api/diretor/alunos/${alunoFichaAtual.id}/boletim?ano_letivo=${new Date().getFullYear()}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const linhas = res.ok ? await res.json() : [];
    const grupos = Object.values(linhas.reduce((acumulador, linha) => { const chave = `${linha.disciplina_id}`; acumulador[chave] ||= []; acumulador[chave].push(linha); return acumulador; }, {}));
    area.innerHTML = grupos.length ? `<table class="data-table"><thead><tr><th>Disciplina</th><th>1º Bim.</th><th>2º Bim.</th><th>3º Bim.</th><th>4º Bim.</th><th>Média</th></tr></thead><tbody>${grupos.map(grupo => { const notas = [1, 2, 3, 4].map(bimestre => grupo.find(linha => linha.bimestre === bimestre)?.nota ?? '—'); const validas = notas.filter(nota => nota !== '—').map(Number); const media = validas.length ? (validas.reduce((a, b) => a + b, 0) / validas.length).toFixed(2) : '—'; return `<tr><td>${grupo[0].disciplina_nome}</td>${notas.map(nota => `<td>${nota}</td>`).join('')}<td><strong>${media}</strong></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty-state">Nenhuma nota lançada no ano atual.</div>';
}

function valorCampo(valor) {
    return String(valor ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function abrirEditorAluno() {
    const aluno = alunoFichaAtual;
    if (!aluno) return;
    alternarAbaFicha('pessoal');
    const campo = (id, label, valor = '', tipo = 'text') => `<div><label>${label}</label><input id="editar-${id}" type="${tipo}" value="${valorCampo(tipo === 'date' ? String(valor || '').slice(0, 10) : valor)}"></div>`;
    const select = (id, label, valor, opcoes) => `<div><label>${label}</label><select id="editar-${id}">${opcoes.map(opcao => `<option value="${opcao[0]}" ${String(valor) === String(opcao[0]) ? 'selected' : ''}>${opcao[1]}</option>`).join('')}</select></div>`;
    document.getElementById('ficha-pessoal').innerHTML = `<div class="edit-form"><div class="edit-form-heading"><h3>Editar dados do aluno</h3><span>Atualize os dados cadastrais e do responsável.</span></div><div class="edit-form-grid">${campo('nome', 'Nome completo', aluno.nome)}${campo('email', 'E-mail', aluno.email)}${campo('matricula', 'Matrícula', aluno.matricula)}${campo('data_nascimento', 'Data de nascimento', aluno.data_nascimento, 'date')}${select('sexo', 'Sexo', aluno.sexo, [['', 'Selecione'], ['M', 'Masculino'], ['F', 'Feminino']])}${campo('raca', 'Raça / cor', aluno.raca)}${campo('periodo', 'Período', aluno.periodo)}${campo('ano', 'Ano / série', aluno.ano)}${campo('nivel_ensino', 'Nível de ensino', aluno.nivel_ensino)}${campo('natural_de', 'Naturalidade', aluno.natural_de)}${campo('uf', 'UF de nascimento', aluno.uf)}${campo('registro_nascimento', 'Registro de nascimento', aluno.registro_nascimento)}${campo('livro', 'Livro', aluno.livro)}${campo('folha', 'Folha', aluno.folha)}${campo('data_emissao_rg', 'Data de emissão do RG', aluno.data_emissao_rg, 'date')}${campo('numero_rg', 'Número do RG', aluno.numero_rg)}${campo('orgao_expedidor', 'Órgão expedidor', aluno.orgao_expedidor)}${campo('cpf', 'CPF', aluno.cpf)}${campo('nis', 'NIS', aluno.nis)}${campo('cartao_sus', 'Cartão SUS', aluno.cartao_sus)}${select('regiao', 'Região', aluno.regiao, [['Rural', 'Rural'], ['Urbana', 'Urbana']])}${select('transporte_escolar', 'Transporte escolar', aluno.transporte_escolar, [['false', 'Não'], ['true', 'Sim']])}${select('autorizacao_imagem', 'Autorização de imagem', aluno.autorizacao_imagem, [['false', 'Não'], ['true', 'Sim']])}${campo('necessidade_especial', 'Necessidade especial', aluno.necessidade_especial)}${campo('necessidades_alimentares', 'Necessidades alimentares PNAE', aluno.necessidades_alimentares)}${campo('nome_pai', 'Nome do pai', aluno.nome_pai)}${campo('profissao_pai', 'Profissão do pai', aluno.profissao_pai)}${campo('nome_mae', 'Nome da mãe', aluno.nome_mae)}${campo('profissao_mae', 'Profissão da mãe', aluno.profissao_mae)}${campo('endereco', 'Endereço', aluno.endereco)}${campo('telefone', 'Telefone', aluno.telefone)}${campo('renda_familiar', 'Renda familiar', aluno.renda_familiar)}${select('bolsa_familia', 'Bolsa Família', aluno.bolsa_familia, [['false', 'Não'], ['true', 'Sim']])}${campo('nome_responsavel', 'Nome do responsável', aluno.nome_responsavel)}${campo('profissao_responsavel', 'Profissão do responsável', aluno.profissao_responsavel)}${campo('responsavel_endereco', 'Endereço do responsável', aluno.responsavel_endereco)}${campo('responsavel_municipio', 'Município do responsável', aluno.responsavel_municipio)}${campo('responsavel_uf', 'UF do responsável', aluno.responsavel_uf)}${campo('grec', 'GREC', aluno.grec)}${campo('unidade', 'Unidade de ensino', aluno.unidade)}${campo('unidade_uf', 'UF da unidade', aluno.unidade_uf)}${campo('decreto_criacao', 'Decreto de criação', aluno.decreto_criacao)}${campo('municipio', 'Município da escola', aluno.municipio)}<div class="edit-wide"><label>Observações</label><textarea id="editar-observacoes" rows="4">${valorCampo(aluno.observacoes)}</textarea></div></div><div class="edit-form-actions"><button class="btn-secondary" onclick="abrirFichaAluno(${aluno.id}); document.getElementById('modal-ficha')?.remove()">Cancelar</button><button onclick="salvarEdicaoAluno()"><i class="fas fa-save"></i> Salvar alterações</button></div></div>`;
}

async function salvarEdicaoAluno() {
    const aluno = alunoFichaAtual;
    const ids = ['nome', 'email', 'matricula', 'data_nascimento', 'sexo', 'raca', 'periodo', 'ano', 'nivel_ensino', 'natural_de', 'uf', 'registro_nascimento', 'livro', 'folha', 'data_emissao_rg', 'numero_rg', 'orgao_expedidor', 'cpf', 'nis', 'cartao_sus', 'regiao', 'transporte_escolar', 'autorizacao_imagem', 'necessidade_especial', 'necessidades_alimentares', 'nome_pai', 'profissao_pai', 'nome_mae', 'profissao_mae', 'endereco', 'telefone', 'renda_familiar', 'bolsa_familia', 'nome_responsavel', 'profissao_responsavel', 'responsavel_endereco', 'responsavel_municipio', 'responsavel_uf', 'grec', 'unidade', 'unidade_uf', 'decreto_criacao', 'municipio', 'observacoes'];
    const dados = Object.fromEntries(ids.map(id => [id, document.getElementById(`editar-${id}`).value]));
    const res = await fetch(`/api/diretor/alunos/${aluno.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(dados) });
    const resposta = await res.json();
    if (!res.ok) return alert(resposta.message || 'Não foi possível salvar as alterações.');
    alert(resposta.message || 'Dados atualizados.');
    document.getElementById('modal-ficha').remove();
    abrirFichaAluno(aluno.id);
}

function imprimirFichaInscricao(alunoId) {
    const aluno = alunoFichaAtual && Number(alunoFichaAtual.id) === Number(alunoId)
        ? alunoFichaAtual
        : alunosDirecao.find(item => Number(item.id) === Number(alunoId));
    if (!aluno) return alert('Não foi possível localizar os dados do aluno.');
    const janela = window.open('', '_blank', 'width=1100,height=850');
    if (!janela) return alert('Permita pop-ups para imprimir a ficha.');
    const valor = campo => aluno[campo] || ({ municipio: 'FREI MARTINHO', uf: 'PB', grec: '4ª' }[campo] || '________________________________');
    const marcado = (condicao, texto) => `<span class="check ${condicao ? 'checked' : ''}">${condicao ? '✓' : ''}</span>${texto}`;
    const foto = aluno.avatar_url ? `<img src="${aluno.avatar_url}" alt="Foto 3x4">` : '<span>FOTO<br>3X4</span>';
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ficha Individual - ${aluno.nome}</title><style>
        @page{size:A4;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:10px;margin:0}.page{width:194mm;min-height:281mm;border:1.5px solid #111;padding:3mm;page-break-after:always}.page:last-child{page-break-after:auto}.header{height:27mm;border-bottom:1.5px solid #111;display:grid;grid-template-columns:42mm 1fr 42mm;align-items:center;text-align:center}.header h1{font-size:17px;margin:0 0 3px}.header p{font-size:9px;margin:2px}.header .crest{font-size:24px;color:#176b47}.title{font-size:15px;font-weight:bold}.section{border:1px solid #111;margin-top:4mm}.section-title{font-size:11px;font-weight:bold;padding:2mm;border-bottom:1px solid #111}.grid{display:grid}.cols-2{grid-template-columns:1fr 1fr}.cols-3{grid-template-columns:1fr 1fr 1fr}.cols-4{grid-template-columns:1.25fr .7fr .7fr 1.35fr}.field{min-height:13mm;padding:2mm;border-right:1px solid #111;border-bottom:1px solid #111}.field:last-child{border-right:0}.field label{display:block;font-weight:bold;font-size:9px;margin-bottom:2mm}.field strong{font-size:11px;font-weight:normal}.wide{grid-column:1/-1}.photo{position:absolute;right:5mm;top:42mm;width:30mm;height:40mm;border:1px solid #111;display:flex;align-items:center;justify-content:center;text-align:center}.photo img{width:100%;height:100%;object-fit:cover}.photo span{font-size:12px}.check{display:inline-flex;width:12px;height:12px;border:1px solid #111;align-items:center;justify-content:center;margin:0 2mm 0 4mm;font-weight:bold}.checked{background:#eee}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:18mm;padding:10mm 4mm 3mm}.line{border-top:1px solid #111;text-align:center;padding-top:2mm}.school-name{color:#145c9e;font-weight:bold;text-align:center;padding:2mm}.notes{height:28mm;padding:3mm}.report-title{text-align:center;font-size:15px;font-weight:bold;margin:3mm 0 6mm}.report-table{width:100%;border-collapse:collapse}.report-table th,.report-table td{border:1px solid #111;padding:4mm 2mm;text-align:center;height:14mm}.report-table th:first-child,.report-table td:first-child{text-align:left;width:42%}.muted{color:#555}.print-button{position:fixed;top:12px;right:12px;padding:10px 16px;background:#078b4b;color:#fff;border:0;border-radius:4px;cursor:pointer}@media print{.print-button{display:none}}
    </style></head><body><button class="print-button" onclick="window.print()">Imprimir</button>
    <div class="page"><header class="header"><div class="crest">✦<br>PARAÍBA</div><div><p>GOVERNO DO ESTADO DA PARAÍBA</p><p>PREFEITURA MUNICIPAL DE FREI MARTINHO - PB</p><p>SECRETARIA MUNICIPAL DE EDUCAÇÃO</p></div><div class="title">FICHA INDIVIDUAL<br><small>DO EDUCANDO</small></div></header>
    <div class="school-name">ESCOLA MUNICIPAL DE ENSINO FUNDAMENTAL ELIETE SOUZA DE ARAÚJO SILVA</div>
    <section class="section"><div class="section-title">1. DADOS DA UNIDADE DE ENSINO</div><div class="grid cols-3"><div class="field"><label>UNIDADE DE ENSINO</label><strong>${valor('unidade') === '________________________________' ? 'ESCOLA MUNICIPAL DE ENSINO FUNDAMENTAL ELIETE SOUZA DE ARAÚJO SILVA' : valor('unidade')}</strong></div><div class="field"><label>GREC</label><strong>${valor('grec')}</strong></div><div class="field"><label>MUNICÍPIO / U.F.</label><strong>${valor('municipio')} / ${valor('uf')}</strong></div></div></section>
    <section class="section" style="position:relative;padding-right:34mm"><div class="section-title">2. DADOS DE IDENTIFICAÇÃO DO ALUNO</div><div class="grid cols-3"><div class="field wide"><label>NOME DO EDUCANDO</label><strong>${valor('nome')}</strong></div><div class="field"><label>SEXO</label><strong>${valor('sexo')}</strong></div><div class="field"><label>RAÇA</label><strong>${valor('raca')}</strong></div><div class="field"><label>DATA DE NASCIMENTO</label><strong>${formatarData(aluno.data_nascimento)}</strong></div><div class="field"><label>MATRÍCULA</label><strong>${valor('matricula')}</strong></div><div class="field"><label>ANO / PERÍODO</label><strong>${valor('ano')} / ${valor('periodo')}</strong></div><div class="field"><label>NÍVEL DE ENSINO</label><strong>${valor('nivel_ensino')}</strong></div><div class="field wide"><label>NATURAL DE / U.F.</label><strong>${valor('natural_de')} / ${valor('uf')}</strong></div><div class="field"><label>REGISTRO DE NASCIMENTO</label><strong>${valor('registro_nascimento')}</strong></div><div class="field"><label>LIVRO / FOLHA</label><strong>${valor('livro')} / ${valor('folha')}</strong></div><div class="field"><label>DATA DE EMISSÃO</label><strong>${formatarData(aluno.data_emissao_rg)}</strong></div><div class="field"><label>NÚMERO DO RG</label><strong>${valor('numero_rg')}</strong></div><div class="field"><label>ÓRGÃO EXPEDIDOR</label><strong>${valor('orgao_expedidor')}</strong></div><div class="field"><label>CPF</label><strong>${valor('cpf')}</strong></div><div class="field"><label>Nº NIS</label><strong>${valor('nis')}</strong></div><div class="field"><label>CARTÃO DO SUS</label><strong>${valor('cartao_sus')}</strong></div><div class="field wide"><label>REGIÃO ONDE RESIDE</label><strong>${valor('regiao')} &nbsp; ${marcado(aluno.transporte_escolar === true || aluno.transporte_escolar === 'true', 'UTILIZA TRANSPORTE ESCOLAR')}</strong></div><div class="field wide"><label>NECESSIDADE ESPECIAL</label><strong>${valor('necessidade_especial')}</strong></div><div class="field wide"><label>AUTORIZAÇÃO PARA IMAGEM NA MÍDIA OFICIAL</label><strong>${marcado(aluno.autorizacao_imagem === true || aluno.autorizacao_imagem === 'true', 'SIM')} ${marcado(!(aluno.autorizacao_imagem === true || aluno.autorizacao_imagem === 'true'), 'NÃO')}</strong></div></div><div class="photo">${foto}</div></section>
    <section class="section"><div class="section-title">3. DADOS DE IDENTIFICAÇÃO DOS PAIS</div><div class="grid cols-2"><div class="field"><label>NOME DO PAI</label><strong>${valor('nome_pai')}</strong></div><div class="field"><label>PROFISSÃO</label><strong>${valor('profissao_pai')}</strong></div><div class="field"><label>NOME DA MÃE</label><strong>${valor('nome_mae')}</strong></div><div class="field"><label>PROFISSÃO</label><strong>${valor('profissao_mae')}</strong></div><div class="field wide"><label>ENDEREÇO</label><strong>${valor('endereco')}</strong></div><div class="field"><label>TELEFONE</label><strong>${valor('telefone')}</strong></div><div class="field"><label>RENDA FAMILIAR</label><strong>${valor('renda_familiar')}</strong></div></div></section>
    <section class="section"><div class="section-title">4. DADOS DE IDENTIFICAÇÃO DO RESPONSÁVEL</div><div class="grid cols-2"><div class="field"><label>NOME DO RESPONSÁVEL</label><strong>${valor('nome_responsavel')}</strong></div><div class="field"><label>PROFISSÃO</label><strong>${valor('profissao_responsavel')}</strong></div><div class="field wide"><label>ENDEREÇO</label><strong>${valor('endereco')}</strong></div><div class="field"><label>TELEFONE</label><strong>${valor('telefone')}</strong></div><div class="field"><label>BOLSA FAMÍLIA</label><strong>${marcado(aluno.bolsa_familia === true || aluno.bolsa_familia === 'true', 'SIM')} ${marcado(!(aluno.bolsa_familia === true || aluno.bolsa_familia === 'true'), 'NÃO')}</strong></div></div></section>
    <section class="section"><div class="signatures"><div class="line">ASSINATURA DO RESPONSÁVEL</div><div class="line">ASSINATURA DO FUNCIONÁRIO / MATRÍCULA</div></div><div class="notes"><strong>OBSERVAÇÕES</strong></div></section></div>
    <div class="page"><div class="report-title">RENDIMENTO ESCOLAR</div><p class="muted">BASE NACIONAL COMUM · Ficha de acompanhamento anual do educando</p><table class="report-table"><thead><tr><th>ÁREA DE CONHECIMENTO E DISCIPLINA</th><th>1º</th><th>2º</th><th>3º</th><th>4º</th><th>MÉDIA FINAL</th><th>CARGA HORÁRIA ANUAL</th><th>% FREQUÊNCIA</th></tr></thead><tbody>${['LÍNGUA PORTUGUESA', 'ARTE', 'EDUCAÇÃO FÍSICA', 'MATEMÁTICA', 'HISTÓRIA', 'CIÊNCIAS', 'GEOGRAFIA', 'ENSINO RELIGIOSO', 'LÍNGUA ESTRANGEIRA'].map(disciplina => `<tr><td>${disciplina}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}</tbody></table><div class="signatures"><div class="line">ASSINATURA E Nº DO REGISTRO DO SECRETÁRIO ESCOLAR</div><div class="line">ASSINATURA E Nº DO REGISTRO DO DIRETOR ESCOLAR</div></div></div></body></html>`);
    janela.document.close();
    janela.focus();
}

async function enviarFotoPerfil(alunoId, input) {
    const arquivo = input.files[0];
    if (!arquivo) return;
    const dados = new FormData();
    dados.append('foto', arquivo);
    const res = await fetch(`/api/diretor/alunos/${alunoId}/foto`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: dados });
    const resposta = await res.json();
    if (!res.ok) return alert(resposta.message || 'Não foi possível atualizar a foto.');
    const avatar = document.querySelector('#modal-ficha .student-avatar');
    avatar.innerHTML = `<img src="${resposta.foto_url}?v=${Date.now()}" alt="Foto do aluno">`;
    alunoFichaAtual.avatar_url = resposta.foto_url;
    inserirAcaoRemoverFoto();
}

function inserirAcaoRemoverFoto() {
    const acoes = document.querySelector('#modal-ficha .student-summary-main');
    if (acoes && alunoFichaAtual?.avatar_url && !acoes.querySelector('.remove-photo-button')) {
        acoes.insertAdjacentHTML('beforeend', `<button class="remove-photo-button" onclick="removerFotoPerfil(${alunoFichaAtual.id})"><i class="fas fa-trash"></i> Remover foto</button>`);
    }
}

async function removerFotoPerfil(alunoId) {
    if (!confirm('Remover a foto deste aluno?')) return;
    const res = await fetch(`/api/diretor/alunos/${alunoId}/foto`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const resposta = await res.json().catch(() => ({}));
    if (!res.ok) return alert(resposta.message || 'Não foi possível remover a foto.');
    alunoFichaAtual.avatar_url = null;
    const avatar = document.querySelector('#modal-ficha .student-avatar');
    if (avatar) avatar.textContent = alunoFichaAtual.nome.charAt(0).toUpperCase();
    document.querySelector('#modal-ficha .remove-photo-button')?.remove();
}

const observadorFicha = new MutationObserver(() => inserirAcaoRemoverFoto());
observadorFicha.observe(document.body, { childList: true, subtree: true });

async function carregarProfessores() {
    const token = localStorage.getItem('token');
    const lista = document.getElementById('lista-professores');
    const res = await fetch('/api/diretor/professores', { headers: { 'Authorization': `Bearer ${token}` } });
    const profs = res.ok ? await res.json() : [];
    lista.innerHTML = profs.map(p => `<li>${p.nome} - ${p.disciplinas.join(', ')} <button onclick="excluirUsuario(${p.id})">Excluir</button></li>`).join('');
}

async function carregarTurmas() {
    const token = localStorage.getItem('token');
    const lista = document.getElementById('lista-turmas');
    const res = await fetch('/api/turmas', { headers: { 'Authorization': `Bearer ${token}` } });
    const turmas = res.ok ? await res.json() : [];
    lista.innerHTML = turmas.map(t => `<li><span><strong>${t.nome}</strong> · ${t.escola_nome || 'Escola não informada'} (${t.ano_letivo}) - Prof: ${t.professor_nome || 'Sem professor'}</span><button onclick="excluirTurma(${t.id})">Excluir</button></li>`).join('');
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
    const escola_id = document.getElementById('turma-escola').value;
    const res = await fetch('/api/turmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome, ano_letivo: ano, professor_id, escola_id })
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
        <div class="enrollment-fields">
            <label>Ano letivo</label><input id="matricula-ano" type="number" value="${turmaData.ano_letivo || new Date().getFullYear()}">
            <label>Série / etapa</label><input id="matricula-serie" placeholder="Ex.: 6º ano">
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
        body: JSON.stringify({
            aluno_id: alunoId,
            ano_letivo: document.getElementById('matricula-ano')?.value,
            serie: document.getElementById('matricula-serie')?.value
        })
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

    const dados = { nome, email, papel, disciplinas, senha };

    if (papel === 'aluno') {
        const campo = id => document.getElementById(id)?.value || '';
        Object.assign(dados, {
            matricula: campo('cad-matricula'), grec: campo('cad-grec'), unidade: campo('cad-unidade'),
            decreto_criacao: campo('cad-decreto'), municipio: campo('cad-municipio'), uf_escola: campo('cad-uf-escola'), sexo: campo('cad-sexo'), raca: campo('cad-raca'),
            data_nascimento: campo('cad-nascimento'), periodo: campo('cad-periodo'), ano: campo('cad-ano'),
            nivel_ensino: campo('cad-nivel'), natural_de: campo('cad-natural'), uf: campo('cad-uf'),
            registro_nascimento: campo('cad-registro'), livro: campo('cad-livro'), folha: campo('cad-folha'),
            data_emissao_rg: campo('cad-data-rg'), numero_rg: campo('cad-rg'), orgao_expedidor: campo('cad-orgao'),
            cpf: campo('cad-cpf'), nis: campo('cad-nis'), cartao_sus: campo('cad-sus'), regiao: campo('cad-regiao'),
            transporte_escolar: campo('cad-transporte'), necessidade_especial: campo('cad-necessidade'), necessidades_alimentares: [...document.querySelectorAll('input[name="cad-alimentar"]:checked')].map(item => item.value).concat(campo('cad-alimentares')).filter(Boolean).join(', '),
            autorizacao_imagem: campo('cad-imagem'), nome_pai: campo('cad-nome-pai'), profissao_pai: campo('cad-prof-pai'),
            nome_mae: campo('cad-nome-mae'), profissao_mae: campo('cad-prof-mae'), endereco: campo('cad-endereco'),
            telefone: campo('cad-telefone'), renda_familiar: campo('cad-renda'), bolsa_familia: campo('cad-bolsa'),
            nome_responsavel: campo('cad-nome-resp'), profissao_responsavel: campo('cad-prof-resp'), responsavel_endereco: campo('cad-endereco-resp'),
            responsavel_municipio: campo('cad-municipio-resp'), responsavel_uf: campo('cad-uf-resp'), observacoes: campo('cad-observacoes')
        });
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
            document.getElementById('form-cadastro')?.reset();
            if (document.getElementById('form-aluno')) document.getElementById('form-aluno').style.display = 'none';
            carregarAlunos();
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
    const res = await fetch(`/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    const resposta = await res.json().catch(() => ({}));
    if (!res.ok) return alert(resposta.message || 'Não foi possível excluir o usuário.');
    alert(resposta.message || 'Usuário excluído.');
    carregarAlunos();
    carregarProfessores();
}

async function carregarDashboard(escolaId = '') {
    const token = localStorage.getItem('token');
    const filtro = escolaId ? `?escola_id=${encodeURIComponent(escolaId)}` : '';
    const res = await fetch(`/api/diretor/relatorios/indicadores${filtro}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const dados = res.ok ? await res.json() : { alunos: '—', professores: '—', turmas: '—', matriculas_ativas: '—', transferencias: '—', documentos: '—' };
    const escolaSelect = document.getElementById('dashboard-escola');
    if (escolaSelect && escolaSelect.options.length === 1) {
        const escolas = await buscarEscolas();
        escolaSelect.innerHTML = `<option value="">Todas as escolas</option>${escolas.map(escola => `<option value="${escola.id}">${escola.nome}</option>`).join('')}`;
        escolaSelect.value = escolaId;
    }
    document.getElementById('indicadores-direcao').innerHTML = [
        ['fa-user-graduate', dados.alunos, 'Alunos'],
        ['fa-chalkboard-teacher', dados.professores, 'Professores'],
        ['fa-users', dados.turmas, 'Turmas'],
        ['fa-file-signature', dados.matriculas_ativas, 'Matrículas ativas'],
        ['fa-exchange-alt', dados.transferencias, 'Transferências'],
        ['fa-folder-open', dados.documentos, 'Documentos']
    ].map(([icone, valor, titulo]) => `<div class="metric-card"><span class="label"><i class="fas ${icone}"></i> ${titulo}</span><strong class="value">${valor}</strong><span class="trend">Atualizado agora</span></div>`).join('');
}

document.addEventListener('DOMContentLoaded', carregarDashboard);

// Fechar modal com a tecla ESC
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        // Procura qualquer modal aberta (com a classe modal-overlay)
        const modalAberta = document.querySelector('.modal-overlay');
        if (modalAberta) {
            modalAberta.remove();
        }
    }
});