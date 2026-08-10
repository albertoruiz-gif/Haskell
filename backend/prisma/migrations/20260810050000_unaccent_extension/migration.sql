-- Extension nativa de Postgres para busqueda sin distinguir tildes
-- (unaccent('Champú') = 'Champu') — reemplaza el hack anterior de listar
-- a mano cada palabra acentuada en el buscador del catalogo.
CREATE EXTENSION IF NOT EXISTS unaccent;
