CREATE DATABASE IF NOT EXISTS gestao_integral
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gestao_integral;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  usuario VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'padrao',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_users_usuario (usuario),
  UNIQUE KEY ux_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  nome VARCHAR(180) NOT NULL,
  area VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_permissions_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id BIGINT UNSIGNED NOT NULL,
  perm_id BIGINT UNSIGNED NOT NULL,
  granted TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, perm_id),
  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_permission
    FOREIGN KEY (perm_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  entidade VARCHAR(100) NOT NULL,
  entidade_id BIGINT UNSIGNED NULL,
  acao VARCHAR(50) NOT NULL,
  diffs JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_logs_created_at (created_at),
  KEY ix_audit_logs_entidade (entidade, entidade_id),
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS config (
  k VARCHAR(100) NOT NULL,
  v TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (k)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS segments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_segments_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS series (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  segment_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(150) NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_series_codigo (codigo),
  UNIQUE KEY ux_series_segment_nome (segment_id, nome),
  CONSTRAINT fk_series_segment
    FOREIGN KEY (segment_id) REFERENCES segments (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS turmas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  series_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(150) NOT NULL,
  entrada_parcial TIME NULL DEFAULT '08:00:00',
  saida_parcial TIME NULL DEFAULT '13:00:00',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_turmas_serie_nome (series_id, nome),
  CONSTRAINT fk_turmas_serie
    FOREIGN KEY (series_id) REFERENCES series (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alunos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  turma_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(180) NOT NULL,
  responsavel VARCHAR(180) NULL,
  telefone VARCHAR(40) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  dt_status TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_alunos_turma_nome (turma_id, nome),
  KEY ix_alunos_status (status),
  CONSTRAINT fk_alunos_turma
    FOREIGN KEY (turma_id) REFERENCES turmas (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS aluno_rotina (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aluno_id BIGINT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  entrada TIME NULL,
  saida TIME NULL,
  almoco TINYINT(1) NOT NULL DEFAULT 0,
  jantar TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_aluno_rotina_dia (aluno_id, dia_semana),
  CONSTRAINT fk_aluno_rotina_aluno
    FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE,
  CONSTRAINT ck_aluno_rotina_dia CHECK (dia_semana BETWEEN 1 AND 7)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS precos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chave VARCHAR(120) NOT NULL,
  valor DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  vigente_desde DATE NULL,
  obs TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_precos_chave (chave)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS professores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(180) NOT NULL,
  email VARCHAR(190) NULL,
  telefone VARCHAR(40) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_professores_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cursos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(180) NOT NULL,
  professor_nome VARCHAR(180) NULL,
  dias_horarios VARCHAR(255) NULL,
  preco_mensal DECIMAL(12,2) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_cursos_nome (nome),
  KEY ix_cursos_ativo (ativo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS curso_turmas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id BIGINT UNSIGNED NOT NULL,
  professor_id BIGINT UNSIGNED NULL,
  nome VARCHAR(150) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_curso_turmas_curso (curso_id),
  KEY ix_curso_turmas_professor (professor_id),
  CONSTRAINT fk_curso_turmas_curso
    FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE,
  CONSTRAINT fk_curso_turmas_professor
    FOREIGN KEY (professor_id) REFERENCES professores (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS matriculas_curso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aluno_id BIGINT UNSIGNED NOT NULL,
  curso_turma_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_matriculas_aluno_turma (aluno_id, curso_turma_id),
  KEY ix_matriculas_status (status),
  CONSTRAINT fk_matriculas_aluno
    FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE,
  CONSTRAINT fk_matriculas_curso_turma
    FOREIGN KEY (curso_turma_id) REFERENCES curso_turmas (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS presencas_extracurriculares (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aluno_id BIGINT UNSIGNED NOT NULL,
  curso_id BIGINT UNSIGNED NOT NULL,
  data DATE NOT NULL,
  status VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_presencas_extra (aluno_id, curso_id, data),
  KEY ix_presencas_extra_data (data),
  CONSTRAINT fk_presencas_extra_aluno
    FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE,
  CONSTRAINT fk_presencas_extra_curso
    FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS curso_presencas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aluno_id BIGINT UNSIGNED NOT NULL,
  curso_turma_id BIGINT UNSIGNED NULL,
  curso_id BIGINT UNSIGNED NULL,
  data DATE NOT NULL,
  status VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_curso_presencas_turma (aluno_id, curso_turma_id, data),
  KEY ix_curso_presencas_curso_data (curso_id, data),
  CONSTRAINT fk_curso_presencas_aluno
    FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE,
  CONSTRAINT fk_curso_presencas_turma
    FOREIGN KEY (curso_turma_id) REFERENCES curso_turmas (id) ON DELETE CASCADE,
  CONSTRAINT fk_curso_presencas_curso
    FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO permissions (code, nome, area) VALUES
  ('admin.geral', 'Acesso à Administração', 'Administração'),
  ('user.read', 'Visualizar usuários', 'Administração'),
  ('user.update', 'Atualizar usuários', 'Administração'),
  ('user.delete', 'Desativar usuários', 'Administração'),
  ('acad.visualizar', 'Visualizar Estrutura Acadêmica', 'Estrutura Acadêmica'),
  ('acad.cadastro', 'Cadastro de Estrutura', 'Estrutura Acadêmica'),
  ('acad.transferencia', 'Transferência de Alunos', 'Estrutura Acadêmica'),
  ('horarios.visualizar', 'Visualizar Horários', 'Horários'),
  ('horarios.edicao', 'Edição de Rotina', 'Horários'),
  ('curso.cadastro', 'Cadastro de Curso', 'Cursos Extracurriculares'),
  ('curso.aluno_cadastro', 'Cadastro de Aluno em Curso', 'Cursos Extracurriculares'),
  ('fin.atualizar_preco', 'Atualização de Preço por Segmento', 'Financeiro'),
  ('rel.tudo', 'Visualizar Todos os Relatórios', 'Relatórios'),
  ('rel.total_alunos', 'Visualizar Total de Alunos', 'Relatórios'),
  ('rel.receita', 'Visualizar Receita', 'Relatórios'),
  ('rel.refeicoes', 'Visualizar Refeições', 'Relatórios'),
  ('rel.horas_extras', 'Visualizar Horas Extras', 'Relatórios'),
  ('config.geral', 'Acesso às Configurações', 'Configurações'),
  ('logs.visualizar', 'Visualizar Logs', 'Logs')
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  area = VALUES(area);

INSERT INTO precos (chave, valor, vigente_desde, obs) VALUES
  ('hora.extra', 0.00, CURRENT_DATE, 'Valor de uma hora extra'),
  ('refeicao.almoco', 0.00, CURRENT_DATE, 'Valor unitário do almoço'),
  ('refeicao.jantar', 0.00, CURRENT_DATE, 'Valor unitário do jantar')
ON DUPLICATE KEY UPDATE chave = VALUES(chave);

INSERT INTO config (k, v) VALUES
  ('nome_sistema', 'Meneiger Page')
ON DUPLICATE KEY UPDATE k = VALUES(k);
