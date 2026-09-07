//pegar todos os elementoscom a classe "paciente"

var pacientes = document.querySelectorAll(".paciente");
var indiceAtual = 0;

//funcao para mostrar apenas um paciente por vez
function mostrarPaciente (indice){
    //esconder todos os pacientes
    pacientes.forEach(function(p) {p.style.display = "none";});

    //mostrar apenas o paciente do indice atual
    pacientes[indice].style.display = "block";

    //capturar os dados do paciente atual 
    var numero = pacientes[indice].querySelector(".numero").textContent;
    var nome = pacientes[indice].querySelector(".nome").textContent;
    var consultorio = pacientes[indice].querySelector(".consultorio").textContent;
    
    //texto que será falado
    var mensagem = numero + ", " + nome + ", dirigir-se ao " + consultorio;

    //reproduzir o som de alerta(bip)
    document.getElementById("bip").play();

    //usar a API de sintese de voz no navegador
    var fala = new SpeechSynthesisUtterance(mensagem);
    fala.lang = "pt-BR";
    //aguarda 1 segundo  após o bip antes da fala
    setTimeout(function() {
        speechSynthesis.speak(fala);
    }, 1000);
}

//mostrar primeiro paciente ao carregar a página
mostrarPaciente(indiceAtual);

//funcao que chama o próximo paciente
function mostrarProximo(){
    indiceAtual++;
    if (indiceAtual >= pacientes.length){
        indiceAtual = 0;
    }
    mostrarPaciente(indiceAtual);
}

//atualizar data e hora no rodapé
function atualizarDataHora(){
    var agora = new Date()
    var dataHora = agora.toLocaleDateString("pt-BR") + " - " + agora.toLocaleTimeString("pt-BR");
    document.getElementById("footer").textContent = dataHora;
}

//atualizar a cada segundo
setInterval(atualizarDataHora, 1000);
atualizarDataHora();