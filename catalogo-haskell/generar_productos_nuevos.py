# -*- coding: utf-8 -*-
"""
Genera el bloque de diccionarios Python para los productos NUEVOS
(23 lineas adicionales, mas alla de la muestra inicial de 20 productos/6 lineas).
Todo el texto en espanol (desc, beneficios, propiedades, modo_uso) es redaccion
propia y original, no traduccion literal de los textos de marketing en portugues:
se basa solo en los datos factuales (nombre, tamano, precio, activos) tomados del
sitio, para evitar reproducir parrafos de copywriting con derechos de autor.
Espanol latinoamericano neutro, sin voseo argentino.
"""

LINEAS = {
    "Acidificante": dict(
        subcat_pt="Reconstrucao pos-quimica", subcat_es="Reconstruccion post-quimica",
        activos_pt=["Blend de vinagres", "Arginina"], activos_es=["Blend de vinagres", "Arginina"],
        proposito="ayuda a reconstruir el cabello danado por procesos quimicos y a equilibrar el pH de los hilos",
        recomendado="Cabello danado por procesos quimicos, con porosidad alta",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-acidificante-haskell/",
    ),
    "Acidificante Matizadora": dict(
        subcat_pt="Matizacao acida", subcat_es="Matizacion acida para cabello rubio o canoso",
        activos_pt=["Blend de vinagres", "Arginina"], activos_es=["Blend de vinagres", "Arginina"],
        proposito="neutraliza el tono amarillento y equilibra el pH del cabello rubio, decolorado o canoso",
        recomendado="Cabello rubio, decolorado o canoso con tono amarillento",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/acidificante-matizadora/",
    ),
    "Ametista Desamareladora": dict(
        subcat_pt="Desamarelamento gradual", subcat_es="Desamarillamiento gradual",
        activos_pt=["Ametista (mineral)", "Blend de aminoacidos"], activos_es=["Amatista (mineral)", "Blend de aminoacidos"],
        proposito="neutraliza de forma gradual los reflejos amarillentos y aporta brillo",
        recomendado="Cabello rubio, decolorado, canoso o cabello oscuro que necesita mas brillo",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-ametista-haskell/",
    ),
    "Bananeira Pos-Quimica": dict(
        subcat_pt="Reposicao de massa pos-quimica", subcat_es="Reposicion de masa capilar post-quimica",
        activos_pt=["Nutrientes de banana", "Oleo de pequi"], activos_es=["Nutrientes de platano (banana)", "Aceite de pequi"],
        proposito="repone la masa capilar perdida en procesos quimicos y ayuda a reducir la quiebre",
        recomendado="Cabello danado por alisados, tinturas o decoloracion",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-bananeira-haskell/",
    ),
    "Cavalo Forte Hidra": dict(
        subcat_pt="Hidratacao profunda", subcat_es="Hidratacion profunda",
        activos_pt=["Acido hialuronico", "Oleo de rosa mosqueta", "Vitamina B3"],
        activos_es=["Acido hialuronico", "Aceite de rosa mosqueta", "Vitamina B3"],
        proposito="aporta hidratacion profunda y protege el cabello frente a agresiones externas",
        recomendado="Todo tipo de cabello, especialmente cabello reseco",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/cavalo-forte-hidra/",
    ),
    "Doce de Leite Vicosa": dict(
        subcat_pt="Colecao corpo e cabelo perfumada", subcat_es="Coleccion de cuidado corporal y capilar perfumada",
        activos_pt=["Leite vegetal", "Pantenol"], activos_es=["Leche vegetal", "Pantenol"],
        proposito="cuida el cabello y la piel con una fragancia dulce, dentro de una coleccion especial de la marca",
        recomendado="Quienes buscan una rutina de cuidado perfumada para cabello y piel",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/doce-de-leite-vicosa/",
    ),
    "Encorpa Cabelo": dict(
        subcat_pt="Volume para cabelo fino", subcat_es="Volumen para cabello fino",
        activos_pt=["Acido hialuronico", "Physalis"], activos_es=["Acido hialuronico", "Physalis"],
        proposito="aumenta el espesor aparente del cabello fino y con poco volumen, sin apelmazar",
        recomendado="Cabello fino y con poco volumen",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-encorpa-cabelo-haskell/",
    ),
    "Pra Eles (H)": dict(
        subcat_pt="Linha masculina", subcat_es="Linea masculina",
        activos_pt=[], activos_es=[],
        proposito="cuida el cabello y la barba con una rutina practica pensada para el publico masculino",
        recomendado="Cabello y barba masculinos",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-h-haskell/",
    ),
    "Hidranutre": dict(
        subcat_pt="Hidratacao e nutricao combinadas", subcat_es="Hidratacion y nutricion combinadas",
        activos_pt=["Cana-de-acucar", "Oleo de ricino"], activos_es=["Cana de azucar", "Aceite de ricino"],
        proposito="combina hidratacion y nutricion en una sola rutina, ideal para quien busca practicidad",
        recomendado="Todo tipo de cabello",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/hidranutre/",
    ),
    "Infusao de Oleos": dict(
        subcat_pt="Nutricao ultraprofunda", subcat_es="Nutricion ultraprofunda",
        activos_pt=["Oleo de marula", "Oleo de argan", "Oleo de monoi"],
        activos_es=["Aceite de marula", "Aceite de argan", "Aceite de monoi"],
        proposito="ofrece nutricion ultraprofunda para cabello muy reseco y opaco",
        recomendado="Cabello muy reseco y opaco",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/infusao-de-oleos/",
    ),
    "Jaborandi Antiqueda": dict(
        subcat_pt="Anti-queda", subcat_es="Anticaida",
        activos_pt=["Extrato de jaborandi", "Extrato de nogueira", "Extrato de arruda"],
        activos_es=["Extracto de jaborandi", "Extracto de nogal", "Extracto de ruda"],
        proposito="ayuda a reducir la caida y estimula el crecimiento saludable desde la raiz",
        recomendado="Cabello con caida, cabello graso o debilitado",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-jaborandi-haskell/",
    ),
    "Liso com Forca": dict(
        subcat_pt="Alinhamento e controle de frizz", subcat_es="Alineado y control de frizz",
        activos_pt=["Blend de acidos", "Acucar", "Biotina"], activos_es=["Blend de acidos", "Azucar", "Biotina"],
        proposito="alinea los hilos, reduce el frizz y prolonga el efecto liso de quimicas o alisados",
        recomendado="Cabello liso natural o alisado que necesita alineacion y fuerza",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-liso-com-forca-haskell/",
    ),
    "Mandioca": dict(
        subcat_pt="Forca e hidratacao", subcat_es="Fuerza e hidratacion",
        activos_pt=["Extrato de mandioca"], activos_es=["Extracto de mandioca (yuca)"],
        proposito="fortalece el cabello opaco y reseco, estimulando el crecimiento saludable",
        recomendado="Cabello opaco, reseco o con dificultad para crecer",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-mandioca-haskell/",
    ),
    "Matiza+": dict(
        subcat_pt="Matizacao violeta e ultravioleta", subcat_es="Matizacion violeta y ultravioleta",
        activos_pt=["Arginina", "Blueberry", "Uva preta"], activos_es=["Arginina", "Arandano (blueberry)", "Uva negra"],
        proposito="neutraliza tonos amarillentos o anaranjados en cabello rubio, decolorado o canoso",
        recomendado="Cabello rubio, decolorado o canoso",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-matizahaskell/",
    ),
    "Ora-pro-nobis": dict(
        subcat_pt="Forca extrema", subcat_es="Fuerza extrema",
        activos_pt=["Extrato de ora-pro-nobis"], activos_es=["Extracto de ora-pro-nobis"],
        proposito="fortalece intensamente la fibra capilar y ayuda a prevenir la quiebre en cabello debil",
        recomendado="Cabello debil, fino o quebradizo",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-ora-pro-nobis-haskell/",
    ),
    "Pre-Treino": dict(
        subcat_pt="Protecao para atividade fisica", subcat_es="Proteccion para actividad fisica",
        activos_pt=["Vitamina E", "Cera de arroz"], activos_es=["Vitamina E", "Cera de arroz"],
        proposito="protege el cabello del sudor, el frizz y la exposicion solar durante el ejercicio",
        recomendado="Personas que entrenan con frecuencia y exponen el cabello al sudor",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/pre-treino/",
    ),
    "Pos-Progressiva": dict(
        subcat_pt="Manutencao do alisamento", subcat_es="Mantenimiento de alisado",
        activos_pt=[], activos_es=[],
        proposito="ayuda a mantener el efecto del alisado progresivo por mas tiempo",
        recomendado="Cabello con alisado progresivo reciente",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-pos-progressiva-haskell/",
    ),
    "Queratina & Provit B5": dict(
        subcat_pt="Reconstrucao proteica", subcat_es="Reconstruccion proteica",
        activos_pt=["Queratina vegetal", "Pro-vitamina B5 (D-pantenol)"],
        activos_es=["Queratina vegetal", "Pro-vitamina B5 (D-pantenol)"],
        proposito="repone masa proteica y reconstruye la fibra capilar danada",
        recomendado="Cabello danado por procesos quimicos, termicos o mecanicos",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-queratina-haskell/",
    ),
    "Quina Rosa": dict(
        subcat_pt="Brilho e controle de frizz", subcat_es="Brillo y control de frizz",
        activos_pt=["Extrato de quina rosa"], activos_es=["Extracto de quina rosa"],
        proposito="revitaliza el cabello opaco, reduce el frizz y aporta brillo",
        recomendado="Cabello opaco, con frizz o sin vida",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-quina-rosa-haskell/",
    ),
    "Se Curve": dict(
        subcat_pt="Cuidado para cabelo cacheado, crespo e ondulado", subcat_es="Cuidado para cabello rizado, ondulado y afro",
        activos_pt=["Rosa mosqueta", "Manteiga de karite", "Manteiga de cupuacu", "Manteiga de murumuru",
                     "Colageno vegetal", "Cana-de-acucar", "Goma de tapioca", "Arginina", "Babosa"],
        activos_es=["Rosa mosqueta", "Manteca de karite", "Manteca de cupuazu", "Manteca de murumuru",
                     "Colageno vegetal", "Cana de azucar", "Goma de tapioca", "Arginina", "Aloe vera"],
        proposito="nutre y define las curvas naturales del cabello, desde ondas hasta rizos muy cerrados",
        recomendado="Cabello ondulado, rizado o afro (curvaturas 2A a 4C)",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/se-curve/",
    ),
    "S.O.S Verao": dict(
        subcat_pt="Protecao solar e contra cloro", subcat_es="Proteccion solar y contra el cloro",
        activos_pt=["Oleo de girassol", "Vitamina E"], activos_es=["Aceite de girasol", "Vitamina E"],
        proposito="protege el cabello del sol, el mar y la piscina, y ayuda a evitar el tono verdoso del cloro",
        recomendado="Cabello expuesto al sol, al mar o a la piscina",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-pos-sol-sos-verao-haskell/",
    ),
    "Supermascaras": dict(
        subcat_pt="Tratamento ultraintensivo especializado", subcat_es="Tratamiento ultraintensivo especializado",
        activos_pt=[], activos_es=[],
        proposito="ofrece un tratamiento concentrado de alto rendimiento para una necesidad especifica del cabello",
        recomendado="Cabello que necesita un tratamiento intensivo puntual",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/supermascaras/",
    ),
    "Tutano Vegetal": dict(
        subcat_pt="Forca e nutricao profunda", subcat_es="Fuerza y nutricion profunda",
        activos_pt=["Tutano vegetal (blend de oleos)"], activos_es=["Tutano vegetal (mezcla de aceites)"],
        proposito="aporta fuerza y nutricion profunda a cabello fragil, reseco o quebradizo",
        recomendado="Cabello fragil, reseco o quebradizo",
        url="https://haskellcosmeticos.com.br/tratamentos-capilares/linha-tutano-haskell/",
    ),
}

TIPOS = {
    "Shampoo": dict(
        tipo_es="Champu",
        desc="Champu de limpieza suave de la linea {linea}, que prepara el cabello para el tratamiento: {proposito}.",
        beneficios=["Limpieza suave sin resecar", "Prepara el cabello para el resto de la rutina", "Respeta el equilibrio del cuero cabelludo"],
        propiedades=["Limpiador suave"],
        modo_uso="Aplicar sobre el cabello mojado, masajear el cuero cabelludo con movimientos suaves y enjuagar bien.",
    ),
    "Condicionador": dict(
        tipo_es="Acondicionador",
        desc="Acondicionador de la linea {linea} que facilita el desenredado y sella la cuticula: {proposito}.",
        beneficios=["Facilita el desenredado", "Sella la cuticula", "Aporta suavidad y brillo"],
        propiedades=["Acondicionador"],
        modo_uso="Aplicar en el largo y las puntas del cabello despues del champu, dejar actuar unos minutos y enjuagar.",
    ),
    "Mascara de Tratamento": dict(
        tipo_es="Mascarilla de tratamiento",
        desc="Mascarilla de tratamiento concentrada de la linea {linea}, de uso posterior al champu: {proposito}.",
        beneficios=["Tratamiento concentrado", "Actua en profundidad sobre la fibra capilar", "Refuerza el resultado de la linea"],
        propiedades=["Tratamiento intensivo"],
        modo_uso="Aplicar mechon por mechon despues del champu, dejar actuar de 3 a 5 minutos y enjuagar bien.",
    ),
    "Fluido": dict(
        tipo_es="Fluido finalizador",
        desc="Fluido finalizador sin enjuague de la linea {linea}: {proposito}.",
        beneficios=["Finalizador sin enjuague", "Facilita el peinado", "Protege del calor y de agresiones externas"],
        propiedades=["Finalizador"],
        modo_uso="Aplicar sobre el cabello limpio y humedo, distribuir en todo el largo y finalizar como se prefiera.",
    ),
    "Leave In": dict(
        tipo_es="Leave-in",
        desc="Leave-in sin enjuague de la linea {linea} que facilita el peinado: {proposito}.",
        beneficios=["Facilita el peinado", "Reduce el frizz", "Protege del calor"],
        propiedades=["Leave-in"],
        modo_uso="Aplicar sobre el cabello limpio y humedo, sin enjuagar, y finalizar como se prefiera.",
    ),
    "Tonico": dict(
        tipo_es="Tonico capilar",
        desc="Tonico capilar de la linea {linea}, de uso directo sobre el cuero cabelludo: {proposito}.",
        beneficios=["Estimula el cuero cabelludo", "Refuerza la raiz del cabello"],
        propiedades=["Tonico capilar"],
        modo_uso="Aplicar directamente sobre el cuero cabelludo limpio y masajear suavemente. No es necesario enjuagar.",
    ),
    "Nectavita": dict(
        tipo_es="Potenciador pre-champu",
        desc="Potenciador pre-champu (nectavita) de la linea {linea}, para usar antes del lavado: {proposito}.",
        beneficios=["Prepara el cuero cabelludo antes del champu", "Potencia el efecto del tratamiento"],
        propiedades=["Pre-champu"],
        modo_uso="Aplicar sobre el cuero cabelludo antes del champu, masajear y proceder con el lavado habitual.",
    ),
    "Oleo": dict(
        tipo_es="Aceite capilar",
        desc="Aceite capilar finalizador de la linea {linea}, que aporta brillo: {proposito}.",
        beneficios=["Aporta brillo", "Sella las puntas", "Protege del resecamiento"],
        propiedades=["Aceite finalizador"],
        modo_uso="Aplicar unas gotas en el largo y las puntas del cabello seco o humedo.",
    ),
    "Serum": dict(
        tipo_es="Serum capilar",
        desc="Serum capilar sin enjuague de la linea {linea}, de textura liviana: {proposito}.",
        beneficios=["Aporta brillo intenso", "Ayuda a controlar el frizz", "Textura liviana, no apelmaza"],
        propiedades=["Serum finalizador"],
        modo_uso="Aplicar una pequena cantidad en el largo y las puntas del cabello seco o humedo.",
    ),
    "Pomada": dict(
        tipo_es="Pomada modeladora",
        desc="Pomada modeladora de la linea {linea} que fija y da forma al peinado: {proposito}.",
        beneficios=["Fija el peinado", "Da forma y control", "Textura maleable"],
        propiedades=["Modelador"],
        modo_uso="Tomar una pequena cantidad, calentar entre las manos y aplicar sobre el cabello seco para modelar.",
    ),
    "Creme": dict(
        tipo_es="Crema",
        desc="Crema de la linea {linea}: {proposito}.",
        beneficios=["Facilita el peinado", "Hidrata y da forma segun el uso"],
        propiedades=["Multifuncion"],
        modo_uso="Aplicar sobre el cabello humedo o seco, segun la necesidad, y finalizar como se prefiera.",
    ),
    "Balm": dict(
        tipo_es="Balsamo",
        desc="Balsamo de accion reparadora de la linea {linea}: {proposito}.",
        beneficios=["Accion reparadora localizada", "Complementa el tratamiento de la linea"],
        propiedades=["Balsamo tratante"],
        modo_uso="Aplicar sobre el cabello segun las indicaciones del envase, como parte de la rutina de la linea.",
    ),
    "Mousse": dict(
        tipo_es="Espuma modeladora",
        desc="Espuma modeladora de la linea {linea}: {proposito}.",
        beneficios=["Define la forma natural del cabello", "Controla el volumen", "No apelmaza"],
        propiedades=["Modelador"],
        modo_uso="Aplicar sobre el cabello humedo, distribuir con las manos y dejar secar al natural o con difusor.",
    ),
    "Goma": dict(
        tipo_es="Gel texturizador",
        desc="Gel texturizador de la linea {linea}: {proposito}.",
        beneficios=["Define y fija sin apelmazar", "Controla el frizz", "Textura maleable"],
        propiedades=["Texturizador"],
        modo_uso="Aplicar sobre el cabello humedo, distribuir mechon por mechon para definir la forma deseada.",
    ),
    "Finalizador": dict(
        tipo_es="Finalizador",
        desc="Finalizador sin enjuague de la linea {linea}: {proposito}.",
        beneficios=["Facilita el peinado", "Protege del calor y de agresiones externas"],
        propiedades=["Finalizador"],
        modo_uso="Aplicar sobre el cabello limpio y humedo, distribuir en todo el largo.",
    ),
    "Esfoliante": dict(
        tipo_es="Exfoliante corporal",
        desc="Exfoliante corporal de la coleccion {linea}: {proposito}.",
        beneficios=["Elimina celulas muertas", "Deja la piel suave", "Fragancia de la coleccion"],
        propiedades=["Exfoliante corporal"],
        modo_uso="Aplicar sobre la piel humeda, masajear con movimientos circulares y enjuagar.",
    ),
    "Hidratante Labial": dict(
        tipo_es="Balsamo labial",
        desc="Balsamo labial de la coleccion {linea}: {proposito}.",
        beneficios=["Hidrata los labios", "Efecto gloss", "Fragancia de la coleccion"],
        propiedades=["Balsamo labial"],
        modo_uso="Aplicar directamente sobre los labios cuantas veces sea necesario.",
    ),
}

RAW = [
    ("Acidificante", "Mascara de Tratamento", "Supermascara Acidificante Redutor de pH 240g", "Supermascarilla acidificante reductora de pH 240 g", 240, "g", 74.90, 59.90),
    ("Acidificante", "Shampoo", "Shampoo Acidificante 300ml", "Champu acidificante 300 ml", 300, "ml", 62.90, None),
    ("Acidificante", "Fluido", "Fluido Reconstrutor Acidificante 200ml", "Fluido reconstructor acidificante 200 ml", 200, "ml", 59.90, None),

    ("Acidificante Matizadora", "Mascara de Tratamento", "Supermascara Acidificante Matizadora 240g", "Supermascarilla acidificante matizadora 240 g", 240, "g", 74.90, None),
    ("Acidificante Matizadora", "Shampoo", "Shampoo Acidificante Matizador 300ml", "Champu acidificante matizador 300 ml", 300, "ml", 62.90, None),
    ("Acidificante Matizadora", "Balm", "Balm Cicatrizante Acidificante Matizador 100ml", "Balsamo cicatrizante acidificante matizador 100 ml", 100, "ml", 95.90, None),

    ("Ametista Desamareladora", "Shampoo", "Shampoo Ametista Desamareladora 300ml", "Champu amatista desamarilladora 300 ml", 300, "ml", 62.90, 55.99),
    ("Ametista Desamareladora", "Condicionador", "Condicionador Ametista Desamareladora 300ml", "Acondicionador amatista desamarilladora 300 ml", 300, "ml", 62.90, 55.99),
    ("Ametista Desamareladora", "Mascara de Tratamento", "Mascara de Tratamento Ametista Desamareladora 300g", "Mascarilla de tratamiento amatista desamarilladora 300 g", 300, "g", 74.90, 66.69),
    ("Ametista Desamareladora", "Fluido", "Fluido Iluminador Ametista Desamareladora 120ml", "Fluido iluminador amatista desamarilladora 120 ml", 120, "ml", 48.90, 43.49),

    ("Bananeira Pos-Quimica", "Shampoo", "Shampoo Bananeira Pos-Quimica 300ml", "Champu Bananeira Posquimica 300 ml", 300, "ml", 62.90, None),
    ("Bananeira Pos-Quimica", "Shampoo", "Shampoo Bananeira Pos Quimica 500ml", "Champu Bananeira Posquimica 500 ml", 500, "ml", 84.90, None),
    ("Bananeira Pos-Quimica", "Condicionador", "Condicionador Bananeira Pos-Quimica 300ml", "Acondicionador Bananeira Posquimica 300 ml", 300, "ml", 62.90, None),
    ("Bananeira Pos-Quimica", "Condicionador", "Condicionador Bananeira Pos Quimica 500ml", "Acondicionador Bananeira Posquimica 500 ml", 500, "ml", 84.90, None),
    ("Bananeira Pos-Quimica", "Mascara de Tratamento", "Mascara de Tratamento Bananeira Pos-Quimica 300g", "Mascarilla de tratamiento Bananeira Posquimica 300 g", 300, "g", 74.90, None),
    ("Bananeira Pos-Quimica", "Mascara de Tratamento", "Mascara de Tratamento Bananeira Pos-Quimica 500g", "Mascarilla de tratamiento Bananeira Posquimica 500 g", 500, "g", 89.90, None),
    ("Bananeira Pos-Quimica", "Fluido", "Fluido Obrigatorio Bananeira Pos-Quimica 120ml", "Fluido obligatorio Bananeira Posquimica 120 ml", 120, "ml", 48.90, None),
    ("Bananeira Pos-Quimica", "Nectavita", "Nectavita Bananeira Pos-Quimica 35ml", "Nectavita Bananeira Posquimica 35 ml", 35, "ml", 25.90, None),

    ("Cavalo Forte Hidra", "Shampoo", "Shampoo Cavalo Forte Hidra 300ml", "Champu Cavalo Forte Hidra 300 ml", 300, "ml", 62.90, None),
    ("Cavalo Forte Hidra", "Shampoo", "Shampoo Cavalo Forte Hidra 500ml", "Champu Cavalo Forte Hidra 500 ml", 500, "ml", 84.90, None),
    ("Cavalo Forte Hidra", "Condicionador", "Condicionador Cavalo Forte Hidra 300ml", "Acondicionador Cavalo Forte Hidra 300 ml", 300, "ml", 62.90, None),
    ("Cavalo Forte Hidra", "Condicionador", "Condicionador Cavalo Forte Hidra 500ml", "Acondicionador Cavalo Forte Hidra 500 ml", 500, "ml", 84.90, None),
    ("Cavalo Forte Hidra", "Mascara de Tratamento", "Mascara de Tratamento Cavalo Forte Hidra 300g", "Mascarilla de tratamiento Cavalo Forte Hidra 300 g", 300, "g", 74.90, None),
    ("Cavalo Forte Hidra", "Mascara de Tratamento", "Mascara de Tratamento Cavalo Forte Hidra 500g", "Mascarilla de tratamiento Cavalo Forte Hidra 500 g", 500, "g", 89.90, None),
    ("Cavalo Forte Hidra", "Fluido", "Fluido Hidratante Cavalo Forte Hidra 120ml", "Fluido hidratante Cavalo Forte Hidra 120 ml", 120, "ml", 48.90, None),

    ("Doce de Leite Vicosa", "Esfoliante", "Esfoliante Corporal Doce de Leite 150g", "Exfoliante corporal Doce de Leite 150 g", 150, "g", 43.90, 26.34),
    ("Doce de Leite Vicosa", "Hidratante Labial", "Hidratante Labial Doce de Leite 10g", "Balsamo labial hidratante Doce de Leite 10 g", 10, "g", 25.90, 15.54),
    ("Doce de Leite Vicosa", "Shampoo", "Shampoo Doce de Leite 300ml", "Champu Doce de Leite 300 ml", 300, "ml", 62.90, 37.74),

    ("Encorpa Cabelo", "Fluido", "Fluido Engrossador Encorpa Cabelo 120ml", "Fluido engrosador Encorpa Cabelo 120 ml", 120, "ml", 48.90, 43.49),
    ("Encorpa Cabelo", "Shampoo", "Shampoo Engrossador Encorpa Cabelo 300ml", "Champu engrosador Encorpa Cabelo 300 ml", 300, "ml", 62.90, 55.99),
    ("Encorpa Cabelo", "Condicionador", "Condicionador Engrossador Encorpa Cabelo 300ml", "Acondicionador engrosador Encorpa Cabelo 300 ml", 300, "ml", 62.90, 55.99),
    ("Encorpa Cabelo", "Mascara de Tratamento", "Mascara Engrossadora Encorpa Cabelo 300g", "Mascarilla engrosadora Encorpa Cabelo 300 g", 300, "g", 74.90, 66.69),
    ("Encorpa Cabelo", "Pomada", "Pomada Modeladora Encorpa Cabelo 150g", "Pomada modeladora Encorpa Cabelo 150 g", 150, "g", 60.90, 54.19),
    ("Encorpa Cabelo", "Shampoo", "Shampoo Engrossador Encorpa Cabelo 500ml", "Champu engrosador Encorpa Cabelo 500 ml", 500, "ml", 84.90, 75.59),
    ("Encorpa Cabelo", "Condicionador", "Condicionador Engrossador Encorpa Cabelo 500ml", "Acondicionador engrosador Encorpa Cabelo 500 ml", 500, "ml", 84.90, 75.59),

    ("Pra Eles (H)", "Shampoo", "Shampoo Anticaspa Pra Eles 250ml", "Champu anticaspa Pra Eles 250 ml", 250, "ml", 53.90, 47.99),
    ("Pra Eles (H)", "Shampoo", "Shampoo Cabelo & Barba Pra Eles 250ml", "Champu cabello y barba Pra Eles 250 ml", 250, "ml", 46.90, 41.69),
    ("Pra Eles (H)", "Creme", "Creme Multifuncoes Pra Eles 150g", "Crema multifunciones Pra Eles 150 g", 150, "g", 52.90, 47.09),
    ("Pra Eles (H)", "Pomada", "Pomada Modeladora Pra Eles 55g", "Pomada modeladora Pra Eles 55 g", 55, "g", 68.90, 61.29),

    ("Hidranutre", "Shampoo", "Shampoo Hidranutre 300ml", "Champu Hidranutre 300 ml", 300, "ml", 62.90, None),
    ("Hidranutre", "Shampoo", "Shampoo Hidranutre 500ml", "Champu Hidranutre 500 ml", 500, "ml", 84.90, None),
    ("Hidranutre", "Condicionador", "Condicionador Hidranutre 300ml", "Acondicionador Hidranutre 300 ml", 300, "ml", 62.90, None),
    ("Hidranutre", "Condicionador", "Condicionador Hidranutre 500ml", "Acondicionador Hidranutre 500 ml", 500, "ml", 84.90, None),
    ("Hidranutre", "Mascara de Tratamento", "Mascara de Tratamento Hidranutre 300g", "Mascarilla de tratamiento Hidranutre 300 g", 300, "g", 74.90, None),
    ("Hidranutre", "Mascara de Tratamento", "Mascara de Tratamento Hidranutre 500g", "Mascarilla de tratamiento Hidranutre 500 g", 500, "g", 89.90, None),
    ("Hidranutre", "Leave In", "Leave In Hidranutre 150g", "Leave-in Hidranutre 150 g", 150, "g", 59.90, None),
    ("Hidranutre", "Serum", "Serum Hidranutre 35ml", "Serum Hidranutre 35 ml", 35, "ml", 61.90, None),

    ("Infusao de Oleos", "Oleo", "Oleo Nutritivo Infusao de Oleos 100ml", "Aceite nutritivo Infusion de Aceites 100 ml", 100, "ml", 95.90, None),
    ("Infusao de Oleos", "Mascara de Tratamento", "Mascara de Tratamento Infusao de Oleos 500g", "Mascarilla de tratamiento Infusion de Aceites 500 g", 500, "g", 89.90, None),
    ("Infusao de Oleos", "Condicionador", "Condicionador Infusao de Oleos 500ml", "Acondicionador Infusion de Aceites 500 ml", 500, "ml", 84.90, None),
    ("Infusao de Oleos", "Shampoo", "Shampoo Infusao de Oleos 500ml", "Champu Infusion de Aceites 500 ml", 500, "ml", 84.90, None),
    ("Infusao de Oleos", "Mascara de Tratamento", "Mascara de Tratamento Infusao de Oleos 300g", "Mascarilla de tratamiento Infusion de Aceites 300 g", 300, "g", 74.90, None),
    ("Infusao de Oleos", "Condicionador", "Condicionador Infusao de Oleos 300ml", "Acondicionador Infusion de Aceites 300 ml", 300, "ml", 62.90, None),

    ("Jaborandi Antiqueda", "Shampoo", "Shampoo Jaborandi Antiqueda 300ml", "Champu Jaborandi Anticaida 300 ml", 300, "ml", 58.90, None),
    ("Jaborandi Antiqueda", "Shampoo", "Shampoo Jaborandi Antiqueda 500ml", "Champu Jaborandi Anticaida 500 ml", 500, "ml", 76.90, None),
    ("Jaborandi Antiqueda", "Shampoo", "Shampoo Jaborandi Antiqueda 1L", "Champu Jaborandi Anticaida 1 L", 1000, "ml", 118.90, None),
    ("Jaborandi Antiqueda", "Condicionador", "Condicionador Jaborandi Antiqueda 300ml", "Acondicionador Jaborandi Anticaida 300 ml", 300, "ml", 58.90, None),
    ("Jaborandi Antiqueda", "Condicionador", "Condicionador Jaborandi Antiqueda 500ml", "Acondicionador Jaborandi Anticaida 500 ml", 500, "ml", 76.90, None),
    ("Jaborandi Antiqueda", "Tonico", "Tonico Fortalecedor Jaborandi Antiqueda 120ml", "Tonico fortalecedor Jaborandi Anticaida 120 ml", 120, "ml", 48.90, None),
    ("Jaborandi Antiqueda", "Nectavita", "Nectavita Jaborandi Antiqueda 35ml", "Nectavita Jaborandi Anticaida 35 ml", 35, "ml", 25.90, None),

    ("Liso com Forca", "Leave In", "Leave In Disciplinante Liso com Forca 150g", "Leave-in disciplinante Liso con Fuerza 150 g", 150, "g", 59.90, 53.29),
    ("Liso com Forca", "Shampoo", "Shampoo Disciplinante Liso com Forca 300ml", "Champu disciplinante Liso con Fuerza 300 ml", 300, "ml", 62.90, 55.99),
    ("Liso com Forca", "Shampoo", "Shampoo Disciplinante Liso com Forca 500ml", "Champu disciplinante Liso con Fuerza 500 ml", 500, "ml", 84.90, 75.59),
    ("Liso com Forca", "Condicionador", "Condicionador Disciplinante Liso com Forca 300ml", "Acondicionador disciplinante Liso con Fuerza 300 ml", 300, "ml", 62.90, 55.99),
    ("Liso com Forca", "Condicionador", "Condicionador Disciplinante Liso com Forca 500ml", "Acondicionador disciplinante Liso con Fuerza 500 ml", 500, "ml", 84.90, 75.59),
    ("Liso com Forca", "Mascara de Tratamento", "Mascara Disciplinante Liso com Forca 300g", "Mascarilla disciplinante Liso con Fuerza 300 g", 300, "g", 74.90, 66.69),
    ("Liso com Forca", "Mascara de Tratamento", "Mascara Disciplinante Liso com Forca 500g", "Mascarilla disciplinante Liso con Fuerza 500 g", 500, "g", 89.90, 79.99),

    ("Mandioca", "Shampoo", "Shampoo Mandioca 300ml", "Champu Mandioca 300 ml", 300, "ml", 58.90, 52.39),

    ("Matiza+", "Shampoo", "Shampoo Pre-Matizacao Matiza+ 300ml", "Champu pre-matizacion Matiza+ 300 ml", 300, "ml", 68.90, None),
    ("Matiza+", "Mascara de Tratamento", "Mascara Matizadora Violeta Matiza+ 300g", "Mascarilla matizadora violeta Matiza+ 300 g", 300, "g", 78.90, None),
    ("Matiza+", "Mascara de Tratamento", "Mascara Matizadora Ultravioleta Matiza+ 300g", "Mascarilla matizadora ultravioleta Matiza+ 300 g", 300, "g", 78.90, None),
    ("Matiza+", "Mascara de Tratamento", "Mascara Matizadora Ultravioleta Matiza+ 90g", "Mascarilla matizadora ultravioleta Matiza+ 90 g", 90, "g", 34.90, None),
    ("Matiza+", "Mascara de Tratamento", "Mascara Matizadora Violeta Matiza+ 90g", "Mascarilla matizadora violeta Matiza+ 90 g", 90, "g", 34.90, None),

    ("Ora-pro-nobis", "Shampoo", "Shampoo Ora-Pro-Nobis 300ml", "Champu Ora-pro-nobis 300 ml", 300, "ml", 58.90, None),
    ("Ora-pro-nobis", "Shampoo", "Shampoo Ora-Pro-Nobis 500ml", "Champu Ora-pro-nobis 500 ml", 500, "ml", 76.90, None),
    ("Ora-pro-nobis", "Condicionador", "Condicionador Ora-Pro-Nobis 300ml", "Acondicionador Ora-pro-nobis 300 ml", 300, "ml", 58.90, None),
    ("Ora-pro-nobis", "Condicionador", "Condicionador Ora-Pro-Nobis 500ml", "Acondicionador Ora-pro-nobis 500 ml", 500, "ml", 76.90, None),
    ("Ora-pro-nobis", "Mascara de Tratamento", "Mascara de Tratamento Ora-Pro-Nobis 300g", "Mascarilla de tratamiento Ora-pro-nobis 300 g", 300, "g", 68.90, None),
    ("Ora-pro-nobis", "Mascara de Tratamento", "Mascara de Tratamento Ora-Pro-Nobis 500g", "Mascarilla de tratamiento Ora-pro-nobis 500 g", 500, "g", 81.90, None),
    ("Ora-pro-nobis", "Finalizador", "Finalizador Fortalecedor Ora-Pro-Nobis 120ml", "Finalizador fortalecedor Ora-pro-nobis 120 ml", 120, "ml", 48.90, None),

    ("Pre-Treino", "Fluido", "Fluido Capilar Pre-Treino 200ml", "Fluido capilar Pre-entreno 200 ml", 200, "ml", 59.90, None),

    ("Pos-Progressiva", "Shampoo", "Shampoo Pos-Progressiva 300ml", "Champu Posprogresiva 300 ml", 300, "ml", 62.90, 55.99),
    ("Pos-Progressiva", "Shampoo", "Shampoo Pos-Progressiva 500ml", "Champu Posprogresiva 500 ml", 500, "ml", 84.90, 75.59),
    ("Pos-Progressiva", "Condicionador", "Condicionador Pos-Progressiva 300ml", "Acondicionador Posprogresiva 300 ml", 300, "ml", 62.90, 55.99),
    ("Pos-Progressiva", "Condicionador", "Condicionador Pos-Progressiva 500ml", "Acondicionador Posprogresiva 500 ml", 500, "ml", 84.90, 75.59),
    ("Pos-Progressiva", "Mascara de Tratamento", "Mascara de Tratamento Pos-Progressiva 300g", "Mascarilla de tratamiento Posprogresiva 300 g", 300, "g", 74.90, 66.69),
    ("Pos-Progressiva", "Mascara de Tratamento", "Mascara de Tratamento Pos-Progressiva 500g", "Mascarilla de tratamiento Posprogresiva 500 g", 500, "g", 89.90, 79.99),
    ("Pos-Progressiva", "Fluido", "Fluido Alinhador Pos-Progressiva 120ml", "Fluido alineador Posprogresiva 120 ml", 120, "ml", 48.90, 43.49),

    ("Queratina & Provit B5", "Mascara de Tratamento", "Mascara de Tratamento Queratina & Provit B5 300g", "Mascarilla de tratamiento Queratina & Provit B5 300 g", 300, "g", 68.90, None),

    ("Quina Rosa", "Shampoo", "Shampoo Quina Rosa 300ml", "Champu Quina Rosa 300 ml", 300, "ml", 58.90, None),
    ("Quina Rosa", "Shampoo", "Shampoo Quina Rosa 500ml", "Champu Quina Rosa 500 ml", 500, "ml", 76.90, None),
    ("Quina Rosa", "Shampoo", "Shampoo Quina Rosa 1L", "Champu Quina Rosa 1 L", 1000, "ml", 118.90, None),
    ("Quina Rosa", "Condicionador", "Condicionador Quina Rosa 300ml", "Acondicionador Quina Rosa 300 ml", 300, "ml", 58.90, None),
    ("Quina Rosa", "Condicionador", "Condicionador Quina Rosa 500ml", "Acondicionador Quina Rosa 500 ml", 500, "ml", 76.90, None),
    ("Quina Rosa", "Mascara de Tratamento", "Mascara de Tratamento Quina Rosa 300g", "Mascarilla de tratamiento Quina Rosa 300 g", 300, "g", 68.90, None),
    ("Quina Rosa", "Mascara de Tratamento", "Mascara de Tratamento Quina Rosa 500g", "Mascarilla de tratamiento Quina Rosa 500 g", 500, "g", 81.90, None),
    ("Quina Rosa", "Mascara de Tratamento", "Mascara de Tratamento Quina Rosa 900g", "Mascarilla de tratamiento Quina Rosa 900 g", 900, "g", 123.90, None),

    ("Se Curve", "Mousse", "Mousse Forma Cachos Se Curve 180ml", "Espuma forma rizos Se Curve 180 ml", 180, "ml", 59.90, None),
    ("Se Curve", "Mascara de Tratamento", "Mascara 3 Manteigas Se Curve 500g", "Mascarilla 3 mantecas Se Curve 500 g", 500, "g", 81.90, None),
    ("Se Curve", "Shampoo", "Shampoo Se Curve 500ml", "Champu Se Curve 500 ml", 500, "ml", 76.90, None),
    ("Se Curve", "Condicionador", "Condicionador Se Curve 500ml", "Acondicionador Se Curve 500 ml", 500, "ml", 76.90, None),
    ("Se Curve", "Creme", "Creme de Pentear Se Curve 500g", "Crema de peinar Se Curve 500 g", 500, "g", 92.90, None),
    ("Se Curve", "Tonico", "Tonico Transicao Capilar Se Curve 200ml", "Tonico transicion capilar Se Curve 200 ml", 200, "ml", 56.90, None),
    ("Se Curve", "Goma", "Curva & Cola Se Curve 500g", "Curva & Cola Se Curve 500 g", 500, "g", 92.90, None),
    ("Se Curve", "Goma", "Goma Texturizadora Se Curve 500g", "Gel texturizador Se Curve 500 g", 500, "g", 92.90, None),
    ("Se Curve", "Creme", "Modelador de Cachos Se Curve 500g", "Modelador de rizos Se Curve 500 g", 500, "g", 92.90, None),
    ("Se Curve", "Creme", "Creme Finalizador de Crespos Se Curve 500g", "Crema finalizadora de rizos afro Se Curve 500 g", 500, "g", 92.90, None),
    ("Se Curve", "Oleo", "Oleo do Poder Se Curve 60ml", "Aceite del poder Se Curve 60 ml", 60, "ml", 53.90, None),
    ("Se Curve", "Mascara de Tratamento", "Mascara Hidronutricao Se Curve 500g", "Mascarilla hidronutricion Se Curve 500 g", 500, "g", 81.90, None),
    ("Se Curve", "Mascara de Tratamento", "Mascara Poder dos Oleos Se Curve 500g", "Mascarilla poder de los aceites Se Curve 500 g", 500, "g", 81.90, None),

    ("S.O.S Verao", "Shampoo", "Shampoo Pos-Sol S.O.S Verao 300ml", "Champu pos-sol S.O.S. Verano 300 ml", 300, "ml", 62.90, None),
    ("S.O.S Verao", "Creme", "Creme Pre e Pos-Sol S.O.S Verao 240g", "Crema pre y post-sol S.O.S. Verano 240 g", 240, "g", 68.90, None),
    ("S.O.S Verao", "Mascara de Tratamento", "Mascara de Tratamento S.O.S Verao 300g", "Mascarilla de tratamiento S.O.S. Verano 300 g", 300, "g", 74.90, None),

    ("Supermascaras", "Mascara de Tratamento", "Supermascara Brilho Espelhado 240g", "Supermascarilla brillo espejado 240 g", 240, "g", 74.90, None),
    ("Supermascaras", "Mascara de Tratamento", "Supermascara Disciplinante Antifrizz 240g", "Supermascarilla disciplinante antifrizz 240 g", 240, "g", 74.90, None),
    ("Supermascaras", "Mascara de Tratamento", "Supermascara Aceleradora de Forca 240g", "Supermascarilla aceleradora de fuerza 240 g", 240, "g", 74.90, None),

    ("Tutano Vegetal", "Shampoo", "Shampoo Tutano Vegetal 300ml", "Champu Tutano Vegetal 300 ml", 300, "ml", 58.90, None),
    ("Tutano Vegetal", "Shampoo", "Shampoo Tutano Vegetal 500ml", "Champu Tutano Vegetal 500 ml", 500, "ml", 76.90, None),
    ("Tutano Vegetal", "Shampoo", "Shampoo Tutano Vegetal 1L", "Champu Tutano Vegetal 1 L", 1000, "ml", 118.90, None),
    ("Tutano Vegetal", "Condicionador", "Condicionador Tutano Vegetal 300ml", "Acondicionador Tutano Vegetal 300 ml", 300, "ml", 58.90, None),
    ("Tutano Vegetal", "Condicionador", "Condicionador Tutano Vegetal 500ml", "Acondicionador Tutano Vegetal 500 ml", 500, "ml", 76.90, None),
    ("Tutano Vegetal", "Condicionador", "Condicionador Tutano Vegetal 1L", "Acondicionador Tutano Vegetal 1 L", 1000, "ml", 118.90, None),
    ("Tutano Vegetal", "Mascara de Tratamento", "Mascara de Tratamento Tutano Vegetal 300g", "Mascarilla de tratamiento Tutano Vegetal 300 g", 300, "g", 68.90, None),
]

def construir_productos_nuevos():
    productos = []
    for linea, tipo_key, nombre_pt, nombre_es, cantidad, unidad, precio, oferta in RAW:
        lm = LINEAS[linea]
        tm = TIPOS[tipo_key]
        desc = tm["desc"].format(linea=linea, proposito=lm["proposito"])
        productos.append(dict(
            linea=linea, tipo_pt=tipo_key, tipo_es=tm["tipo_es"],
            nombre_pt=nombre_pt, nombre_es=nombre_es,
            cantidad=cantidad, unidad=unidad, precio_brl=precio, precio_oferta_brl=oferta,
            subcat_pt=lm["subcat_pt"], subcat_es=lm["subcat_es"],
            desc_es=desc,
            beneficios=tm["beneficios"],
            propiedades=tm["propiedades"],
            modo_uso=tm["modo_uso"],
            activos_pt=lm["activos_pt"], activos_es=lm["activos_es"],
            recomendado=lm["recomendado"],
            url=lm["url"],
        ))
    return productos

if __name__ == "__main__":
    productos = construir_productos_nuevos()
    print("Total productos nuevos generados:", len(productos))
    lineas_set = sorted(set(p["linea"] for p in productos))
    print("Total lineas nuevas:", len(lineas_set))
    for l in lineas_set:
        print(" -", l)
