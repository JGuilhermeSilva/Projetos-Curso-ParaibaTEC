require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

async function initDatabase() {
    try {
        const admin = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@escola.com']);
        if (admin.rowCount === 0) {
            const hash = bcrypt.hashSync('admin123', 10);
            await pool.query(
                'INSERT INTO users (nome, email, senha, papel) VALUES ($1, $2, $3, $4)',
                ['Diretor Geral', 'admin@escola.com', hash, 'diretor']
            );
            console.log('✅ Diretor padrão criado: admin@escola.com / admin123');
        }
    } catch (err) {
        console.error('Erro ao conectar no Supabase:', err.message);
        process.exit(1);
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token não fornecido!' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido ou expirado!' });
        req.user = user;
        next();
    });
}

function isDirecao(req, res, next) {
    if (req.user.papel !== 'diretor' && req.user.papel !== 'direcao') {
        return res.status(403).json({ message: 'Acesso negado! Apenas a Direção.' });
    }
    next();
}

function isProfessor(req, res, next) {
    if (req.user.papel !== 'professor') {
        return res.status(403).json({ message: 'Acesso negado! Apenas Professores.' });
    }
    next();
}

// ========== AUTENTICAÇÃO ==========
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user || !bcrypt.compareSync(senha, user.senha)) return res.status(401).json({ message: 'Credenciais inválidas!' });
        if (user.papel === 'aluno') return res.status(403).json({ message: 'Acesso restrito a Professores e Direção.' });
        const token = jwt.sign({ id: user.id, nome: user.nome, papel: user.papel }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, nome: user.nome, papel: user.papel });
    } catch (err) {
        res.status(500).json({ message: 'Erro no servidor', error: err.message });
    }
});

// ========== ROTAS DA DIREÇÃO: USUÁRIOS ==========
app.get('/users', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, email, papel FROM users ORDER BY nome');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar usuários', error: err.message });
    }
});
app.post('/users', authenticateToken, isDirecao, async (req, res) => {
    const {
        nome, email, papel, disciplinas, senha,
        grec, unidade, municipio, sexo, raca, data_nascimento, periodo, ano, nivel_ensino,
        natural_de, uf, registro_nascimento, livro, folha, data_emissao_rg, numero_rg,
        orgao_expedidor, cpf, nis, cartao_sus, regiao, transporte_escolar, necessidade_especial,
        autorizacao_imagem, nome_pai, profissao_pai, nome_mae, profissao_mae, endereco,
        telefone, renda_familiar, bolsa_familia, nome_responsavel, profissao_responsavel,
        matricula  // <-- FALTAVA ESSA LINHA
    } = req.body;

    // Padroniza valores booleanos e strings vazias para null
    const tratarCampo = (valor) => (valor === '' || valor === undefined ? null : valor);
    const tratarBoolean = (valor) => (valor === 'true' || valor === true ? true : false);

    if (!nome || !email || !['professor', 'direcao', 'aluno'].includes(papel)) {
        return res.status(400).json({ message: 'Dados inválidos. Papel não permitido.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const exists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exists.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
        }


        let senhaFinal = senha;
        if (!senhaFinal || senhaFinal === '') {
            senhaFinal = Math.random().toString(36).slice(-8);
        }
        const hash = bcrypt.hashSync(senhaFinal, 10);

        const result = await client.query(
            'INSERT INTO users (nome, email, senha, papel) VALUES ($1, $2, $3, $4) RETURNING id',
            [nome, email, hash, papel]
        );
        const newUserId = result.rows[0].id;

        // Agora passamos todos os campos, incluindo matricula
        await client.query(
            `INSERT INTO perfis 
      (user_id, matricula, data_nascimento, sexo, raca, periodo, ano, nivel_ensino, natural_de, uf, registro_nascimento, livro, folha, data_emissao_rg, numero_rg, orgao_expedidor, cpf, nis, cartao_sus, regiao, transporte_escolar, necessidade_especial, autorizacao_imagem, nome_pai, profissao_pai, nome_mae, profissao_mae, endereco, telefone, renda_familiar, bolsa_familia, nome_responsavel, profissao_responsavel)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)`,
            [newUserId,
                tratarCampo(matricula), tratarCampo(data_nascimento), tratarCampo(sexo), tratarCampo(raca),
                tratarCampo(periodo), tratarCampo(ano), tratarCampo(nivel_ensino), tratarCampo(natural_de), tratarCampo(uf),
                tratarCampo(registro_nascimento), tratarCampo(livro), tratarCampo(folha), tratarCampo(data_emissao_rg),
                tratarCampo(numero_rg), tratarCampo(orgao_expedidor), tratarCampo(cpf), tratarCampo(nis), tratarCampo(cartao_sus),
                tratarCampo(regiao), tratarBoolean(transporte_escolar), tratarCampo(necessidade_especial), tratarBoolean(autorizacao_imagem),
                tratarCampo(nome_pai), tratarCampo(profissao_pai), tratarCampo(nome_mae), tratarCampo(profissao_mae),
                tratarCampo(endereco), tratarCampo(telefone), tratarCampo(renda_familiar), tratarBoolean(bolsa_familia),
                tratarCampo(nome_responsavel), tratarCampo(profissao_responsavel)]
        );

        if (papel === 'professor' && disciplinas && disciplinas.length > 0) {
            for (const nomeDisc of disciplinas) {
                const nomeLimpo = nomeDisc.trim();
                if (!nomeLimpo) continue;
                const discExistente = await client.query('SELECT id, professor_id FROM disciplinas WHERE nome = $1', [nomeLimpo]);
                if (discExistente.rowCount > 0) {
                    if (discExistente.rows[0].professor_id !== newUserId) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `Disciplina "${nomeLimpo}" já atribuída a outro professor.` });
                    }
                } else {
                    await client.query('INSERT INTO disciplinas (nome, professor_id) VALUES ($1, $2)', [nomeLimpo, newUserId]);
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuário criado com sucesso!', id: newUserId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ERRO DETALHADO NO CADASTRO:', err.message);
        res.status(500).json({ message: 'Erro ao cadastrar', error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/users/:id', authenticateToken, isDirecao, async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'Não pode apagar a si mesmo!' });
    try {
        const user = await pool.query('SELECT papel FROM users WHERE id = $1', [id]);
        if (user.rowCount === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
        const papel = user.rows[0].papel;
        if (papel === 'professor') {
            await pool.query('DELETE FROM disciplinas WHERE professor_id = $1', [id]);
            await pool.query('DELETE FROM turmas WHERE professor_id = $1', [id]);
        } else if (papel === 'aluno') {
            await pool.query('DELETE FROM matriculas WHERE aluno_id = $1', [id]);
            await pool.query('DELETE FROM notas WHERE aluno_id = $1', [id]);
        }
        await pool.query('DELETE FROM perfis WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'Usuário excluído!' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao deletar', error: err.message });
    }
});

// ========== ROTAS DA DIREÇÃO: TURMAS ==========
app.get('/api/turmas', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT t.id, t.nome, t.ano_letivo, u.nome AS professor_nome, u.id AS professor_id
      FROM turmas t
      LEFT JOIN users u ON t.professor_id = u.id
      ORDER BY t.nome
    `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar turmas', error: err.message });
    }
});

app.post('/api/turmas', authenticateToken, isDirecao, async (req, res) => {
    const { nome, ano_letivo, professor_id } = req.body;
    if (!nome || !professor_id) return res.status(400).json({ message: 'Nome e professor são obrigatórios.' });
    try {
        const result = await pool.query(
            'INSERT INTO turmas (nome, ano_letivo, professor_id) VALUES ($1, $2, $3) RETURNING *',
            [nome, ano_letivo || new Date().getFullYear(), professor_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao criar turma', error: err.message });
    }
});

app.delete('/api/turmas/:id', authenticateToken, isDirecao, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM turmas WHERE id = $1', [id]);
        res.json({ message: 'Turma excluída!' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao excluir turma', error: err.message });
    }
});

// ========== ROTAS DA DIREÇÃO: MATRÍCULAS ==========
app.get('/api/turmas/:id/alunos', authenticateToken, isDirecao, async (req, res) => {
    const { id } = req.params;
    try {
        const alunos = await pool.query(`
      SELECT u.id, u.nome, u.email, p.matricula
      FROM matriculas m
      JOIN users u ON m.aluno_id = u.id
      LEFT JOIN perfis p ON u.id = p.user_id
      WHERE m.turma_id = $1
      ORDER BY u.nome
    `, [id]);
        res.json(alunos.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar alunos da turma', error: err.message });
    }
});

app.post('/api/turmas/:id/matricular', authenticateToken, isDirecao, async (req, res) => {
    const { id } = req.params;
    const { aluno_id } = req.body;
    if (!aluno_id) return res.status(400).json({ message: 'Aluno é obrigatório.' });
    try {
        await pool.query('INSERT INTO matriculas (aluno_id, turma_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [aluno_id, id]);
        res.status(201).json({ message: 'Aluno matriculado!' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao matricular', error: err.message });
    }
});

app.delete('/api/turmas/:id/matricular/:alunoId', authenticateToken, isDirecao, async (req, res) => {
    const { id, alunoId } = req.params;
    try {
        await pool.query('DELETE FROM matriculas WHERE turma_id = $1 AND aluno_id = $2', [id, alunoId]);
        res.json({ message: 'Aluno removido da turma (dados mantidos!)' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover aluno', error: err.message });
    }
});

// ========== ROTAS DE LISTAGEM PARA O DIRETOR ==========
app.get('/api/diretor/alunos', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT u.id, u.nome, u.email, p.matricula, p.data_nascimento, p.responsavel
      FROM users u
      LEFT JOIN perfis p ON u.id = p.user_id
      WHERE u.papel = 'aluno' ORDER BY u.nome
    `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar alunos', error: err.message });
    }
});

app.get('/api/diretor/professores', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT u.id, u.nome, u.email, p.matricula,
             COALESCE(array_agg(d.nome) FILTER (WHERE d.nome IS NOT NULL), '{}') AS disciplinas
      FROM users u
      LEFT JOIN perfis p ON u.id = p.user_id
      LEFT JOIN disciplinas d ON d.professor_id = u.id
      WHERE u.papel = 'professor'
      GROUP BY u.id, u.nome, u.email, p.matricula
      ORDER BY u.nome
    `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar professores', error: err.message });
    }
});

// ========== ROTAS DO PROFESSOR ==========
app.get('/professor/turmas', authenticateToken, isProfessor, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM turmas WHERE professor_id = $1 ORDER BY nome', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar turmas', error: err.message });
    }
});

app.get('/professor/disciplinas', authenticateToken, isProfessor, async (req, res) => {
    try {
        const result = await pool.query('SELECT nome FROM disciplinas WHERE professor_id = $1 ORDER BY nome', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar disciplinas', error: err.message });
    }
});

app.get('/professor/turmas/:id/alunos', authenticateToken, isProfessor, async (req, res) => {
    const { id } = req.params;
    try {
        const turma = await pool.query('SELECT * FROM turmas WHERE id = $1 AND professor_id = $2', [id, req.user.id]);
        if (turma.rowCount === 0) return res.status(404).json({ message: 'Turma não encontrada.' });
        const alunos = await pool.query(`
      SELECT u.id, u.nome, u.email,
             COALESCE((SELECT n.nota FROM notas n WHERE n.aluno_id = u.id AND n.turma_id = $1 AND n.bimestre = 1), '') AS nota_b1,
             COALESCE((SELECT n.nota FROM notas n WHERE n.aluno_id = u.id AND n.turma_id = $1 AND n.bimestre = 2), '') AS nota_b2,
             COALESCE((SELECT n.nota FROM notas n WHERE n.aluno_id = u.id AND n.turma_id = $1 AND n.bimestre = 3), '') AS nota_b3,
             COALESCE((SELECT n.nota FROM notas n WHERE n.aluno_id = u.id AND n.turma_id = $1 AND n.bimestre = 4), '') AS nota_b4
      FROM matriculas m
      JOIN users u ON m.aluno_id = u.id
      WHERE m.turma_id = $1 ORDER BY u.nome
    `, [id]);
        res.json({ turma: turma.rows[0], alunos: alunos.rows });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar alunos', error: err.message });
    }
});

app.post('/professor/notas', authenticateToken, isProfessor, async (req, res) => {
    const { turma_id, aluno_id, bimestre, nota } = req.body;
    if (!turma_id || !aluno_id || !bimestre || nota === '') return res.status(400).json({ message: 'Dados incompletos.' });
    try {
        const turma = await pool.query('SELECT id FROM turmas WHERE id = $1 AND professor_id = $2', [turma_id, req.user.id]);
        if (turma.rowCount === 0) return res.status(404).json({ message: 'Turma não encontrada.' });
        await pool.query(`INSERT INTO notas (aluno_id, turma_id, bimestre, nota) VALUES ($1, $2, $3, $4)
      ON CONFLICT (aluno_id, turma_id, bimestre) DO UPDATE SET nota = EXCLUDED.nota`, [aluno_id, turma_id, bimestre, nota]);
        res.json({ message: 'Nota salva com sucesso!' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao salvar nota', error: err.message });
    }
});

// ========== INICIAR ==========
initDatabase().then(() => {
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
});