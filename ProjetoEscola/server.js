require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
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

const profileUploadDirectory = path.join(__dirname, 'public', 'uploads', 'profiles');
fs.mkdirSync(profileUploadDirectory, { recursive: true });
const profileStorage = multer.diskStorage({
    destination: profileUploadDirectory,
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `aluno-${req.params.id}-${Date.now()}${extension}`);
    }
});
const uploadProfilePhoto = multer({
    storage: profileStorage,
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            return callback(new Error('A imagem precisa estar em JPG, PNG ou WEBP.'));
        }
        callback(null, true);
    }
});

async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS diario_aulas (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
                professor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                data_aula DATE NOT NULL,
                conteudo TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS frequencias (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
                aluno_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                data_aula DATE NOT NULL,
                status VARCHAR(20) NOT NULL CHECK (status IN ('presente', 'ausente', 'justificada')),
                observacao TEXT,
                UNIQUE (turma_id, aluno_id, data_aula)
            );
            CREATE TABLE IF NOT EXISTS documentos_alunos (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                aluno_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                nome VARCHAR(160) NOT NULL,
                tipo VARCHAR(80) NOT NULL,
                caminho TEXT NOT NULL,
                enviado_por INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS fichas_inscricao (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                aluno_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(30) NOT NULL DEFAULT 'pendente',
                observacoes TEXT,
                atualizado_por INTEGER REFERENCES users(id),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS avatar_url TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS grec TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS unidade TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS municipio TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS unidade_uf CHAR(2) DEFAULT 'PB';
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS decreto_criacao TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS responsavel_endereco TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS responsavel_municipio TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS responsavel_uf TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS necessidades_alimentares TEXT;
            ALTER TABLE perfis ADD COLUMN IF NOT EXISTS observacoes TEXT;
            CREATE TABLE IF NOT EXISTS escolas (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                nome VARCHAR(180) NOT NULL UNIQUE,
                sigla VARCHAR(30) NOT NULL UNIQUE,
                tipo VARCHAR(40) NOT NULL,
                municipio VARCHAR(100) NOT NULL DEFAULT 'Frei Martinho',
                uf CHAR(2) NOT NULL DEFAULT 'PB',
                decreto_criacao VARCHAR(100),
                ativa BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            INSERT INTO escolas (nome, sigla, tipo, decreto_criacao) VALUES
                ('EMEF Eliete Souza de Araújo Silva', 'EMEF-ELIETE', 'Ensino Fundamental', '004/93'),
                ('EMEF João Fernandes Falcão', 'EMEF-JOAO', 'Ensino Fundamental', NULL),
                ('CEI Antônia Jardelina da Silva', 'CEI-ANTONIA', 'Educação Infantil', NULL)
            ON CONFLICT (nome) DO NOTHING;
            ALTER TABLE turmas ADD COLUMN IF NOT EXISTS escola_id INTEGER REFERENCES escolas(id);
            CREATE TABLE IF NOT EXISTS disciplinas_escolares (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                nome VARCHAR(120) NOT NULL,
                codigo VARCHAR(30),
                carga_horaria INTEGER,
                escola_id INTEGER REFERENCES escolas(id),
                ativa BOOLEAN NOT NULL DEFAULT TRUE,
                UNIQUE (nome, escola_id)
            );
            CREATE TABLE IF NOT EXISTS notas_academicas (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                aluno_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
                disciplina_id INTEGER NOT NULL REFERENCES disciplinas_escolares(id),
                ano_letivo INTEGER NOT NULL,
                bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 4),
                nota NUMERIC(5,2) CHECK (nota BETWEEN 0 AND 10),
                conceito VARCHAR(30),
                updated_by INTEGER REFERENCES users(id),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (aluno_id, turma_id, disciplina_id, ano_letivo, bimestre)
            );
            CREATE TABLE IF NOT EXISTS historico_escolar (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                aluno_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                escola_id INTEGER REFERENCES escolas(id),
                ano_letivo INTEGER NOT NULL,
                serie VARCHAR(60),
                disciplina_id INTEGER REFERENCES disciplinas_escolares(id),
                carga_horaria INTEGER,
                media_final NUMERIC(5,2),
                frequencia_percentual NUMERIC(5,2),
                situacao VARCHAR(30),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (aluno_id, ano_letivo, disciplina_id)
            );
            CREATE TABLE IF NOT EXISTS auditoria (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                acao VARCHAR(40) NOT NULL,
                entidade VARCHAR(80) NOT NULL,
                entidade_id INTEGER,
                dados_anteriores JSONB,
                dados_novos JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            INSERT INTO disciplinas_escolares (nome, codigo, carga_horaria) VALUES
                ('Língua Portuguesa', 'LP', 200), ('Matemática', 'MAT', 200), ('Ciências', 'CIE', 120),
                ('História', 'HIS', 120), ('Geografia', 'GEO', 120), ('Arte', 'ART', 80),
                ('Educação Física', 'EDF', 80), ('Ensino Religioso', 'ER', 40), ('Língua Estrangeira', 'LE', 80)
            ON CONFLICT (nome, escola_id) DO NOTHING;
            ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS escola_id INTEGER REFERENCES escolas(id);
            ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS ano_letivo INTEGER;
            ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS serie VARCHAR(60);
            ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS data_matricula DATE NOT NULL DEFAULT CURRENT_DATE;
            ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS data_saida DATE;
            ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS status VARCHAR(25) NOT NULL DEFAULT 'ativa';
            ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS motivo_saida VARCHAR(80);
            UPDATE matriculas SET ano_letivo = EXTRACT(YEAR FROM CURRENT_DATE)::integer WHERE ano_letivo IS NULL;
            UPDATE matriculas SET escola_id = (SELECT id FROM escolas ORDER BY id LIMIT 1) WHERE escola_id IS NULL;
            UPDATE turmas SET escola_id = (SELECT id FROM escolas ORDER BY id LIMIT 1) WHERE escola_id IS NULL;
        `);
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
        grec, unidade, municipio, unidade_uf, decreto_criacao, sexo, raca, data_nascimento, periodo, ano, nivel_ensino,
        natural_de, uf, registro_nascimento, livro, folha, data_emissao_rg, numero_rg,
        orgao_expedidor, cpf, nis, cartao_sus, regiao, transporte_escolar, necessidade_especial,
        autorizacao_imagem, necessidades_alimentares, nome_pai, profissao_pai, nome_mae, profissao_mae, endereco,
        telefone, renda_familiar, bolsa_familia, nome_responsavel, profissao_responsavel,
        responsavel_endereco, responsavel_municipio, responsavel_uf, observacoes, matricula
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
        await client.query(
            'UPDATE perfis SET grec = $1, unidade = $2, municipio = $3, unidade_uf = $4 WHERE user_id = $5',
            [tratarCampo(grec), tratarCampo(unidade), tratarCampo(municipio), tratarCampo(unidade_uf), newUserId]
        );
        await client.query(
            `UPDATE perfis SET decreto_criacao = $1, necessidades_alimentares = $2,
                 responsavel_endereco = $3, responsavel_municipio = $4, responsavel_uf = $5, observacoes = $6
                 WHERE user_id = $7`,
            [tratarCampo(decreto_criacao), tratarCampo(necessidades_alimentares), tratarCampo(responsavel_endereco),
            tratarCampo(responsavel_municipio), tratarCampo(responsavel_uf), tratarCampo(observacoes), newUserId]
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

async function excluirPorColunaSeExistir(client, tabela, coluna, valor) {
    const colunaExiste = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [tabela, coluna]
    );
    if (colunaExiste.rowCount > 0) {
        await client.query(`DELETE FROM ${tabela} WHERE ${coluna} = $1`, [valor]);
    }
}

app.delete('/users/:id', authenticateToken, isDirecao, async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'Não pode apagar a si mesmo!' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const user = await client.query('SELECT papel FROM users WHERE id = $1 FOR UPDATE', [id]);
        if (user.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const papel = user.rows[0].papel;

        await client.query('DELETE FROM documentos_alunos WHERE aluno_id = $1 OR enviado_por = $1', [id]);
        await client.query('DELETE FROM fichas_inscricao WHERE aluno_id = $1 OR atualizado_por = $1', [id]);
        if (papel === 'professor') {
            const turmas = await client.query('SELECT id FROM turmas WHERE professor_id = $1', [id]);
            for (const turma of turmas.rows) {
                await excluirPorColunaSeExistir(client, 'diario_aulas', 'turma_id', turma.id);
                await excluirPorColunaSeExistir(client, 'diario_aulas', 'professor_id', id);
                await excluirPorColunaSeExistir(client, 'diarios', 'turma_id', turma.id);
                await excluirPorColunaSeExistir(client, 'diarios', 'professor_id', id);
                await excluirPorColunaSeExistir(client, 'frequencias', 'turma_id', turma.id);
                await excluirPorColunaSeExistir(client, 'frequencias', 'professor_id', id);
                await excluirPorColunaSeExistir(client, 'notas', 'turma_id', turma.id);
                await client.query('DELETE FROM matriculas WHERE turma_id = $1', [turma.id]);
            }
            await client.query('DELETE FROM turmas WHERE professor_id = $1', [id]);
            await client.query('DELETE FROM disciplinas WHERE professor_id = $1', [id]);
        } else if (papel === 'aluno') {
            await excluirPorColunaSeExistir(client, 'frequencias', 'aluno_id', id);
            await client.query('DELETE FROM notas WHERE aluno_id = $1', [id]);
            await client.query('DELETE FROM matriculas WHERE aluno_id = $1', [id]);
        }
        await client.query('DELETE FROM perfis WHERE user_id = $1', [id]);
        await client.query('DELETE FROM users WHERE id = $1', [id]);
        await client.query('COMMIT');
        await registrarAuditoria(req.user.id, 'DELETE', 'user', Number(id), { papel, id: Number(id) }, null);
        res.json({ message: 'Usuário excluído!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ERRO AO EXCLUIR USUÁRIO:', err.message);
        res.status(500).json({ message: 'Erro ao deletar', error: err.message });
    } finally {
        client.release();
    }
});

// ========== ROTAS DA DIREÇÃO: TURMAS ==========
app.get('/api/escolas', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, sigla, tipo, municipio, uf, decreto_criacao FROM escolas WHERE ativa = TRUE ORDER BY nome');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar escolas', error: err.message });
    }
});

app.get('/api/turmas', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT t.id, t.nome, t.ano_letivo, t.escola_id, e.nome AS escola_nome, u.nome AS professor_nome, u.id AS professor_id
      FROM turmas t
      LEFT JOIN escolas e ON e.id = t.escola_id
      LEFT JOIN users u ON t.professor_id = u.id
      ORDER BY t.nome
    `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar turmas', error: err.message });
    }
});

app.post('/api/turmas', authenticateToken, isDirecao, async (req, res) => {
    const { nome, ano_letivo, professor_id, escola_id } = req.body;
    if (!nome || !professor_id || !escola_id) return res.status(400).json({ message: 'Nome, escola e professor são obrigatórios.' });
    try {
        const result = await pool.query(
            'INSERT INTO turmas (nome, ano_letivo, professor_id, escola_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [nome, ano_letivo || new Date().getFullYear(), professor_id, escola_id]
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
    const { aluno_id, serie, ano_letivo, data_matricula } = req.body;
    if (!aluno_id) return res.status(400).json({ message: 'Aluno é obrigatório.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const turma = await client.query('SELECT escola_id, ano_letivo FROM turmas WHERE id = $1', [id]);
        if (turma.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Turma não encontrada.' });
        }
        await client.query(`UPDATE matriculas SET status = 'transferida', data_saida = COALESCE(data_saida, CURRENT_DATE), motivo_saida = 'Transferência'
            WHERE aluno_id = $1 AND status = 'ativa' AND turma_id <> $2`, [aluno_id, id]);
        const result = await client.query(`INSERT INTO matriculas (aluno_id, turma_id, escola_id, ano_letivo, serie, data_matricula, status)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), 'ativa')
            ON CONFLICT (aluno_id, turma_id) DO UPDATE SET escola_id = EXCLUDED.escola_id, ano_letivo = EXCLUDED.ano_letivo,
            serie = EXCLUDED.serie, data_matricula = EXCLUDED.data_matricula, status = 'ativa', data_saida = NULL, motivo_saida = NULL
            RETURNING id`, [aluno_id, id, turma.rows[0].escola_id, ano_letivo || turma.rows[0].ano_letivo || new Date().getFullYear(), serie || null, data_matricula || null]);
        await client.query('COMMIT');
        await registrarAuditoria(req.user.id, 'ENROLL', 'matricula', result.rows[0].id, null, { aluno_id, turma_id: id, ano_letivo, serie });
        res.status(201).json({ message: 'Aluno matriculado!', matricula_id: result.rows[0].id });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Erro ao matricular', error: err.message });
    } finally {
        client.release();
    }
});

app.get('/api/diretor/alunos/:id/matriculas', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`SELECT m.*, t.nome AS turma_nome, e.nome AS escola_nome, e.sigla
            FROM matriculas m JOIN turmas t ON t.id = m.turma_id LEFT JOIN escolas e ON e.id = m.escola_id
            WHERE m.aluno_id = $1 ORDER BY m.ano_letivo DESC, m.data_matricula DESC`, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar histórico de matrículas', error: err.message });
    }
});

app.post('/api/diretor/alunos/:id/transferir', authenticateToken, isDirecao, async (req, res) => {
    const { turma_id, serie, ano_letivo, data_matricula } = req.body;
    if (!turma_id) return res.status(400).json({ message: 'A nova turma é obrigatória.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const aluno = await client.query("SELECT id FROM users WHERE id = $1 AND papel = 'aluno'", [req.params.id]);
        if (aluno.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }
        const turma = await client.query('SELECT escola_id, ano_letivo FROM turmas WHERE id = $1', [turma_id]);
        if (turma.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Nova turma não encontrada.' });
        }
        await client.query(`UPDATE matriculas SET status = 'transferida', data_saida = COALESCE(data_saida, CURRENT_DATE), motivo_saida = 'Transferência'
            WHERE aluno_id = $1 AND status = 'ativa'`, [req.params.id]);
        await client.query(`INSERT INTO matriculas (aluno_id, turma_id, escola_id, ano_letivo, serie, data_matricula, status)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), 'ativa')
            ON CONFLICT (aluno_id, turma_id) DO UPDATE SET escola_id = EXCLUDED.escola_id, ano_letivo = EXCLUDED.ano_letivo,
            serie = EXCLUDED.serie, status = 'ativa', data_saida = NULL, motivo_saida = NULL`,
            [req.params.id, turma_id, turma.rows[0].escola_id, ano_letivo || turma.rows[0].ano_letivo || new Date().getFullYear(), serie || null, data_matricula || null]);
        await client.query('COMMIT');
        await registrarAuditoria(req.user.id, 'TRANSFER', 'matricula', Number(req.params.id), { turma_anterior: 'matrícula ativa encerrada' }, { turma_id, serie, ano_letivo });
        res.status(201).json({ message: 'Transferência registrada com sucesso.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Erro ao registrar transferência', error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/turmas/:id/matricular/:alunoId', authenticateToken, isDirecao, async (req, res) => {
    const { id, alunoId } = req.params;
    try {
        const result = await pool.query(
            `UPDATE matriculas SET status = 'removida', data_saida = CURRENT_DATE, motivo_saida = 'Remoção manual da turma'
             WHERE turma_id = $1 AND aluno_id = $2 AND status = 'ativa' RETURNING id`,
            [id, alunoId]
        );
        if (result.rowCount === 0) {
            await pool.query('DELETE FROM matriculas WHERE turma_id = $1 AND aluno_id = $2', [id, alunoId]);
        } else {
            await registrarAuditoria(req.user.id, 'REMOVE_MATRICULA', 'matricula', result.rows[0].id, { turma_id: id, aluno_id: alunoId }, { status: 'removida', data_saida: new Date() });
        }
        res.json({ message: 'Aluno removido da turma (histórico preservado!).' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover aluno', error: err.message });
    }
});

// ========== ROTAS DE LISTAGEM PARA O DIRETOR ==========
app.get('/api/diretor/alunos', authenticateToken, isDirecao, async (req, res) => {
    try {
        const { busca, escola_id, serie, situacao, idade_min, idade_max, transporte_escolar, regiao, necessidades_alimentares, bolsa_familia, autorizacao_imagem } = req.query;
        const filtros = ["u.papel = 'aluno'"];
        const parametros = [];
        const adicionarFiltro = (sql, valor) => {
            parametros.push(valor);
            filtros.push(sql.replace('?', `$${parametros.length}`));
        };
        if (busca) {
            parametros.push(`%${busca}%`);
            filtros.push(`(LOWER(u.nome) LIKE LOWER($${parametros.length}) OR LOWER(COALESCE(p.matricula, '')) LIKE LOWER($${parametros.length}))`);
        }
        if (escola_id) adicionarFiltro('matricula_atual.escola_id = ?', escola_id);
        if (serie) adicionarFiltro('COALESCE(matricula_atual.serie, p.ano) ILIKE ?', `%${serie}%`);
        if (situacao === 'matriculado') {
            filtros.push("matricula_atual.status = 'ativa'");
        } else if (situacao === 'sem_matricula') {
            filtros.push("matricula_atual.status IS NULL");
        } else if (situacao === 'transferido') {
            filtros.push("(matricula_atual.status IS NULL AND EXISTS (SELECT 1 FROM matriculas m_transf WHERE m_transf.aluno_id = u.id AND m_transf.status = 'transferida'))");
        }
        if (idade_min) adicionarFiltro("DATE_PART('year', AGE(CURRENT_DATE, p.data_nascimento)) >= ?", Number(idade_min));
        if (idade_max) adicionarFiltro("DATE_PART('year', AGE(CURRENT_DATE, p.data_nascimento)) <= ?", Number(idade_max));
        if (transporte_escolar === 'true' || transporte_escolar === 'false') adicionarFiltro('p.transporte_escolar = ?', transporte_escolar === 'true');
        if (regiao) adicionarFiltro('p.regiao = ?', regiao);
        if (necessidades_alimentares === 'true') filtros.push("NULLIF(TRIM(COALESCE(p.necessidades_alimentares, '')), '') IS NOT NULL");
        if (bolsa_familia === 'true' || bolsa_familia === 'false') adicionarFiltro('p.bolsa_familia = ?', bolsa_familia === 'true');
        if (autorizacao_imagem === 'true' || autorizacao_imagem === 'false') adicionarFiltro('p.autorizacao_imagem = ?', autorizacao_imagem === 'true');
        const result = await pool.query(`
      SELECT u.id, u.nome, u.email, p.matricula, p.data_nascimento, p.transporte_escolar,
             p.regiao, p.necessidades_alimentares, p.bolsa_familia, p.autorizacao_imagem,
             COALESCE(escola_atual.nome, p.unidade) AS escola_nome,
             matricula_atual.serie, matricula_atual.ano_letivo, matricula_atual.status AS matricula_status
      FROM users u
      LEFT JOIN perfis p ON u.id = p.user_id
      LEFT JOIN LATERAL (
          SELECT m.escola_id, m.serie, m.ano_letivo, m.status
          FROM matriculas m
          WHERE m.aluno_id = u.id AND m.status = 'ativa'
          ORDER BY m.data_matricula DESC, m.id DESC LIMIT 1
      ) matricula_atual ON TRUE
      LEFT JOIN escolas escola_atual ON escola_atual.id = matricula_atual.escola_id
      WHERE ${filtros.join(' AND ')} ORDER BY u.nome
    `, parametros);
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
        const result = await pool.query(`
            SELECT DISTINCT t.*, COUNT(m.aluno_id)::integer AS total_alunos
            FROM turmas t
            JOIN alocacao_professores ap ON ap.turma_id = t.id
            LEFT JOIN matriculas m ON m.turma_id = t.id
            WHERE ap.professor_id = $1
            GROUP BY t.id, t.nome, t.ano_letivo, t.escola_id ORDER BY t.nome
        `, [req.user.id]);
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
    const disciplinaId = Number(req.query.disciplina_id || 0);
    try {
        const turma = await pool.query('SELECT * FROM turmas WHERE id = $1 AND professor_id = $2', [id, req.user.id]);
        if (turma.rowCount === 0) return res.status(404).json({ message: 'Turma não encontrada.' });
        const alunos = await pool.query(`
            SELECT u.id, u.nome, u.email,
                         COALESCE((SELECT n.nota FROM notas_academicas n WHERE n.aluno_id = u.id AND n.turma_id = $1 AND n.disciplina_id = $2 AND n.ano_letivo = EXTRACT(YEAR FROM CURRENT_DATE)::integer AND n.bimestre = 1), '') AS nota_b1,
                         COALESCE((SELECT n.nota FROM notas_academicas n WHERE n.aluno_id = u.id AND n.turma_id = $1 AND n.disciplina_id = $2 AND n.ano_letivo = EXTRACT(YEAR FROM CURRENT_DATE)::integer AND n.bimestre = 2), '') AS nota_b2,
                         COALESCE((SELECT n.nota FROM notas_academicas n WHERE n.aluno_id = u.id AND n.turma_id = $1 AND n.disciplina_id = $2 AND n.ano_letivo = EXTRACT(YEAR FROM CURRENT_DATE)::integer AND n.bimestre = 3), '') AS nota_b3,
                         COALESCE((SELECT n.nota FROM notas_academicas n WHERE n.aluno_id = u.id AND n.turma_id = $1 AND n.disciplina_id = $2 AND n.ano_letivo = EXTRACT(YEAR FROM CURRENT_DATE)::integer AND n.bimestre = 4), '') AS nota_b4
      FROM matriculas m
      JOIN users u ON m.aluno_id = u.id
            WHERE m.turma_id = $1 AND m.status = 'ativa' ORDER BY u.nome
        `, [id, disciplinaId]);
        res.json({ turma: turma.rows[0], alunos: alunos.rows });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar alunos', error: err.message });
    }
});

app.post('/professor/notas', authenticateToken, isProfessor, async (req, res) => {
    const { turma_id, aluno_id, bimestre, nota } = req.body;
    const bimestreNumerico = Number(bimestre);
    const notaNumerica = Number(nota);
    if (!turma_id || !aluno_id || !Number.isInteger(bimestreNumerico) || bimestreNumerico < 1 || bimestreNumerico > 4 || !Number.isFinite(notaNumerica) || notaNumerica < 0 || notaNumerica > 10) {
        return res.status(400).json({ message: 'Informe um bimestre entre 1 e 4 e uma nota entre 0 e 10.' });
    }
    try {
        const turma = await pool.query('SELECT id FROM turmas WHERE id = $1 AND professor_id = $2', [turma_id, req.user.id]);
        if (turma.rowCount === 0) return res.status(404).json({ message: 'Turma não encontrada.' });
        const matricula = await pool.query('SELECT 1 FROM matriculas WHERE turma_id = $1 AND aluno_id = $2', [turma_id, aluno_id]);
        if (matricula.rowCount === 0) return res.status(404).json({ message: 'Aluno não está matriculado nesta turma.' });
        await pool.query(`INSERT INTO notas (aluno_id, turma_id, bimestre, nota) VALUES ($1, $2, $3, $4)
            ON CONFLICT (aluno_id, turma_id, bimestre) DO UPDATE SET nota = EXCLUDED.nota`, [aluno_id, turma_id, bimestreNumerico, notaNumerica]);
        res.json({ message: 'Nota salva com sucesso!' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao salvar nota', error: err.message });
    }
});

// ========== INICIAR ==========
initDatabase().then(() => {
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
});

// ========== ROTAS DO PROFESSOR: DIÁRIO, FREQUÊNCIA E RELATÓRIOS ==========
async function buscarTurmaDoProfessor(turmaId, professorId) {
    const result = await pool.query('SELECT * FROM turmas WHERE id = $1 AND professor_id = $2', [turmaId, professorId]);
    return result.rows[0];
}

app.get('/professor/turmas/:id/diario', authenticateToken, isProfessor, async (req, res) => {
    try {
        if (!await buscarTurmaDoProfessor(req.params.id, req.user.id)) return res.status(404).json({ message: 'Turma não encontrada.' });
        const result = await pool.query(
            'SELECT id, data_aula, conteudo, created_at FROM diario_aulas WHERE turma_id = $1 ORDER BY data_aula DESC, id DESC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar diário', error: err.message });
    }
});

app.post('/professor/turmas/:id/diario', authenticateToken, isProfessor, async (req, res) => {
    const { data_aula, conteudo } = req.body;
    if (!data_aula || !conteudo || !String(conteudo).trim()) return res.status(400).json({ message: 'Data e conteúdo são obrigatórios.' });
    try {
        if (!await buscarTurmaDoProfessor(req.params.id, req.user.id)) return res.status(404).json({ message: 'Turma não encontrada.' });
        const result = await pool.query(
            'INSERT INTO diario_aulas (turma_id, professor_id, data_aula, conteudo) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.params.id, req.user.id, data_aula, String(conteudo).trim()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao registrar aula', error: err.message });
    }
});

app.get('/professor/turmas/:id/frequencia', authenticateToken, isProfessor, async (req, res) => {
    const dataAula = req.query.data;
    if (!dataAula) return res.status(400).json({ message: 'Informe a data da aula.' });
    try {
        if (!await buscarTurmaDoProfessor(req.params.id, req.user.id)) return res.status(404).json({ message: 'Turma não encontrada.' });
        const result = await pool.query(`
            SELECT u.id AS aluno_id, u.nome,
                   COALESCE(f.status, 'presente') AS status,
                   f.observacao
            FROM matriculas m
            JOIN users u ON u.id = m.aluno_id
            LEFT JOIN frequencias f ON f.aluno_id = m.aluno_id AND f.turma_id = m.turma_id AND f.data_aula = $2
            WHERE m.turma_id = $1 ORDER BY u.nome
        `, [req.params.id, dataAula]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar frequência', error: err.message });
    }
});

app.post('/professor/turmas/:id/frequencia', authenticateToken, isProfessor, async (req, res) => {
    const { aluno_id, data_aula, status, observacao } = req.body;
    if (!aluno_id || !data_aula || !['presente', 'ausente', 'justificada'].includes(status)) return res.status(400).json({ message: 'Dados de frequência inválidos.' });
    try {
        if (!await buscarTurmaDoProfessor(req.params.id, req.user.id)) return res.status(404).json({ message: 'Turma não encontrada.' });
        const matricula = await pool.query('SELECT 1 FROM matriculas WHERE turma_id = $1 AND aluno_id = $2', [req.params.id, aluno_id]);
        if (matricula.rowCount === 0) return res.status(404).json({ message: 'Aluno não está matriculado nesta turma.' });
        await pool.query(`
            INSERT INTO frequencias (turma_id, aluno_id, data_aula, status, observacao) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (turma_id, aluno_id, data_aula) DO UPDATE SET status = EXCLUDED.status, observacao = EXCLUDED.observacao
        `, [req.params.id, aluno_id, data_aula, status, observacao || null]);
        res.json({ message: 'Frequência salva com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao salvar frequência', error: err.message });
    }
});

app.get('/professor/turmas/:id/relatorio', authenticateToken, isProfessor, async (req, res) => {
    try {
        if (!await buscarTurmaDoProfessor(req.params.id, req.user.id)) return res.status(404).json({ message: 'Turma não encontrada.' });
        const result = await pool.query(`
            SELECT u.id AS aluno_id, u.nome,
                   ROUND(AVG(n.nota)::numeric, 2) AS media_anual,
                   COUNT(DISTINCT n.id)::integer AS notas_lancadas,
                   CASE WHEN COUNT(f.id) = 0 THEN 100 ELSE ROUND(100.0 * AVG(CASE WHEN f.status = 'presente' THEN 1 ELSE 0 END)::numeric, 2) END AS frequencia_percentual
            FROM matriculas m
            JOIN users u ON u.id = m.aluno_id
            LEFT JOIN notas n ON n.aluno_id = m.aluno_id AND n.turma_id = m.turma_id
            LEFT JOIN frequencias f ON f.aluno_id = m.aluno_id AND f.turma_id = m.turma_id
            WHERE m.turma_id = $1
            GROUP BY u.id, u.nome ORDER BY u.nome
        `, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao gerar relatório', error: err.message });
    }
});

// ========== ROTAS DA DIREÇÃO: PAINEL ==========
app.get('/api/diretor/dashboard', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*)::integer FROM users WHERE papel = 'aluno') AS alunos,
                (SELECT COUNT(*)::integer FROM users WHERE papel = 'professor') AS professores,
                (SELECT COUNT(*)::integer FROM turmas) AS turmas,
                (SELECT COUNT(*)::integer FROM matriculas) AS matriculas
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar painel', error: err.message });
    }
});

app.get('/api/diretor/alunos/:id/ficha', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`
             SELECT u.id, u.nome, u.email, p.*, f.status AS status_inscricao, f.observacoes AS observacoes_inscricao, f.updated_at,
                 COALESCE((SELECT json_agg(json_build_object('id', d.id, 'nome', d.nome, 'tipo', d.tipo, 'caminho', d.caminho) ORDER BY d.created_at DESC)
                     FROM documentos_alunos d WHERE d.aluno_id = u.id), '[]') AS documentos
            FROM users u
            LEFT JOIN perfis p ON p.user_id = u.id
            LEFT JOIN fichas_inscricao f ON f.aluno_id = u.id
            WHERE u.id = $1 AND u.papel = 'aluno'
        `, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Aluno não encontrado.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar ficha do aluno', error: err.message });
    }
});

app.post('/api/diretor/alunos/:id/documentos', authenticateToken, isDirecao, async (req, res) => {
    const { nome, tipo, caminho } = req.body;
    if (!nome || !tipo || !caminho) return res.status(400).json({ message: 'Nome, tipo e caminho do documento são obrigatórios.' });
    try {
        const aluno = await pool.query("SELECT id FROM users WHERE id = $1 AND papel = 'aluno'", [req.params.id]);
        if (aluno.rowCount === 0) return res.status(404).json({ message: 'Aluno não encontrado.' });
        const result = await pool.query(
            'INSERT INTO documentos_alunos (aluno_id, nome, tipo, caminho, enviado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, tipo, caminho, created_at',
            [req.params.id, nome, tipo, caminho, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao registrar documento', error: err.message });
    }
});

app.post('/api/diretor/alunos/:id/foto', authenticateToken, isDirecao, (req, res) => {
    uploadProfilePhoto.single('foto')(req, res, async (uploadError) => {
        if (uploadError) return res.status(400).json({ message: uploadError.message });
        if (!req.file) return res.status(400).json({ message: 'Selecione uma imagem.' });
        try {
            const aluno = await pool.query("SELECT id FROM users WHERE id = $1 AND papel = 'aluno'", [req.params.id]);
            if (aluno.rowCount === 0) {
                fs.unlinkSync(req.file.path);
                return res.status(404).json({ message: 'Aluno não encontrado.' });
            }
            const fotoUrl = `/uploads/profiles/${req.file.filename}`;
            await pool.query('UPDATE perfis SET avatar_url = $1 WHERE user_id = $2', [fotoUrl, req.params.id]);
            res.status(201).json({ message: 'Imagem atualizada.', foto_url: fotoUrl });
        } catch (err) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ message: 'Erro ao salvar imagem', error: err.message });
        }
    });
});

app.post('/api/diretor/usuarios/:id/foto', authenticateToken, isDirecao, (req, res) => {
    uploadProfilePhoto.single('foto')(req, res, async (uploadError) => {
        if (uploadError) return res.status(400).json({ message: uploadError.message });
        if (!req.file) return res.status(400).json({ message: 'Selecione uma imagem.' });
        try {
            const usuario = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
            if (usuario.rowCount === 0) {
                fs.unlinkSync(req.file.path);
                return res.status(404).json({ message: 'Usuário não encontrado.' });
            }
            const fotoUrl = `/uploads/profiles/${req.file.filename}`;
            await pool.query('UPDATE perfis SET avatar_url = $1 WHERE user_id = $2', [fotoUrl, req.params.id]);
            res.status(201).json({ message: 'Imagem atualizada.', foto_url: fotoUrl });
        } catch (err) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ message: 'Erro ao salvar imagem', error: err.message });
        }
    });
});

app.delete('/api/diretor/alunos/:id/foto', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query('SELECT avatar_url FROM perfis WHERE user_id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Perfil do aluno não encontrado.' });
        const avatarUrl = result.rows[0].avatar_url;
        if (avatarUrl && avatarUrl.startsWith('/uploads/profiles/')) {
            const arquivo = path.join(__dirname, 'public', avatarUrl.replace(/^\//, '').replaceAll('/', path.sep));
            if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
        }
        await pool.query('UPDATE perfis SET avatar_url = NULL WHERE user_id = $1', [req.params.id]);
        res.json({ message: 'Foto removida.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover foto', error: err.message });
    }
});

app.put('/api/diretor/alunos/:id', authenticateToken, isDirecao, async (req, res) => {
    const camposUsuario = ['nome', 'email'];
    const camposPerfil = [
        'matricula', 'data_nascimento', 'sexo', 'raca', 'periodo', 'ano', 'nivel_ensino', 'natural_de', 'uf',
        'registro_nascimento', 'livro', 'folha', 'data_emissao_rg', 'numero_rg', 'orgao_expedidor', 'cpf', 'nis',
        'cartao_sus', 'regiao', 'transporte_escolar', 'necessidade_especial', 'necessidades_alimentares',
        'autorizacao_imagem', 'nome_pai', 'profissao_pai', 'nome_mae', 'profissao_mae', 'endereco', 'telefone',
        'renda_familiar', 'bolsa_familia', 'nome_responsavel', 'profissao_responsavel', 'responsavel_endereco',
        'responsavel_municipio', 'responsavel_uf', 'observacoes', 'grec', 'unidade', 'unidade_uf', 'decreto_criacao', 'municipio'
    ];
    const tratarValor = valor => valor === '' || valor === undefined ? null : valor;
    const tratarBoolean = valor => valor === true || valor === 'true';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const aluno = await client.query("SELECT id FROM users WHERE id = $1 AND papel = 'aluno' FOR UPDATE", [req.params.id]);
        if (aluno.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }
        const anterior = await client.query('SELECT * FROM perfis WHERE user_id = $1', [req.params.id]);
        const usuarioAnterior = await client.query('SELECT nome, email FROM users WHERE id = $1', [req.params.id]);
        if (!req.body.nome || !req.body.email) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
        }
        await client.query('UPDATE users SET nome = $1, email = $2 WHERE id = $3', [req.body.nome, req.body.email, req.params.id]);
        const valores = camposPerfil.map(campo => {
            const valor = req.body[campo];
            return ['transporte_escolar', 'autorizacao_imagem', 'bolsa_familia'].includes(campo) ? tratarBoolean(valor) : tratarValor(valor);
        });
        await client.query(`UPDATE perfis SET ${camposPerfil.map((campo, indice) => `${campo} = $${indice + 1}`).join(', ')} WHERE user_id = $${camposPerfil.length + 1}`, [...valores, req.params.id]);
        await client.query('COMMIT');
        await registrarAuditoria(req.user.id, 'UPDATE', 'aluno', Number(req.params.id), { usuario: usuarioAnterior.rows[0], perfil: anterior.rows[0] }, { usuario: { nome: req.body.nome, email: req.body.email }, perfil: req.body });
        res.json({ message: 'Dados do aluno atualizados.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Erro ao atualizar aluno', error: err.message });
    } finally {
        client.release();
    }
});

async function registrarAuditoria(usuarioId, acao, entidade, entidadeId, anteriores, novos) {
    await pool.query(`INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`, [usuarioId, acao, entidade, entidadeId, JSON.stringify(anteriores || {}), JSON.stringify(novos || {})]);
}

app.get('/api/diretor/alunos/:id/historico', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`
                        SELECT h.*, e.nome AS escola_nome, d.nome AS disciplina_nome, d.codigo
                        FROM historico_escolar h
                        LEFT JOIN escolas e ON e.id = h.escola_id
                        LEFT JOIN disciplinas_escolares d ON d.id = h.disciplina_id
                        WHERE h.aluno_id = $1
                        UNION ALL
                        SELECT NULL::integer AS id, n.aluno_id, t.escola_id, n.ano_letivo, m.serie, n.disciplina_id,
                                     d.carga_horaria, ROUND(AVG(n.nota)::numeric, 2) AS media_final,
                                     NULL::numeric AS frequencia_percentual, 'Em andamento' AS situacao,
                                     NULL::timestamptz AS created_at, e.nome AS escola_nome, d.nome AS disciplina_nome, d.codigo
                        FROM notas_academicas n
                        JOIN disciplinas_escolares d ON d.id = n.disciplina_id
                        LEFT JOIN matriculas m ON m.aluno_id = n.aluno_id AND m.turma_id = n.turma_id
                        LEFT JOIN turmas t ON t.id = n.turma_id
                        LEFT JOIN escolas e ON e.id = t.escola_id
                        WHERE n.aluno_id = $1
                            AND NOT EXISTS (SELECT 1 FROM historico_escolar h2 WHERE h2.aluno_id = n.aluno_id AND h2.ano_letivo = n.ano_letivo AND h2.disciplina_id = n.disciplina_id)
                        GROUP BY n.aluno_id, n.turma_id, t.escola_id, n.ano_letivo, m.serie, n.disciplina_id, d.carga_horaria, e.nome, d.nome, d.codigo
                        ORDER BY ano_letivo DESC, disciplina_nome
        `, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar histórico escolar', error: err.message });
    }
});

app.get('/api/diretor/disciplinas', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, codigo, carga_horaria FROM disciplinas_escolares WHERE ativa = TRUE ORDER BY nome');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar disciplinas', error: err.message });
    }
});

app.get('/api/diretor/alunos/:id/boletim', authenticateToken, isDirecao, async (req, res) => {
    const alunoId = Number(req.params.id);
    const anoLetivo = Number(req.query.ano_letivo || new Date().getFullYear());
    try {
        const matricula = await pool.query(`
            SELECT m.turma_id, m.serie, m.status, t.nome AS turma_nome, e.id AS escola_id, e.nome AS escola_nome
            FROM matriculas m
            JOIN turmas t ON t.id = m.turma_id
            LEFT JOIN escolas e ON e.id = m.escola_id
            WHERE m.aluno_id = $1 AND m.ano_letivo = $2
            ORDER BY CASE WHEN m.status = 'ativa' THEN 1 ELSE 2 END, m.data_matricula DESC
            LIMIT 1
        `, [alunoId, anoLetivo]);

        const infoMatricula = matricula.rows[0] || null;
        const turmaId = infoMatricula ? infoMatricula.turma_id : null;

        const freqResult = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'presente')::integer AS presencas,
                COUNT(*) FILTER (WHERE status = 'ausente')::integer AS faltas,
                COUNT(*) FILTER (WHERE status = 'justificada')::integer AS justificadas,
                COUNT(*)::integer AS total_aulas
            FROM frequencias
            WHERE aluno_id = $1 ${turmaId ? 'AND turma_id = $2' : ''}
        `, turmaId ? [alunoId, turmaId] : [alunoId]);

        const freq = freqResult.rows[0] || { presencas: 0, faltas: 0, justificadas: 0, total_aulas: 0 };
        const percFreq = freq.total_aulas > 0
            ? Math.round((freq.presencas / freq.total_aulas) * 100)
            : 100;

        const result = await pool.query(`
            SELECT d.id AS disciplina_id, d.nome AS disciplina_nome, d.codigo, d.carga_horaria,
                   n.bimestre, n.nota, n.conceito
            FROM disciplinas_escolares d
            LEFT JOIN notas_academicas n ON n.disciplina_id = d.id AND n.aluno_id = $1 AND n.ano_letivo = $2
            WHERE d.ativa = TRUE
            ORDER BY d.nome, n.bimestre
        `, [alunoId, anoLetivo]);

        res.json({
            ano_letivo: anoLetivo,
            matricula: infoMatricula,
            frequencia: {
                ...freq,
                percentual: percFreq
            },
            linhas: result.rows
        });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar boletim', error: err.message });
    }
});

app.post('/api/diretor/alunos/:id/historico', authenticateToken, isDirecao, async (req, res) => {
    const alunoId = Number(req.params.id);
    const { escola_id, ano_letivo, serie, disciplina_id, carga_horaria, media_final, frequencia_percentual, situacao } = req.body;
    if (!ano_letivo || !disciplina_id || media_final === undefined) {
        return res.status(400).json({ message: 'Ano letivo, disciplina e média final são obrigatórios.' });
    }
    try {
        const result = await pool.query(`
            INSERT INTO historico_escolar (aluno_id, escola_id, ano_letivo, serie, disciplina_id, carga_horaria, media_final, frequencia_percentual, situacao)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (aluno_id, ano_letivo, disciplina_id)
            DO UPDATE SET escola_id = EXCLUDED.escola_id, serie = EXCLUDED.serie, carga_horaria = EXCLUDED.carga_horaria,
                          media_final = EXCLUDED.media_final, frequencia_percentual = EXCLUDED.frequencia_percentual,
                          situacao = EXCLUDED.situacao
            RETURNING *
        `, [
            alunoId,
            escola_id || null,
            Number(ano_letivo),
            serie || null,
            Number(disciplina_id),
            carga_horaria ? Number(carga_horaria) : null,
            Number(media_final),
            frequencia_percentual ? Number(frequencia_percentual) : null,
            situacao || (Number(media_final) >= 6 ? 'Aprovado' : 'Reprovado')
        ]);
        await registrarAuditoria(req.user.id, 'UPSERT', 'historico_escolar', result.rows[0].id, null, result.rows[0]);
        res.status(201).json({ message: 'Registro do histórico salvo com sucesso!', registro: result.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao salvar histórico escolar', error: err.message });
    }
});

app.delete('/api/diretor/historico/:id', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM historico_escolar WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Registro de histórico não encontrado.' });
        await registrarAuditoria(req.user.id, 'DELETE', 'historico_escolar', Number(req.params.id), result.rows[0], null);
        res.json({ message: 'Registro removido do histórico.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao excluir registro de histórico', error: err.message });
    }
});

app.get('/api/diretor/auditoria', authenticateToken, isDirecao, async (req, res) => {
    try {
        const result = await pool.query(`SELECT a.*, u.nome AS usuario_nome FROM auditoria a LEFT JOIN users u ON u.id = a.usuario_id ORDER BY a.created_at DESC LIMIT 200`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar auditoria', error: err.message });
    }
});

app.get('/api/diretor/relatorios/indicadores', authenticateToken, isDirecao, async (req, res) => {
    const escolaId = req.query.escola_id || null;
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*)::integer FROM users WHERE papel = 'aluno') AS alunos,
                (SELECT COUNT(*)::integer FROM users WHERE papel = 'professor') AS professores,
                (SELECT COUNT(*)::integer FROM turmas WHERE ($1::integer IS NULL OR escola_id = $1)) AS turmas,
                (SELECT COUNT(*)::integer FROM matriculas WHERE status = 'ativa' AND ($1::integer IS NULL OR escola_id = $1)) AS matriculas_ativas,
                (SELECT COUNT(*)::integer FROM matriculas WHERE status = 'transferida' AND ($1::integer IS NULL OR escola_id = $1)) AS transferencias,
                (SELECT COUNT(*)::integer FROM documentos_alunos) AS documentos,
                (SELECT COUNT(*)::integer FROM users u WHERE u.papel = 'aluno' AND NOT EXISTS (SELECT 1 FROM matriculas m WHERE m.aluno_id = u.id AND m.status = 'ativa')) AS alunos_sem_turma
        `, [escolaId]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar indicadores', error: err.message });
    }
});

app.get('/professor/disciplinas-academicas', authenticateToken, isProfessor, async (req, res) => {
    try {
        const result = await pool.query(`SELECT d.id, d.nome, d.codigo, d.carga_horaria FROM disciplinas_escolares d WHERE d.ativa = TRUE ORDER BY d.nome`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar disciplinas', error: err.message });
    }
});

app.get('/professor/turmas/:id/boletim', authenticateToken, isProfessor, async (req, res) => {
    const anoLetivo = Number(req.query.ano_letivo || new Date().getFullYear());
    try {
        if (!await buscarTurmaDoProfessor(req.params.id, req.user.id)) return res.status(404).json({ message: 'Turma não encontrada.' });
        const result = await pool.query(`SELECT n.*, u.nome AS aluno_nome, d.nome AS disciplina_nome, d.codigo
            FROM notas_academicas n JOIN users u ON u.id = n.aluno_id JOIN disciplinas_escolares d ON d.id = n.disciplina_id
            WHERE n.turma_id = $1 AND n.ano_letivo = $2 ORDER BY u.nome, d.nome, n.bimestre`, [req.params.id, anoLetivo]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar boletim da turma', error: err.message });
    }
});

app.post('/professor/notas-academicas', authenticateToken, isProfessor, async (req, res) => {
    const { turma_id, aluno_id, disciplina_id, ano_letivo, bimestre, nota, conceito } = req.body;
    if (!turma_id || !aluno_id || !disciplina_id || !bimestre || nota === undefined) return res.status(400).json({ message: 'Dados de nota incompletos.' });
    const notaNumerica = Number(nota);
    if (!Number.isFinite(notaNumerica) || notaNumerica < 0 || notaNumerica > 10) return res.status(400).json({ message: 'A nota deve estar entre 0 e 10.' });
    try {
        if (!await buscarTurmaDoProfessor(turma_id, req.user.id)) return res.status(404).json({ message: 'Turma não encontrada.' });
        const matricula = await pool.query('SELECT 1 FROM matriculas WHERE turma_id = $1 AND aluno_id = $2 AND status = \'ativa\'', [turma_id, aluno_id]);
        if (matricula.rowCount === 0) return res.status(404).json({ message: 'Aluno não está matriculado nesta turma.' });
        const result = await pool.query(`INSERT INTO notas_academicas (aluno_id, turma_id, disciplina_id, ano_letivo, bimestre, nota, conceito, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (aluno_id, turma_id, disciplina_id, ano_letivo, bimestre) DO UPDATE SET nota = EXCLUDED.nota, conceito = EXCLUDED.conceito, updated_by = EXCLUDED.updated_by, updated_at = NOW()
            RETURNING *`, [aluno_id, turma_id, disciplina_id, ano_letivo || new Date().getFullYear(), bimestre, notaNumerica, conceito || null, req.user.id]);
        await registrarAuditoria(req.user.id, 'UPSERT', 'nota_academica', result.rows[0].id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao salvar nota acadêmica', error: err.message });
    }
});
const documentUploadDirectory = path.join(__dirname, 'public', 'uploads', 'documents');
fs.mkdirSync(documentUploadDirectory, { recursive: true });
const documentStorage = multer.diskStorage({
    destination: documentUploadDirectory,
    filename: (req, file, callback) => callback(null, `aluno-${req.params.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
});
const uploadStudentDocument = multer({
    storage: documentStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const permitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        callback(permitidos.includes(file.mimetype) ? null : new Error('Envie PDF, JPG, PNG ou WEBP.'), permitidos.includes(file.mimetype));
    }
});

app.post('/api/diretor/alunos/:id/documentos/upload', authenticateToken, isDirecao, (req, res) => {
    uploadStudentDocument.single('documento')(req, res, async uploadError => {
        if (uploadError) return res.status(400).json({ message: uploadError.message });
        if (!req.file) return res.status(400).json({ message: 'Selecione um documento.' });
        const { tipo } = req.body;
        try {
            const aluno = await pool.query("SELECT id FROM users WHERE id = $1 AND papel = 'aluno'", [req.params.id]);
            if (aluno.rowCount === 0) {
                fs.unlinkSync(req.file.path);
                return res.status(404).json({ message: 'Aluno não encontrado.' });
            }
            const caminho = `/uploads/documents/${req.file.filename}`;
            const result = await pool.query(`INSERT INTO documentos_alunos (aluno_id, nome, tipo, caminho, enviado_por)
                VALUES ($1, $2, $3, $4, $5) RETURNING *`, [req.params.id, req.file.originalname, tipo || 'Documento escolar', caminho, req.user.id]);
            await registrarAuditoria(req.user.id, 'CREATE', 'documento', result.rows[0].id, null, result.rows[0]);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ message: 'Erro ao salvar documento', error: err.message });
        }
    });
});

app.delete('/api/diretor/documentos/:id', authenticateToken, isDirecao, async (req, res) => {
    try {
        const docResult = await pool.query('SELECT * FROM documentos_alunos WHERE id = $1', [req.params.id]);
        if (docResult.rowCount === 0) {
            return res.status(404).json({ message: 'Documento não encontrado.' });
        }
        const doc = docResult.rows[0];
        if (doc.caminho && doc.caminho.startsWith('/uploads/documents/')) {
            const filePath = path.join(__dirname, 'public', doc.caminho.replace(/^\//, '').replaceAll('/', path.sep));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        await pool.query('DELETE FROM documentos_alunos WHERE id = $1', [req.params.id]);
        await registrarAuditoria(req.user.id, 'DELETE', 'documento', Number(req.params.id), doc, null);
        res.json({ message: 'Documento excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao excluir documento', error: err.message });
    }
});