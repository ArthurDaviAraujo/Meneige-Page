# SystemCollege — Meneiger Page

Sistema web para administração escolar, organização do horário integral, controle acadêmico e acompanhamento financeiro. A aplicação possui interface responsiva em temas claro e escuro, painel administrativo, API em PHP e banco de dados MySQL.

Desenvolvido por **ByteLab**.

## Funcionalidades

- Cadastro e gerenciamento de alunos.
- Estrutura acadêmica com segmentos, séries e turmas.
- Organização de horários e rotina integral.
- Cursos extracurriculares, matrículas, chamadas e presenças.
- Calculadora de orçamento e mensalidades.
- Controle de preços e dados financeiros.
- Relatórios acadêmicos, financeiros, CSV e PDF.
- Usuários, funções e permissões de acesso.
- Logs e auditoria das operações.
- Personalização do nome e logotipo do sistema.
- Alternância entre tema claro e escuro.

## Tecnologias

- HTML5, CSS3 e JavaScript.
- PHP 8 ou superior.
- MySQL 8.
- PDO para acesso ao banco de dados.
- Composer e Dompdf para geração de PDFs.
- Remix Icon para os ícones da interface.

## Requisitos

- PHP 8+ com as extensões `pdo_mysql` e `mbstring` habilitadas.
- MySQL Server 8.
- Composer.
- Apache, XAMPP ou o servidor embutido do PHP.
- MySQL Workbench é opcional, mas facilita a importação e visualização do banco.

## Estrutura principal

```text
SystemCollege/
├── api/                    # Endpoints PHP e regras da aplicação
│   ├── _core/              # Conexão, sessão e autenticação
│   ├── academico/          # Alunos, segmentos, séries e turmas
│   ├── auth/               # Login, sessão e logout
│   ├── config/             # Nome e logotipo do sistema
│   ├── cursos/             # Chamadas e relatórios dos cursos
│   ├── financeiro/         # Dados financeiros
│   ├── relatorios/         # Consultas e exportações
│   └── users/              # Usuários e permissões
├── dashboard/              # Painel administrativo
│   ├── assets/             # CSS e JavaScript do painel
│   └── uploads/            # Logotipos enviados pelo painel
├── database/
│   └── schema.sql          # Estrutura inicial do banco
├── index.html              # Tela de login
├── script.js               # Login e tema da página inicial
├── styles.css              # Estilos da página inicial
├── login-layout-v2.css     # Layout responsivo do login
└── composer.json           # Dependências PHP
```

## Instalação

### 1. Preparar o projeto

No XAMPP, coloque a pasta com o nome `SystemCollege` dentro de:

```text
C:\xampp\htdocs\SystemCollege
```

Abra um terminal na pasta do projeto e instale as dependências:

```bash
composer install
```

### 2. Criar o banco de dados

No MySQL Workbench:

1. Conecte-se ao servidor MySQL.
2. Abra o arquivo `database/schema.sql`.
3. Execute todo o script usando o botão de raio.
4. Atualize a lista **SCHEMAS**.

O script cria o banco `gestao_integral`, suas tabelas, permissões e configurações iniciais.

### 3. Configurar a conexão

Copie `api/_core/config.example.php` para `api/_core/config.php` e ajuste os valores conforme seu MySQL:

```php
const DB_HOST    = '127.0.0.1:3308';
const DB_NAME    = 'gestao_integral';
const DB_USER    = 'root';
const DB_PASS    = 'SUA_SENHA';
const DB_CHARSET = 'utf8mb4';
```

Se o MySQL estiver na porta padrão, use `127.0.0.1:3306`. O arquivo `api/_core/config.php` é local e não deve ser publicado; configure uma senha forte e nunca a compartilhe em repositórios.

## Executar o sistema

### Com XAMPP

1. Inicie o Apache no painel do XAMPP.
2. Mantenha o serviço MySQL configurado em execução.
3. Acesse:

```text
http://localhost/SystemCollege/
```

### Com o servidor embutido do PHP

Dentro da pasta do projeto, execute:

```bash
php -S 127.0.0.1:8000
```

Depois acesse:

```text
http://127.0.0.1:8000/
```

## Criar ou redefinir o administrador

O projeto não inclui credenciais administrativas padrão. Para criar o primeiro administrador ou redefinir uma conta existente, execute na raiz do projeto:

```bash
php scripts/create_admin.php --user=admin --email=admin@localhost
```

O comando solicitará o nome e uma senha com pelo menos 8 caracteres. A senha é armazenada somente como hash seguro no MySQL.

## MySQL Workbench

Para visualizar os dados:

1. Abra sua conexão no Workbench.
2. Expanda **SCHEMAS**.
3. Expanda `gestao_integral` e depois **Tables**.
4. Clique com o botão direito em uma tabela.
5. Escolha **Select Rows - Limit 1000**.

Uma consulta equivalente é:

```sql
USE gestao_integral;
SHOW TABLES;
SELECT * FROM users;
```

## Personalização

O nome exibido pelo painel pode ser alterado em **Configurações**. O valor fica salvo na tabela `config`. O tema selecionado é salvo no navegador e permanece ativo nos próximos acessos.

Os arquivos principais da identidade visual são:

- `styles.css`, `theme-fix.css` e `login-layout-v2.css` para o login.
- `dashboard/assets/dashboard.css` e `dashboard/assets/layout-v2.css` para o painel.
- `script.js` e `dashboard/assets/dashboard.js` para a troca de tema.

## Solução de problemas

### Falha na conexão com o banco

Confira se:

- O serviço MySQL está em execução.
- A porta em `DB_HOST` é a mesma configurada no MySQL.
- O banco `gestao_integral` foi criado.
- O usuário e a senha estão corretos.

### Alterações visuais não aparecem

Atualize a página com `Ctrl + F5` para ignorar arquivos antigos armazenados no cache.

### PDFs não são gerados

Execute `composer install` na raiz do projeto e confirme que a pasta `vendor` foi criada.

## Segurança

- Troque a conta administrativa padrão.
- Use uma senha forte no MySQL.
- Não exponha `api/_core/config.php` em repositórios públicos.
- Em produção, use HTTPS e mantenha `display_errors` desabilitado.
