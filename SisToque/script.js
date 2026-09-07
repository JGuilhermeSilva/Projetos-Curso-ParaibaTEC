// ---------------- CONFIGURAÇÃO DE USUÁRIOS ----------------
const usuarios = [
  { nome: "admin", senha: "1234", role: "admin" }, // administrador
  { nome: "user", senha: "1234", role: "user" }, // usuário comum
];

// ---------------- INICIALIZAÇÃO ----------------
if (!localStorage.getItem("produtos"))
  localStorage.setItem("produtos", JSON.stringify([]));
if (!localStorage.getItem("movimentacoes"))
  localStorage.setItem("movimentacoes", JSON.stringify([]));

const pagina = window.location.pathname.split("/").pop();

// ---------------- LOGIN ----------------
if (pagina === "login.html") {
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;
    const user = usuarios.find((u) => u.nome === nome && u.senha === senha);
    if (user) {
      localStorage.setItem("usuarioLogado", JSON.stringify(user));
      window.location.href = "dashboard.html"; // redireciona para o painel
    } else {
      alert("Usuário ou senha inválidos!");
    }
  });
}

// ---------------- DASHBOARD ----------------
if (pagina === "dashboard.html") {
  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!user) window.location.href = "login.html"; // força login

  document.getElementById("bemvindo").textContent =
    `Bem-vindo, ${user.nome} (${user.role})`;
  atualizarProdutos();

  document.getElementById("movForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const produtoNome = document.getElementById("produtoSelect").value;
    const tipo = document.getElementById("tipoMov").value;
    const quantidade = parseInt(document.getElementById("quantidadeMov").value);
    const setor = document.getElementById("setorMov").value;

    let produtos = JSON.parse(localStorage.getItem("produtos"));
    let produto = produtos.find((p) => p.nome === produtoNome);
    if (!produto) return alert("Produto não encontrado!");

    // Atualiza estoque
    if (tipo === "entrada") produto.quantidade += quantidade;
    else if (tipo === "saida") {
      if (produto.quantidade < quantidade)
        return alert("Estoque insuficiente!");
      produto.quantidade -= quantidade;
    }
    localStorage.setItem("produtos", JSON.stringify(produtos));

    // Registra movimentação com data e hora
    let movimentacoes = JSON.parse(localStorage.getItem("movimentacoes"));
    movimentacoes.push({
      produto: produtoNome,
      tipo,
      quantidade,
      setor,
      data: new Date().toLocaleString("pt-BR"), // data e hora formatadas
    });
    localStorage.setItem("movimentacoes", JSON.stringify(movimentacoes));

    atualizarProdutos();
    alert("Movimentação registrada!");
  });
}

// ---------------- CADASTRO ----------------
if (pagina === "cadastro.html") {
  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!user || user.role !== "admin") {
    alert("Acesso restrito a administradores!");
    window.location.href = "dashboard.html";
  }

  document.getElementById("produtoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const produto = {
      nome: document.getElementById("nomeProduto").value,
      codigo: document.getElementById("codigoProduto").value,
      categoria: document.getElementById("categoriaProduto").value,
      preco: parseFloat(document.getElementById("precoProduto").value),
      quantidade: parseInt(document.getElementById("quantidadeProduto").value),
      setor: document.getElementById("setorProduto").value,
    };
    let produtos = JSON.parse(localStorage.getItem("produtos"));
    produtos.push(produto);
    localStorage.setItem("produtos", JSON.stringify(produtos));
    alert("Produto cadastrado!");
  });
}

// ---------------- RELATÓRIOS ----------------
if (pagina === "relatorios.html") {
  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!user) window.location.href = "login.html";

  // Relatório de produtos em falta
  window.relatorioFalta = function () {
    let produtos = JSON.parse(localStorage.getItem("produtos"));
    let faltando = produtos.filter((p) => p.quantidade <= 0);
    renderTable(
      ["Nome", "Código", "Categoria", "Preço", "Quantidade", "Setor"],
      faltando,
    );
  };

  // Relatório de movimentações
  window.relatorioMov = function () {
    let movimentacoes = JSON.parse(localStorage.getItem("movimentacoes"));
    renderTable(
      ["Produto", "Tipo", "Quantidade", "Setor", "Data"],
      movimentacoes,
    );
  };

  // Relatório de valor total em estoque
  window.relatorioValor = function () {
    let produtos = JSON.parse(localStorage.getItem("produtos"));
    let total = produtos.reduce((sum, p) => sum + p.preco * p.quantidade, 0);

    // formata como moeda brasileira
    let totalFormatado = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    renderTable(
      ["Valor Total em Estoque"],
      [{ "Valor Total em Estoque": totalFormatado }],
    );
  };

  // Função para renderizar tabela
  function renderTable(headers, data) {
    let headerRow = document.getElementById("relatorioHeader");
    let tbody = document.querySelector("#relatorioTable tbody");
    headerRow.innerHTML = "";
    tbody.innerHTML = "";

    headers.forEach((h) => {
      let th = document.createElement("th");
      th.textContent = h;
      headerRow.appendChild(th);
    });

    data.forEach((item) => {
      let tr = document.createElement("tr");
      headers.forEach((h) => {
        let td = document.createElement("td");
        if (h === "Nome") td.textContent = item.nome;
        else if (h === "Código") td.textContent = item.codigo;
        else if (h === "Categoria") td.textContent = item.categoria;
        else if (h === "Preço") td.textContent = item.preco;
        else if (h === "Quantidade") td.textContent = item.quantidade;
        else if (h === "Setor") td.textContent = item.setor;
        else if (h === "Produto") td.textContent = item.produto;
        else if (h === "Tipo") td.textContent = item.tipo;
        else if (h === "Data") td.textContent = item.data;
        else td.textContent = item[h] !== undefined ? item[h] : "";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
}

// ---------------- FUNÇÕES COMUNS ----------------
function atualizarProdutos() {
  let produtos = JSON.parse(localStorage.getItem("produtos"));
  let select = document.getElementById("produtoSelect");
  if (!select) return;
  select.innerHTML = "";
  produtos.forEach((p) => {
    let opt = document.createElement("option");
    opt.value = p.nome;
    opt.textContent = `${p.nome} (Qtd: ${p.quantidade})`;
    select.appendChild(opt);
  });
}

// ---------------- LOGOUT ----------------
const logoutLink = document.getElementById("logout");
if (logoutLink) {
  logoutLink.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("usuarioLogado"); // limpa sessão
    window.location.href = "login.html"; // volta para login
  });
}
