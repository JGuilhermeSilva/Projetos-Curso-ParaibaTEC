/* 
  Sistema de Gestão de Estoque Municipal - Versão Segura
  - Login com múltiplos usuários
  - Senhas armazenadas como hash SHA-256
  - Gestão de usuários (cadastro, edição, ativação/desativação)
  - Bloqueio após tentativas falhas (3 tentativas -> 5 minutos)
  - Expiração de sessão por inatividade (30 minutos)
  - Cadastro de produtos (apenas admin)
  - Registro de entradas e saídas com data/hora e responsável
  - Histórico de movimentações
  - Exportação em PDF e CSV
  - PWA e demais recursos mantidos separadamente
*/

/* -------------------------------
   Dados iniciais (senhas em texto simples serão convertidas para hash no init)
--------------------------------*/
let usuarios = [
  { nome: "admin", senha: "123", perfil: "Administrador", ativo: true },

  { nome: "joao", senha: "456", perfil: "Funcionário", ativo: true },

  { nome: "maria", senha: "789", perfil: "Funcionário", ativo: false }
];

let produtos = [];
let historico = [];
let usuarioLogado = null;

/* -------------------------------
   Segurança: tentativas e bloqueios
--------------------------------*/
let tentativasFalhas = {}; // { usuario: numero }
let bloqueios = {};        // { usuario: timestampLiberacao }

/* -------------------------------
   Sessão (expiração por inatividade)
--------------------------------*/
let sessaoTimer = null;
const TEMPO_SESSAO_MS = 30 * 60 * 1000; // 30 minutos

function iniciarSessao() {
  if (sessaoTimer) clearTimeout(sessaoTimer);
  sessaoTimer = setTimeout(() => {
    alert("Sessão expirada por inatividade. Faça login novamente.");
    logout();
  }, TEMPO_SESSAO_MS);
}

function resetarSessaoSeLogado() {
  if (usuarioLogado) iniciarSessao();
}

/* -------------------------------
   Utilitário: gerar hash SHA-256 (hex) (Parou Aqui!)
--------------------------------*/
async function gerarHash(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/* -------------------------------
   Inicialização: converte senhas não-hash para hash
--------------------------------*/
async function initUsuarios() {
  for (let u of usuarios) {
    // Detecta se já está em SHA-256 hex (64 caracteres hex)
    if (typeof u.senha === "string" && u.senha.length !== 64) {
      u.senha = await gerarHash(u.senha);
    }
  }
}

/* -------------------------------
   Alternar telas (UI simples)
--------------------------------*/
function mostrarTela(tela) {
  const conteudo = document.getElementById('conteudo');

  if (tela === 'login') {
    conteudo.innerHTML = `
      <h2>Login</h2>
      <input id="usuario" placeholder="Usuário">
      <input id="senha" type="password" placeholder="Senha">
      <button onclick="login()">Entrar</button>
    `;
  }

  else if (tela === 'cadastro') {
    if (usuarioLogado && usuarioLogado.perfil === "Administrador") {
      conteudo.innerHTML = `
        <h2>Cadastro de Produto</h2>
        <input id="nome" placeholder="Nome do Produto">
        <input id="quantidade" type="number" placeholder="Quantidade Inicial">
        <button onclick="cadastrarProduto()">Cadastrar</button>
      `;
    } else {
      conteudo.innerHTML = `<p style="color:red">Acesso restrito ao Administrador!</p>`;
    }
  }

  else if (tela === 'entrada') {
    if (usuarioLogado) {
      conteudo.innerHTML = `
        <h2>Registrar Entrada</h2>
        <input id="produtoEntrada" placeholder="Nome do Produto">
        <input id="quantidadeEntrada" type="number" placeholder="Quantidade">
        <button onclick="registrarEntrada()">Registrar</button>
      `;
    } else {
      conteudo.innerHTML = `<p style="color:red">Faça login para acessar!</p>`;
    }
  }

  else if (tela === 'saida') {
    if (usuarioLogado) {
      conteudo.innerHTML = `
        <h2>Registrar Saída</h2>
        <input id="produtoSaida" placeholder="Nome do Produto">
        <input id="quantidadeSaida" type="number" placeholder="Quantidade">
        <input id="setorDestino" placeholder="Setor de Destino">
        <button onclick="registrarSaida()">Registrar</button>
      `;
    } else {
      conteudo.innerHTML = `<p style="color:red">Faça login para acessar!</p>`;
    }
  }

  else if (tela === 'saldo') {
    conteudo.innerHTML = `
      <h2>Saldo de Estoque</h2>
      <ul>
        ${produtos.map(p => 
          p.quantidade < 10 
            ? `<li class="alerta">${p.nome}: ${p.quantidade} ⚠ Estoque baixo!</li>` 
            : `<li>${p.nome}: ${p.quantidade}</li>`
        ).join('')}
      </ul>
      
      <h2>Histórico de Movimentações</h2>
      <ul>${historico.map(h => `<li>${h}</li>`).join('')}</ul>

      <button onclick="exportarPDF()">Exportar PDF</button>
      <button onclick="exportarExcel()">Exportar Excel</button>
    `;
  }

  else if (tela === 'usuarios') {
    if (usuarioLogado && usuarioLogado.perfil === "Administrador") {
      conteudo.innerHTML = `
        <h2>Gestão de Usuários</h2>
        <ul>
          ${usuarios.map(u => `
            <li>
              ${u.nome} (${u.perfil}) - ${u.ativo ? "Ativo" : "Desativado"}
              <button onclick="toggleUsuario('${u.nome}')">${u.ativo ? "Desativar" : "Ativar"}</button>
              <button onclick="promptEditarUsuario('${u.nome}')">Editar</button>
            </li>
          `).join('')}
        </ul>
        <h3>Cadastrar Novo Usuário</h3>
        <input id="novoNome" placeholder="Nome">
        <input id="novaSenha" type="password" placeholder="Senha">
        <select id="novoPerfil">
          <option>Funcionário</option>
          <option>Supervisor</option>
          <option>Administrador</option>
        </select>
        <button onclick="cadastrarUsuario()">Cadastrar</button>
      `;
    } else {
      conteudo.innerHTML = `<p style="color:red">Acesso restrito ao Administrador!</p>`;
    }
  }
}

/* -------------------------------
   Login e Logout (com bloqueio e sessão)
--------------------------------*/
async function login() {
  const usuario = document.getElementById('usuario').value;
  const senha = document.getElementById('senha').value;

  const usuarioObj = usuarios.find(u => u.nome === usuario);

  // Verifica bloqueio
  if (bloqueios[usuario] && Date.now() < bloqueios[usuario]) {
    const restante = Math.ceil((bloqueios[usuario] - Date.now()) / 1000);
    alert(`Conta bloqueada por tentativas falhas. Tente novamente em ${restante} segundos.`);
    return;
  }

  if (!usuarioObj) {
    alert("Usuário não encontrado!");
    return;
  }

  const senhaHash = await gerarHash(senha);

  if (usuarioObj.senha === senhaHash && usuarioObj.ativo) {
    usuarioLogado = usuarioObj;
    tentativasFalhas[usuario] = 0;
    delete bloqueios[usuario];
    iniciarSessao();
    alert(`Login realizado como ${usuarioObj.perfil}!`);
    document.getElementById('conteudo').innerHTML = `<h2>Bem-vindo, ${usuarioObj.perfil} ${usuarioObj.nome}!</h2>`;
  } else {
    tentativasFalhas[usuario] = (tentativasFalhas[usuario] || 0) + 1;
    if (tentativasFalhas[usuario] >= 3) {
      bloqueios[usuario] = Date.now() + (5 * 60 * 1000); // 5 minutos
      alert("Conta bloqueada por 5 minutos devido a tentativas falhas.");
    } else {
      alert("Senha incorreta ou conta desativada!");
    }
  }
}

function logout() {
  usuarioLogado = null;
  if (sessaoTimer) {
    clearTimeout(sessaoTimer);
    sessaoTimer = null;
  }
  alert("Você saiu do sistema!");
  mostrarTela('login');
}

/* -------------------------------
   Gestão de Usuários (com hash de senha)
--------------------------------*/
async function cadastrarUsuario() {
  const nome = document.getElementById('novoNome').value;
  const senha = document.getElementById('novaSenha').value;
  const perfil = document.getElementById('novoPerfil').value;

  if (!nome || !senha) {
    alert("Nome e senha são obrigatórios.");
    return;
  }

  if (usuarios.find(u => u.nome === nome)) {
    alert("Já existe um usuário com esse nome.");
    return;
  }

  const senhaHash = await gerarHash(senha);
  usuarios.push({ nome, senha: senhaHash, perfil, ativo: true });
  historico.push(`Usuário ${nome} cadastrado por ${usuarioLogado ? usuarioLogado.nome : 'sistema'} em ${new Date().toLocaleString()}`);
  resetarSessaoSeLogado();
  alert("Usuário cadastrado com sucesso!");
  mostrarTela('usuarios');
}

function toggleUsuario(nome) {
  const usuario = usuarios.find(u => u.nome === nome);
  if (usuario) {
    usuario.ativo = !usuario.ativo;
    historico.push(`Usuário ${nome} ${usuario.ativo ? 'ativado' : 'desativado'} por ${usuarioLogado ? usuarioLogado.nome : 'sistema'} em ${new Date().toLocaleString()}`);
    resetarSessaoSeLogado();
    alert(`Usuário ${nome} agora está ${usuario.ativo ? "Ativo" : "Desativado"}`);
    mostrarTela('usuarios');
  }
}

// Função auxiliar para pedir dados de edição de forma segura (não exibe senha atual)
async function promptEditarUsuario(nome) {
  const usuario = usuarios.find(u => u.nome === nome);
  if (!usuario) return;
  const novaSenha = prompt("Digite a nova senha (deixe em branco para manter):");
  const novoPerfil = prompt("Digite o novo perfil (Administrador, Funcionário, Supervisor):", usuario.perfil);
  if (novaSenha) {
    usuario.senha = await gerarHash(novaSenha);
  }
  if (novoPerfil) {
    usuario.perfil = novoPerfil;
  }
  historico.push(`Usuário ${nome} atualizado por ${usuarioLogado ? usuarioLogado.nome : 'sistema'} em ${new Date().toLocaleString()}`);
  resetarSessaoSeLogado();
  alert(`Usuário ${nome} atualizado!`);
  mostrarTela('usuarios');
}

/* -------------------------------
   Cadastro de Produto
--------------------------------*/
function cadastrarProduto() {
  if (!usuarioLogado || usuarioLogado.perfil !== "Administrador") {
    alert("Acesso restrito ao Administrador!");
    return;
  }

  const nome = document.getElementById('nome').value;
  const quantidade = parseInt(document.getElementById('quantidade').value);

  if (!nome || isNaN(quantidade)) {
    alert("Nome e quantidade válidos são obrigatórios.");
    return;
  }

  produtos.push({ nome, quantidade });
  historico.push(`Produto ${nome} cadastrado com quantidade inicial de ${quantidade} por ${usuarioLogado.nome} (${usuarioLogado.perfil}) em ${new Date().toLocaleString()}`);
  resetarSessaoSeLogado();
  alert("Produto cadastrado com sucesso!");
  mostrarTela('cadastro');
}

/* -------------------------------
   Registrar Entrada
--------------------------------*/
function registrarEntrada() {
  if (!usuarioLogado) {
    alert("Faça login para registrar entradas.");
    return;
  }

  const nome = document.getElementById('produtoEntrada').value;
  const quantidade = parseInt(document.getElementById('quantidadeEntrada').value);
  const produto = produtos.find(p => p.nome === nome);

  if (!produto) {
    alert("Produto não encontrado!");
    return;
  }
  if (isNaN(quantidade) || quantidade <= 0) {
    alert("Quantidade inválida.");
    return;
  }

  produto.quantidade += quantidade;
  historico.push(`Entrada de ${quantidade} unidades no produto ${nome} por ${usuarioLogado.nome} (${usuarioLogado.perfil}) em ${new Date().toLocaleString()}`);
  resetarSessaoSeLogado();
  alert("Entrada registrada!");
  mostrarTela('entrada');
}

/* -------------------------------
   Registrar Saída
--------------------------------*/
function registrarSaida() {
  if (!usuarioLogado) {
    alert("Faça login para registrar saídas.");
    return;
  }

  const nome = document.getElementById('produtoSaida').value;
  const quantidade = parseInt(document.getElementById('quantidadeSaida').value);
  const setor = document.getElementById('setorDestino').value;
  const produto = produtos.find(p => p.nome === nome);

  if (!produto) {
    alert("Produto não encontrado!");
    return;
  }
  if (isNaN(quantidade) || quantidade <= 0) {
    alert("Quantidade inválida.");
    return;
  }
  if (produto.quantidade < quantidade) {
    alert("Saldo insuficiente!");
    return;
  }

  // Confirmação para saídas grandes (exemplo: > 50)
  if (quantidade >= 50) {
    const confirmar = confirm(`Deseja realmente retirar ${quantidade} unidades do produto ${nome}?`);
    if (!confirmar) return;
  }

  produto.quantidade -= quantidade;
  historico.push(`Saída de ${quantidade} unidades do produto ${nome} para o setor ${setor || 'não informado'} por ${usuarioLogado.nome} (${usuarioLogado.perfil}) em ${new Date().toLocaleString()}`);
  resetarSessaoSeLogado();
  alert("Saída registrada!");
  mostrarTela('saida');
}

/* -------------------------------
   Exportação em PDF e Excel (CSV)
--------------------------------*/
function exportarPDF() {
  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    alert("Biblioteca jsPDF não encontrada. Adicione o script no HTML para exportar PDF.");
    return;
  }

  const { jsPDF } = window.jspdf || window;
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text("Histórico de Movimentações", 10, 10);

  historico.forEach((h, i) => {
    const y = 20 + (i * 8);
    if (y > 280) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text("Continuação do Histórico", 10, 10);
    }
    doc.text(`${i+1}. ${h}`, 10, 20 + (i * 8));
  });

  doc.save("historico_estoque.pdf");
}

function exportarExcel() {
  let csvContent = "data:text/csv;charset=utf-8,Índice;Movimentação\n";
  historico.forEach((h, i) => {
    // Escapa ponto e vírgula simples
    const linha = `${i+1};"${h.replace(/"/g, '""')}"\n`;
    csvContent += linha;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "historico_estoque.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* -------------------------------
   Inicialização ao carregar a página
--------------------------------*/
window.addEventListener('load', async () => {
  await initUsuarios();      // garante que senhas estejam em hash
  mostrarTela('login');      // mostra tela de login inicialmente
});