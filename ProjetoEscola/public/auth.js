const token = localStorage.getItem('token');
const papel = localStorage.getItem('papel');

if (!token) window.location.href = 'index.html';

document.addEventListener('DOMContentLoaded', () => {
    const nomeElement = document.getElementById('nome-usuario');
    if (nomeElement) nomeElement.textContent = localStorage.getItem('nome');
});

function sair() {
    localStorage.removeItem('token');
    localStorage.removeItem('papel');
    localStorage.removeItem('nome');
    window.location.href = 'index.html';
}
