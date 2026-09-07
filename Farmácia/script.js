let carrinho = [];
let total = 0;
let estoques = { 1: 5, 2: 3, 3: 10 };
let historico = [];

function adicionarCarrinho(produto, preco, id) {
    if (estoques[id] > 0) {
        carrinho.push({produto, preco});
        total += preco;
        estoques[id] --;

        atualizarCarrinho();
        atualizarEstoque(id);
    }
    else {
        alert("Produto esgotado!");
    }
}

function atualizarCarrinho(){
    let lista = document.getElementById("listaCarrinho");

    lista.innerHTML = "";

    carrinho.forEach(item => {
        let li = document.createElement("li");

        li.textContent = item.produto + " - R$ " + item.preco;
        lista.appendChild(li);
    });

    document.getElementById("total").textContent = total;
    textContent = total;
}

function atualizarEstoque(id){
    document.getElementById("estoque" + id).textContent = estoques[id];
}

document.getElementById("formCliente").addEventListener("submit", function (event){
    event.preventDefault();

    if (carrinho.length === 0){
        alert("Seu carrinho está vazio!");
    }

    let nome = document.getElementById("nome").value;
    let cpf = document.getElementById("cpf").value;
    let telefone = document.getElementById("telefone").value;

    let compra = {
        cliente: {nome, cpf, telefone},
        itens: [...carrinho],
        total: total
    };

    historico.push(compra);
    atualizarHistorico();

    alert("Compra finalizada!\nCliente: " + nome + "\nCPF: " + cpf + "\nTelefone: " + telefone + "\nTotal: R$ " + total);

    carrinho = [];
    total = 0;
    atualizarCarrinho();
    document.getElementById("formCliente").reset();
});

function atualizarHistorico() {
    let lista = document.getElementById("listaHistorico");

    lista.innerHTML = "";

    historico.forEach((compra, index) => {
        let div = document.createElement("div");
        div.style.marginBottom = "15px";
        div.innerHTML =  "<strong>Compra " + (index+1) + "</strong><br>" + "Cliente: " + compra.cliente.nome + " | CPF: " + compra.cliente.cpf + " | Tel: " + compra.cliente.telefone + "<br>" + "Total: R$ " + compra.total + "<br>" + "<em>Itens:</em><ul>" + compra.itens.map(item => "<li>" + item.produto + "- R$ " + item.preco + "</li>").join("") + "</ul>";
    
    lista.appendChild(div);
    });
}