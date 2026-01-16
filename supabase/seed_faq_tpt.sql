-- Seed data for TPT/Landlord Tax FAQ Knowledge Base
-- Run this after the 00014_create_knowledge_base.sql migration

-- Insert FAQ Categories
INSERT INTO faq_categories (name, name_fr, description, sort_order) VALUES
('general_tpt', 'Generalites TPT', 'Informations generales sur la Taxe sur la Propriete Batie', 1),
('registration', 'Enregistrement', 'Enregistrement des bailleurs, biens et contrats de bail', 2),
('tax_obligations', 'Obligations Fiscales', 'Obligations fiscales des bailleurs', 3),
('declarations', 'Declarations', 'Declarations fiscales et delais', 4),
('calculation_payment', 'Calcul et Paiement', 'Calcul et modes de paiement de la TPT', 5),
('online_platforms', 'Plateformes', 'eTax et procedures en ligne', 6),
('documents', 'Documents', 'Documents requis', 7),
('penalties', 'Sanctions', 'Penalites en cas de non-conformite', 8),
('other_taxes', 'Autres Taxes', 'Autres taxes applicables aux bailleurs', 9)
ON CONFLICT (name) DO NOTHING;

-- Insert FAQ Entries

-- 1. Generalites TPT
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'general_tpt'),
  'Qu''est-ce que la TPT (Taxe sur la Propriete Batie) et qui doit la payer ?',
  'La Taxe sur la Propriete Batie (TPT), aussi appelee Contribution Fonciere des Proprietes Baties (CFPB), est un impot local annuel au Senegal qui frappe les proprietes construites. Elle est due par tout proprietaire d''un bien immobilier bati, qu''il soit occupe par le proprietaire lui-meme, loue ou vacant.

**Qui doit payer ?**
- Les proprietaires de maisons, appartements, immeubles
- Les proprietaires de locaux commerciaux ou industriels
- Les proprietaires de terrains amenages (parkings, etc.)

**Taux applicable :**
- 5% de la valeur locative pour les proprietes d''habitation et commerciales
- 7,5% pour les proprietes industrielles

**Exonerations possibles :**
- Constructions nouvelles pendant 5 ans (sur demande)
- Batiments a usage agricole
- Edifices publics et religieux',
  ARRAY['tpt', 'cfpb', 'taxe', 'propriete', 'batie', 'foncier', 'impot', 'proprietaire', 'contribution', 'taux', '5%', 'valeur locative']
),
(
  (SELECT id FROM faq_categories WHERE name = 'general_tpt'),
  'Quelle est la difference entre TPT et CFPB ?',
  'La TPT (Taxe sur la Propriete Batie) et la CFPB (Contribution Fonciere des Proprietes Baties) designent le meme impot. CFPB est l''ancienne appellation, tandis que TPT est la denomination actuelle. Les deux termes sont encore utilises de maniere interchangeable dans la pratique.

L''impot est calcule de la meme maniere :
- Base : Valeur locative du bien
- Taux : 5% (habitation/commerce) ou 7,5% (industrie)
- Periodicite : Annuelle
- Beneficiaire : Collectivites locales',
  ARRAY['tpt', 'cfpb', 'difference', 'taxe', 'contribution', 'fonciere', 'propriete', 'batie', 'appellation']
);

-- 2. Enregistrement
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'registration'),
  'Comment enregistrer un bien immobilier aupres des impots au Senegal ?',
  'Pour enregistrer un bien immobilier aupres de la Direction Generale des Impots et Domaines (DGID), suivez ces etapes :

**1. Obtenir un NIN (Numero d''Identification Nationale)**
- Se rendre au centre des impots de votre localite
- Fournir une piece d''identite valide (CNI ou passeport)
- Remplir le formulaire de demande de NIN

**2. Declarer le bien immobilier**
- Formulaire de declaration de propriete
- Titre de propriete ou acte de vente
- Plan de situation du terrain
- Permis de construire (si applicable)

**3. Documents requis**
- Photocopie CNI du proprietaire
- Titre foncier ou attestation de propriete
- Certificat de conformite ou permis d''habiter
- Factures d''eau/electricite recentes

**Ou s''adresser ?**
- Centre des Services Fiscaux de votre commune
- Plateforme eTax (etax.gouv.sn) pour certaines demarches',
  ARRAY['enregistrement', 'bien', 'immobilier', 'impots', 'dgid', 'nin', 'declaration', 'propriete', 'titre foncier', 'permis', 'documents']
),
(
  (SELECT id FROM faq_categories WHERE name = 'registration'),
  'Comment enregistrer un contrat de bail au Senegal ?',
  'L''enregistrement d''un contrat de bail est obligatoire au Senegal. Voici la procedure :

**Delai :** Le contrat doit etre enregistre dans un delai d''un mois apres sa signature.

**Lieu :** Bureau de l''Enregistrement et du Timbre (recette des impots)

**Documents requis :**
- 4 exemplaires du contrat de bail signe
- Photocopies des CNI du bailleur et du locataire
- NIN du bailleur
- Justificatif de propriete du bien

**Frais d''enregistrement :**
- 2% du montant annuel du loyer + charges
- Minimum percu : 5 000 FCFA
- Timbre fiscal : 2 000 FCFA par page

**Exemple :** Pour un loyer de 200 000 FCFA/mois
- Loyer annuel : 2 400 000 FCFA
- Frais : 2% x 2 400 000 = 48 000 FCFA + timbres

**Important :** Un bail non enregistre n''est pas opposable aux tiers et peut entrainer des penalites.',
  ARRAY['bail', 'contrat', 'enregistrement', 'location', 'loyer', 'bailleur', 'locataire', 'frais', '2%', 'timbre', 'delai']
);

-- 3. Obligations Fiscales
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'tax_obligations'),
  'Quelles sont les obligations fiscales des bailleurs au Senegal ?',
  'Les bailleurs au Senegal ont plusieurs obligations fiscales :

**1. Taxe sur la Propriete Batie (TPT/CFPB)**
- Taux : 5% de la valeur locative
- Paiement : Annuel, avant le 31 janvier

**2. Impot sur les Revenus Fonciers**
- Declaration annuelle des loyers percus
- Taux progressif selon les tranches de revenus
- Abattement de 30% sur les revenus bruts

**3. Retenue a la source (pour locations > 150 000 FCFA/mois)**
- Le locataire doit retenir 5% du loyer
- Reversement mensuel a l''Etat
- Applicable aux entreprises locataires

**4. TVA sur locations meublees**
- Taux : 18% (taux normal)
- Obligatoire pour les locations meublees
- Declaration mensuelle ou trimestrielle

**5. Contribution Economique Locale (ex-patente)**
- Si activite de location a titre professionnel
- Calcul base sur la valeur locative

**6. Enregistrement des baux**
- Obligatoire dans le mois suivant la signature
- Frais : 2% du loyer annuel',
  ARRAY['obligations', 'fiscales', 'bailleur', 'tpt', 'cfpb', 'revenus fonciers', 'retenue', 'source', 'tva', 'patente', 'enregistrement', 'loyer']
),
(
  (SELECT id FROM faq_categories WHERE name = 'tax_obligations'),
  'Comment declarer les locataires de courte duree (Airbnb, meuble touristique) ?',
  'Pour les locations de courte duree (type Airbnb), les obligations sont specifiques :

**1. Enregistrement aupres de la mairie**
- Declaration d''activite de location meublee touristique
- Obtention d''un numero d''enregistrement

**2. Declaration des voyageurs (Fiche de police)**
- Obligation de declarer chaque voyageur etranger
- Dans les 24h suivant l''arrivee
- Aupres du commissariat ou via Gestoo

**3. Obligations fiscales**
- **TVA** : 18% sur le montant des locations
- **Impot sur le revenu** : Declaration des revenus de location
- **Taxe de sejour** : Variable selon la commune

**4. Pour les plateformes (Airbnb, Booking)**
- Les revenus sont declares a l''administration fiscale
- Conservation des justificatifs pendant 4 ans

**5. Formalites specifiques**
- Registre des voyageurs a tenir
- Assurance responsabilite civile professionnelle
- Respect des normes de securite

**Conseil :** Utilisez Gestoo pour automatiser la declaration des voyageurs et rester en conformite.',
  ARRAY['courte duree', 'airbnb', 'meuble', 'touristique', 'location', 'voyageur', 'declaration', 'fiche police', 'tva', 'taxe sejour', 'gestoo']
);

-- 4. Calcul et Paiement
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'calculation_payment'),
  'Comment se calcule la TPT (Taxe sur la Propriete Batie) ?',
  'Le calcul de la TPT se fait comme suit :

**Formule :**
TPT = Valeur Locative x Taux

**1. Determination de la Valeur Locative**
- Basee sur le loyer annuel reel ou theorique du bien
- Evaluee par l''administration fiscale
- Revisee periodiquement (tous les 5 ans en principe)

**2. Taux applicables**
- **5%** pour les proprietes d''habitation et commerciales
- **7,5%** pour les proprietes industrielles

**3. Exemple de calcul**
Pour un appartement loue 250 000 FCFA/mois :
- Valeur locative annuelle : 250 000 x 12 = 3 000 000 FCFA
- TPT = 3 000 000 x 5% = **150 000 FCFA/an**

**4. Abattements possibles**
- Constructions nouvelles : exoneration de 5 ans (sur demande)
- Proprietes situees en zone rurale : abattement possible

**5. Date limite de paiement**
- 31 janvier de chaque annee
- Majoration de 10% en cas de retard',
  ARRAY['calcul', 'tpt', 'cfpb', 'valeur locative', 'taux', '5%', '7.5%', 'formule', 'loyer', 'annuel', 'exemple']
),
(
  (SELECT id FROM faq_categories WHERE name = 'calculation_payment'),
  'Comment payer la TPT au Senegal ?',
  'Plusieurs modes de paiement sont disponibles pour la TPT :

**1. Paiement en ligne (eTax)**
- Connectez-vous sur etax.gouv.sn
- Selectionnez "Payer mes impots"
- Choisissez le mode de paiement (carte, Orange Money, Wave)
- Telechargez votre quittance

**2. Paiement mobile (Orange Money / Wave)**
- Via l''application Orange Money ou Wave
- Menu "Paiements" > "Impots et Taxes"
- Entrez votre NIN et le montant
- Conservez le recu de transaction

**3. Paiement bancaire**
- Virement vers le compte du Tresor Public
- Transfert au guichet de votre banque
- Reference : NIN + annee fiscale

**4. Paiement au guichet**
- Au Centre des Services Fiscaux
- A la Perception municipale
- En especes ou par cheque

**Documents a presenter :**
- NIN (Numero d''Identification Nationale)
- Avis d''imposition ou reference du bien

**Delai :** Avant le 31 janvier pour eviter les penalites.',
  ARRAY['paiement', 'tpt', 'cfpb', 'etax', 'orange money', 'wave', 'banque', 'guichet', 'mode', 'en ligne', 'mobile']
);

-- 5. Plateformes en ligne
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'online_platforms'),
  'Comment utiliser la plateforme eTax pour les impots ?',
  'eTax est la plateforme en ligne de la DGID pour les demarches fiscales :

**Acces :** etax.gouv.sn

**1. Creer un compte**
- Cliquez sur "S''inscrire"
- Renseignez votre NIN
- Creez un mot de passe securise
- Validez par email/SMS

**2. Services disponibles**
- Declaration d''impots en ligne
- Paiement des taxes (TPT, TVA, IR...)
- Consultation des avis d''imposition
- Demande d''attestations fiscales
- Suivi des demarches

**3. Declarer la TPT**
- Menu "Mes declarations"
- Selectionnez "Contribution fonciere"
- Renseignez les informations du bien
- Validez et payez en ligne

**4. Modes de paiement acceptes**
- Carte bancaire (Visa, Mastercard)
- Orange Money
- Wave
- Virement bancaire

**5. Avantages**
- Disponible 24h/24
- Quittances telechargables
- Historique des paiements
- Alertes et rappels

**Assistance :** support@etax.gouv.sn ou 33 889 20 20',
  ARRAY['etax', 'plateforme', 'en ligne', 'dgid', 'declaration', 'paiement', 'compte', 'inscription', 'impots', 'taxes', 'internet']
),
(
  (SELECT id FROM faq_categories WHERE name = 'online_platforms'),
  'Comment obtenir une attestation fiscale en ligne ?',
  'Pour obtenir une attestation de regularite fiscale via eTax :

**1. Connexion**
- Allez sur etax.gouv.sn
- Connectez-vous avec votre NIN et mot de passe

**2. Demande d''attestation**
- Menu "Mes demarches"
- Selectionnez "Demande d''attestation"
- Choisissez le type d''attestation :
  * Attestation de regularite fiscale
  * Attestation de non-redevance
  * Attestation de situation fiscale

**3. Verification**
- Le systeme verifie votre situation
- Si vous etes a jour, l''attestation est generee
- Si des arrieres existent, payez-les d''abord

**4. Telechargement**
- L''attestation est disponible immediatement
- Format PDF avec code QR de verification
- Validite : 3 mois en general

**5. Verification par des tiers**
- Toute attestation peut etre verifiee en ligne
- Scanner le QR code
- Ou entrer le numero de reference sur eTax

**Delai :** Immediat si situation reguliere',
  ARRAY['attestation', 'fiscale', 'regularite', 'etax', 'en ligne', 'telechargement', 'demande', 'verification', 'qr code', 'dgid']
);

-- 6. Documents requis
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'documents'),
  'Quels documents sont necessaires pour les demarches fiscales immobilieres ?',
  'Voici les documents requis selon les demarches :

**1. Enregistrement d''un bien**
- Carte nationale d''identite (CNI)
- Titre de propriete ou acte de vente notarie
- Permis de construire
- Certificat de conformite
- Plan cadastral

**2. Enregistrement d''un bail**
- 4 exemplaires du contrat de bail
- CNI du bailleur et du locataire
- NIN du bailleur
- Justificatif de propriete

**3. Declaration TPT**
- NIN
- Avis d''imposition precedent (si existant)
- Justificatifs de la valeur locative

**4. Declaration des revenus fonciers**
- Contrats de bail enregistres
- Releves des loyers percus
- Justificatifs de charges deductibles
- Quittances de loyer

**5. Demande d''exoneration**
- Demande ecrite motivee
- Permis de construire (date de construction)
- Certificat de conformite
- Attestation de premiere occupation

**Conservation :** Gardez tous les documents pendant 4 ans minimum.',
  ARRAY['documents', 'pieces', 'demarches', 'fiscales', 'cni', 'titre', 'propriete', 'bail', 'nin', 'permis', 'certificat']
);

-- 7. Sanctions
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'penalties'),
  'Quelles sont les penalites en cas de retard ou non-paiement des impots fonciers ?',
  'Les sanctions pour non-respect des obligations fiscales sont :

**1. Retard de paiement de la TPT**
- Majoration de **10%** du montant du
- Interets de retard : **0,5% par mois** (plafonne a 40% maximum)
- Exemple : TPT de 100 000 FCFA, retard de 6 mois
  * Majoration : 10 000 FCFA
  * Interets : 3 000 FCFA (0,5% x 6 x 100 000)
  * Total : 113 000 FCFA

**2. Defaut de declaration**
- Amende de **25 000 a 500 000 FCFA**
- Taxation d''office par l''administration
- Majoration de 40% sur l''impot evalue

**3. Non-enregistrement des baux**
- Amende de **50 000 FCFA minimum**
- Bail non opposable aux tiers
- Perte de certains recours juridiques

**4. Fraude fiscale**
- Sanctions penales possibles
- Amende jusqu''a 5 fois l''impot elude
- Emprisonnement de 1 a 5 ans

**5. Recouvrement force**
- Avis a tiers detenteur (saisie sur compte)
- Saisie immobiliere
- Vente aux encheres du bien

**Conseil :** Payez a temps et conservez vos justificatifs.',
  ARRAY['penalites', 'sanctions', 'retard', 'amende', 'majoration', 'interets', 'non-paiement', 'fraude', 'recouvrement', 'saisie']
);

-- 8. Autres taxes
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'other_taxes'),
  'Quelles autres taxes s''appliquent aux bailleurs au Senegal ?',
  'En plus de la TPT, les bailleurs peuvent etre redevables de :

**1. Impot sur les Revenus Fonciers**
- Declaration annuelle (avant le 30 avril)
- Abattement forfaitaire de 30%
- Bareme progressif de l''IR

**2. Contribution Economique Locale (ex-Patente)**
- Pour activite de location professionnelle
- Droit fixe + droit proportionnel
- Base : valeur locative des locaux

**3. Taxe d''Enlevement des Ordures Menageres (TEOM)**
- Taxe municipale
- Variable selon la commune
- Generalement 5-10% de la TPT

**4. TVA sur locations meublees**
- Taux : 18%
- Obligatoire au-dela d''un seuil
- Declaration mensuelle ou trimestrielle

**5. Retenue a la source (5%)**
- Applicable si locataire est une entreprise
- Loyer mensuel > 150 000 FCFA
- Retenue par le locataire

**6. Taxe de sejour (locations touristiques)**
- Fixee par les communes
- 500 a 2000 FCFA/nuit/personne
- Collectee aupres des voyageurs

**7. Taxe sur les plus-values immobilieres**
- En cas de vente du bien
- 10% sur la plus-value realisee',
  ARRAY['autres taxes', 'revenus fonciers', 'patente', 'teom', 'ordures', 'tva', 'retenue source', 'taxe sejour', 'plus-value', 'contribution']
),
(
  (SELECT id FROM faq_categories WHERE name = 'other_taxes'),
  'Comment fonctionne la CGF (Contribution Globale Fonciere) ?',
  'La Contribution Globale Fonciere (CGF) est un regime simplifie pour les petits bailleurs :

**1. Qu''est-ce que la CGF ?**
- Regime fiscal simplifie
- Regroupe TPT + Impot sur revenus fonciers
- Pour les proprietaires a revenus modestes

**2. Conditions d''eligibilite**
- Revenus fonciers annuels < 30 000 000 FCFA
- Pas d''autre activite imposable
- Sur option du contribuable

**3. Calcul de la CGF**
Base : Revenus locatifs annuels

| Tranche de revenus | Taux CGF |
|-------------------|----------|
| <= 12 000 000 FCFA | 1 mois de loyer |
| 12 - 18 000 000 FCFA | 1,5 mois de loyer |
| 18 - 30 000 000 FCFA | 2 mois de loyer |

**4. Avantages**
- Simplification administrative
- Un seul paiement annuel
- Exoneration de TVA (si < seuil)

**5. Paiement**
- Avant le 31 janvier
- Via eTax ou au guichet
- Quittance unique

**6. Exemple**
Loyer de 200 000 FCFA/mois (2 400 000 FCFA/an) :
- Tranche : <= 12 000 000 FCFA
- CGF = 1 mois = **200 000 FCFA/an**',
  ARRAY['cgf', 'contribution globale fonciere', 'regime simplifie', 'petits bailleurs', 'calcul', 'tranches', 'revenus fonciers', 'option', 'seuil']
);

-- Additional useful entries
INSERT INTO faq_entries (category_id, question, answer, keywords) VALUES
(
  (SELECT id FROM faq_categories WHERE name = 'general_tpt'),
  'Quelles sont les dates limites importantes pour les impots fonciers ?',
  'Calendrier fiscal pour les proprietaires bailleurs :

**Janvier**
- **31 janvier** : Date limite de paiement de la TPT/CFPB
- **31 janvier** : Date limite CGF (Contribution Globale Fonciere)

**Avril**
- **30 avril** : Declaration annuelle des revenus fonciers
- **30 avril** : Declaration de l''impot sur le revenu global

**Mensuel**
- **15 du mois** : TVA (si applicable)
- **15 du mois** : Reversement retenue a la source

**A chaque bail**
- **1 mois** apres signature : Enregistrement obligatoire

**Pour les locations courte duree**
- **24h** apres arrivee : Declaration des voyageurs etrangers

**Penalites en cas de retard :**
- Majoration : 10%
- Interets : 0,5%/mois

**Conseil :** Configurez des rappels et utilisez eTax pour les paiements automatiques.',
  ARRAY['dates limites', 'calendrier', 'fiscal', 'delais', 'janvier', 'avril', 'mensuel', 'echeances', 'paiement', 'declaration']
);

-- Verify insertion
DO $$
DECLARE
  cat_count INTEGER;
  entry_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cat_count FROM faq_categories;
  SELECT COUNT(*) INTO entry_count FROM faq_entries;
  RAISE NOTICE 'FAQ Categories inserted: %', cat_count;
  RAISE NOTICE 'FAQ Entries inserted: %', entry_count;
END $$;
