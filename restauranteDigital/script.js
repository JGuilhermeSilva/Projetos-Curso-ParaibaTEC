let carrinho = [],
total = 0,
estoques = {1:5, 2:8, 3:10, 4:6, 5:4, 6:5, 7:10, 8:8, 9:4, 10:9, 11:10, 12:7, 13:14},
historico = [],
avaliacoes = [],
contadorPratos = 13;

//funcao para mostrar notificacoes
function mostrarNotificacao(msg, tipo) {
    let n = document.getElementById("notificacao")
    n.textContent = msg;
    n.className = "notificacao" + tipo;
    n.style.display = "block";
    setTimeout(() => {
        n.style.display = "none";
    }, 3000);
}

//funcao para adicionar um prato ao carrinho
function adicionarCarrinho(prato, preco, id) {
    if (estoques[id] > 0) {
        carrinho.push({prato, preco});
        total += preco;
        estoques[id]--;
        atualizarCarrinho();

        document.getElementById("estoque" + id).textContent = estoques[id];
    }
    else {
        mostrarNotificacao("Prato indisponível!", "erro");
    }
}

//funcao para atualizar a lista do carrinho
function atualizarCarrinho() {
    let lista = document.getElementById("listaCarrinho");

    lista.innerHTML="";

    carrinho.forEach(item => {
        let li = document.createElement("li");
        li.textContent = item.prato + " - R$ " + item.preco.toFixed(2);

        lista.appendChild(li);

        document.getElementById("total").textContent = total.toFixed(2);
    });
}

//evento para finalizar o pedido do cliente
document.getElementById("formCliente").addEventListener("submit", function(e) {
    e.preventDefault();

    if (carrinho.length === 0) {
        mostrarNotificacao("Pedido vazio!", "erro");
        return;
    }
    //pegando os dados dos clientes
    let nome = document.getElementById("nome").value,
    telefone = document.getElementById("telefone").value,
    mesa = document.getElementById("mesa").value;

    //criar um objeto pedido
    let pedido = {
        cliente: {nome, telefone, mesa}, itens:[...carrinho], total
    };

    historico.push(pedido);
    atualizarHistorico();
    mostrarNotificacao("Pedido Finalizado", "sucesso");
    carrinho = []; total = 0;
    atualizarCarrinho();
    this.reset();
});

//funcao para atualizar o historico de pedidos
function atualizarHistorico() {
    let lista = document.getElementById("listaHistorico");

    lista.innerHTML = "";

    historico.forEach((p, i) => {
        let div = document.createElement("div");
        div.innerHTML = "<strong>Pedido " + (i+1) + "</strong> <br>Cliente: " + p.cliente.nome + " | Mesa: " + p.cliente.mesa + "<br> Total: R$ " + p.total.toFixed(2);
        lista.appendChild(div);
    });
}

//funcao para registrar avaliacao(cliente)
function avaliar() {
    let comentario = document.getElementById("comentario").value;
    let estrelas = document.getElementById("estrelas").value;

    if (estrelas < 1 || estrelas > 5) {
        mostrarNotificacao("Nota inválida", "erro");
        return;
    }
    avaliacoes.push({comentario, estrelas});
    let lista = document.getElementById("listaAvaliacoes");

    let div = document.createElement("div");

    div.textContent = String.fromCodePoint(9734).repeat(estrelas) + " - " + comentario;
    lista.appendChild(div);

    mostrarNotificacao("Avaliacao registrada", "sucesso");

    document.getElementById("comentario").value = "";

    document.getElementById("estrelas").value = "";
}

//funcao de gerar relatorio
function gerarRelatorio(){
    let totalVendas = historico.reduce((acc, p) => acc + p.total, 0 );

    let pratosVendidos = {};

    historico.forEach(p => p.itens.forEach(i => {
        pratosVendidos[i.prato] = (pratosVendidos[i.prato] || 0) + 1; 
    }));

    let dados = document.getElementById("dadosRelatorio");
    dados.innerHTML = "Total de vendas: R$ " + totalVendas.toFixed(2) + "<br> Pratos vendidos:<br>";

    for (let prato in pratosVendidos) {
        dados.innerHTML += prato + ": " + pratosVendidos[prato] + "<br>";
    }
}

//funcao para entrar no modo administrador

function entrarSenha() {
    let senha = document.getElementById("senhaAdmin").value;

    if (senha === "admin123") {
        document.getElementById("painelAdmin").style.display = "block";
        mostrarNotificacao("Modo administrador ativado", "sucesso");
    }
    else {
        mostrarNotificacao("Senha incorreta!", "erro");
    }
}

//funcao para adicionar novo prato ao cardapio
function adicionarPrato(){
    let nome = document.getElementById("novoPrato").value;
    let preco = parseFloat(document.getElementById("precoPrato").value);
    let estoque = parseInt(document.getElementById("estoquePrato").value);

    if (!nome || isNaN(preco) || isNaN(estoque)) {
        mostrarNotificacao("Dados inválidos!", "erro");
        return;
    }

    contadorPratos ++;
    estoques[contadorPratos] = estoque;

    let cardapio = document.getElementById("cardapio");
    let div = document.createElement("div");
    div.className = "prato";

    //criar html do novo prato
    //correcao
    div.innerHTML = "<img src='default.jpg' alt='" + nome + "' class='foto-prato'> <h3>" + nome + "</h3><p> Preço: R$ " + preco.toFixed(2) + "</p><p>Disponível: <span id='estoque" + contadorPratos + "'>" + estoques[contadorPratos] + "</span></p><button onclick=\"adicionarCarrinho('" + nome + "', " + preco + ", " + contadorPratos + ")\">ADICIONAR</button>";

    cardapio.appendChild(div);

    mostrarNotificacao("Prato adicionado!", "sucesso");

    //limpar os campos do formulario do admin
    document.getElementById("novoPrato").value = "";
    document.getElementById("precoPrato").value = "";
    document.getElementById("estoquePrato").value = "";
}