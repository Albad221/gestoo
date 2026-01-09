# Guide Utilisateur - Administrateur

## Introduction

Ce guide est destine aux agents du Ministere du Tourisme, aux forces de l'ordre et aux administrateurs de la plateforme Gestoo. Il couvre l'utilisation du tableau de bord administrateur pour la surveillance, la gestion des alertes et l'analyse des donnees.

---

## Table des matieres

1. [Connexion et authentification](#connexion-et-authentification)
2. [Tableau de bord](#tableau-de-bord)
3. [Gestion des alertes](#gestion-des-alertes)
4. [Recherche de voyageurs](#recherche-de-voyageurs)
5. [Gestion des proprietes](#gestion-des-proprietes)
6. [Statistiques et rapports](#statistiques-et-rapports)
7. [Intelligence marche](#intelligence-marche)

---

## Connexion et authentification

### Acces au tableau de bord

1. Rendez-vous sur **admin.gestoo.sn**
2. Entrez votre adresse email professionnelle
3. Entrez votre mot de passe
4. Si l'authentification a deux facteurs est activee:
   - Ouvrez votre application d'authentification (Google Authenticator, etc.)
   - Entrez le code a 6 chiffres

### Niveaux d'acces

| Role | Acces |
|------|-------|
| Agent Police | Alertes, Recherche voyageurs, Consultation proprietes |
| Agent Ministere | Statistiques, Validation proprietes, Rapports |
| Administrateur | Acces complet, Gestion utilisateurs |

### Securite du compte

- Changez votre mot de passe tous les 90 jours
- Ne partagez jamais vos identifiants
- Deconnectez-vous apres chaque session
- Signalez toute activite suspecte

---

## Tableau de bord

### Vue d'ensemble

Le tableau de bord principal affiche:

| Indicateur | Description |
|------------|-------------|
| Proprietes actives | Nombre d'etablissements enregistres et valides |
| Sejours actifs | Voyageurs actuellement heberges |
| Alertes ouvertes | Alertes necessitant une attention |
| Recettes TPT | Total des taxes collectees |

### Bandeau d'alertes critiques

Si des alertes critiques sont en attente, un bandeau rouge s'affiche en haut du tableau de bord. Cliquez dessus pour acceder directement aux alertes.

### Arrivees du jour

La section "Arrivees du jour" liste les derniers check-ins:
- Nom du voyageur
- Etablissement
- Ville
- Heure d'arrivee

### Actions rapides

- **Rechercher voyageur**: Recherche par nom, passeport, etc.
- **Voir alertes**: Acces au centre d'alertes
- **Verifier propriete**: Valider les inscriptions en attente
- **Statistiques**: Rapports et analyses

---

## Gestion des alertes

### Types d'alertes

| Type | Severite | Description |
|------|----------|-------------|
| Mineur non accompagne | CRITIQUE | Mineur enregistre sans tuteur |
| Tuteur suspect | HAUTE | Tuteur age de moins de 21 ans |
| Arrivee de nuit | MOYENNE | Check-in entre 22h et 6h |
| Document invalide | MOYENNE | Probleme avec le document d'identite |
| Mineur avec tuteur | BASSE | Suivi de routine |

### Centre d'alertes

1. Accedez a **"Alertes"** dans le menu lateral
2. Les alertes sont classees par severite
3. Utilisez les filtres:
   - Par severite (Critique, Haute, Moyenne, Basse)
   - Par statut (Nouvelle, En cours, Resolue)
   - Par region/juridiction
   - Par periode

### Traiter une alerte

1. Cliquez sur l'alerte pour voir les details
2. Informations disponibles:
   - **Voyageur**: Nom, age, nationalite, document
   - **Propriete**: Nom, adresse, licence, proprietaire
   - **Tuteur** (si applicable): Nom, relation, document
   - **Circonstances**: Heure d'arrivee, notes
3. Actions possibles:

| Action | Description |
|--------|-------------|
| Prendre en charge | Assigner l'alerte a vous-meme |
| Transferer | Envoyer a un autre agent/service |
| Contacter | Appeler le proprietaire ou le voyageur |
| Resoudre | Marquer comme resolue avec notes |
| Classer | Classer sans suite avec justification |

### Workflow de traitement

```
┌──────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────┐
│ Nouvelle │────►│ En cours     │────►│ Investigue │────►│ Resolue  │
│          │     │ (assignee)   │     │            │     │          │
└──────────┘     └──────────────┘     └────────────┘     └──────────┘
                                             │
                                             ▼
                                      ┌────────────┐
                                      │ Classee    │
                                      │ sans suite │
                                      └────────────┘
```

### Notifications

Les alertes critiques declenchent:
- Notification push sur l'application mobile
- SMS au poste de police de la juridiction
- Email au responsable de permanence

---

## Recherche de voyageurs

### Recherche simple

1. Allez dans **"Voyageurs"**
2. Entrez un terme de recherche:
   - Nom/Prenom
   - Numero de passeport/CNI
   - Nationalite
   - Numero de telephone
3. Les resultats s'affichent en temps reel

### Recherche avancee

Utilisez les filtres pour affiner:
- **Periode**: Date d'arrivee/depart
- **Etablissement**: Propriete specifique
- **Nationalite**: Pays d'origine
- **Age**: Tranche d'age
- **Statut**: En sejour / Parti

### Fiche voyageur

La fiche d'un voyageur affiche:

**Informations personnelles**
- Nom complet
- Date de naissance / Age
- Nationalite
- Document d'identite (type, numero, photo)

**Historique des sejours**
- Liste des sejours (dates, etablissements)
- Nombre total de nuits au Senegal

**Alertes associees**
- Alertes liees a ce voyageur

**Accompagnateurs** (si mineur)
- Historique des tuteurs declares

---

## Gestion des proprietes

### Liste des proprietes

1. Accedez a **"Proprietes"** dans le menu
2. Filtrez par:
   - Statut (En attente, Active, Suspendue)
   - Type (Hotel, Meuble, etc.)
   - Region/Ville
   - Score de conformite

### Fiche propriete

Chaque propriete affiche:

| Section | Contenu |
|---------|---------|
| Informations | Nom, type, adresse, GPS |
| Proprietaire | Nom, telephone, CNI |
| Licence | Numero, date d'emission |
| Photos | Images de l'etablissement |
| Documents | CNI proprietaire, registre commerce |
| Statistiques | Clients heberges, TPT collectee |
| Alertes | Historique des alertes |

### Valider une propriete

Pour les proprietes "En attente":

1. Verifiez les informations fournies
2. Controlez les documents (CNI, photos)
3. Comparez avec les sources externes si necessaire
4. Decidez:
   - **Approuver**: Genere le numero de licence TRG-XXXX-XXXXX
   - **Demander complements**: Envoi d'un message au proprietaire
   - **Rejeter**: Avec motif de refus

### Suspendre une propriete

En cas de non-conformite:

1. Cliquez sur **"Suspendre"**
2. Selectionnez le motif:
   - Non-paiement TPT
   - Infraction signalee
   - Fermeture definitive
   - Autre
3. Entrez les details
4. Confirmez

Le proprietaire sera notifie et la propriete n'apparaitra plus comme active.

---

## Statistiques et rapports

### Tableau de bord analytique

Accedez a **"Statistiques"** pour visualiser:

**Vue d'ensemble**
- Evolution du nombre de proprietes
- Tendance des arrivees
- Taux de recouvrement TPT

**Cartes interactives**
- Repartition geographique des proprietes
- Zones de concentration touristique
- Points chauds d'alertes

**Graphiques**
- Arrivees par jour/semaine/mois
- Nationalites les plus representees
- Repartition par type d'hebergement

### Rapports predefiniss

| Rapport | Contenu | Frequence |
|---------|---------|-----------|
| Arrivees quotidiennes | Liste des check-ins du jour | Quotidien |
| Synthese hebdomadaire | Resume de la semaine | Hebdomadaire |
| Bilan mensuel TPT | Recettes et recouvrement | Mensuel |
| Rapport annuel | Statistiques completes | Annuel |

### Generer un rapport

1. Allez dans **"Rapports"**
2. Selectionnez le type de rapport
3. Definissez la periode
4. Choisissez les filtres (region, type, etc.)
5. Cliquez sur **"Generer"**
6. Exportez en PDF, Excel ou CSV

---

## Intelligence marche

### Objectif

Le module d'intelligence permet d'identifier les hebergements non declares en analysant les plateformes de reservation en ligne.

### Sources de donnees

- Airbnb
- Booking.com
- Expat-Dakar
- Facebook Marketplace

### Annonces detectees

1. Accedez a **"Intelligence"** > **"Annonces"**
2. Visualisez les annonces scrapees:
   - Photo principale
   - Titre et description
   - Prix par nuit
   - Localisation estimee
   - Plateforme source

### Correspondances

Le systeme tente de faire correspondre les annonces avec les proprietes enregistrees:

| Statut | Description |
|--------|-------------|
| Correspondance | Annonce liee a une propriete Gestoo |
| Suspecte | Annonce sans correspondance (potentiellement non declaree) |
| A verifier | Correspondance incertaine necessitant verification |

### Actions sur une annonce

1. **Confirmer correspondance**: Lier l'annonce a une propriete existante
2. **Marquer non declaree**: Signaler pour investigation
3. **Ignorer**: Faux positif ou hors perimetre

### Tableau des annonces non declarees

Ce tableau liste les hebergements potentiellement non declares pour:
- Envoi de courrier de mise en conformite
- Transmission aux services de controle
- Suivi des regularisations

---

## Gestion des utilisateurs (Admin)

### Creer un utilisateur

1. Allez dans **"Administration"** > **"Utilisateurs"**
2. Cliquez sur **"Nouvel utilisateur"**
3. Remplissez:
   - Nom complet
   - Email professionnel
   - Role (Police, Ministere, Admin)
   - Juridiction (pour Police)
4. L'utilisateur recevra un email d'activation

### Modifier les droits

1. Selectionnez l'utilisateur
2. Modifiez le role ou la juridiction
3. Sauvegardez

### Desactiver un compte

1. Selectionnez l'utilisateur
2. Cliquez sur **"Desactiver"**
3. Confirmez

Le compte sera immediatement inaccessible.

---

## Bonnes pratiques

### Traitement des alertes

- Traitez les alertes critiques dans l'heure
- Documentez toutes vos actions
- Escaladez si necessaire

### Protection des donnees

- N'exportez les donnees que pour un besoin justifie
- Ne partagez pas les informations sensibles
- Respectez la confidentialite des voyageurs

### Qualite des donnees

- Verifiez les informations avant validation
- Signalez les anomalies
- Contribuez a l'amelioration du systeme

---

## Support technique

### Contact

- **Hotline technique**: +221 33 XXX XX XX (24h/24 pour urgences)
- **Email**: support-admin@gestoo.sn

### Signaler un bug

1. Allez dans **"Aide"** > **"Signaler un probleme"**
2. Decrivez le probleme
3. Joignez une capture d'ecran si possible
4. Soumettez

### Formation

Des sessions de formation sont organisees regulierement:
- Formation initiale pour nouveaux utilisateurs
- Mise a jour sur les nouvelles fonctionnalites
- Ateliers pratiques

Contactez votre responsable pour participer.
