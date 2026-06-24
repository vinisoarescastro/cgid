-- Migration: Renomear slugs de perfil de usuário
-- De: super_administrador, gerente, operador, visitante
-- Para: master, coordenador, colaborador, convidado
-- (administrador permanece igual)
--
-- Executar UMA VEZ no banco de dados existente.
-- Compatível com SQLite e SQL Server.

-- 1. Atualiza perfis na tabela de usuários
UPDATE usuarios SET perfil = 'master'      WHERE perfil = 'super_administrador';
UPDATE usuarios SET perfil = 'coordenador' WHERE perfil = 'gerente';
UPDATE usuarios SET perfil = 'colaborador' WHERE perfil = 'operador';
UPDATE usuarios SET perfil = 'convidado'   WHERE perfil = 'visitante';

-- 2. Atualiza perfis na tabela de permissões por perfil
UPDATE permissoes_perfil SET perfil = 'master'      WHERE perfil = 'super_administrador';
UPDATE permissoes_perfil SET perfil = 'coordenador' WHERE perfil = 'gerente';
UPDATE permissoes_perfil SET perfil = 'colaborador' WHERE perfil = 'operador';
UPDATE permissoes_perfil SET perfil = 'convidado'   WHERE perfil = 'visitante';

-- Verificação (opcional): deve retornar 0 linhas para cada slug antigo
-- SELECT COUNT(*) FROM usuarios         WHERE perfil IN ('super_administrador', 'gerente', 'operador', 'visitante');
-- SELECT COUNT(*) FROM permissoes_perfil WHERE perfil IN ('super_administrador', 'gerente', 'operador', 'visitante');
