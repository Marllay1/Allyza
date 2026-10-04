# -*- coding: utf-8 -*-
from blocks import *

SCEN = [
    ("S-1 — Réseau stable", [
        ("Environnement", "Deux appareils réels (iOS et Android) sur le même Wi-Fi, puis sur deux réseaux différents (Wi-Fi / 4G) ; version de l’application figée."),
        ("Hypothèse", "Sur réseau stable, l’appel s’établit dans un délai court (valeur cible à fixer a priori, par exemple < 3 s) et le taux de réussite est élevé ; sur réseaux différents, il dépend de la présence du relais TURN (H3)."),
        ("Procédure", "30 appels audio et 30 vidéo par configuration réseau, alternance des rôles ; relevé de M1, M2, M3, M9."),
        ("Métriques", "M1 temps d’établissement ; M2 délai de sonnerie chez l’appelé ; M3 taux de réussite ; M9 type de candidat (host/srflx/relay)."),
        ("Observations / résultats", "Non mesurés à ce jour."),
        ("Interprétation", "Sans objet tant qu’aucune mesure n’est disponible."),
        ("Limites", "Deux appareils seulement ; échantillon de petite taille ; opérateurs et NAT non contrôlés."),
    ]),
    ("S-2 — Latence élevée", [
        ("Environnement", "Appel sur un même réseau, dégradation introduite au niveau du système (netem sous Linux, Clumsy sous Windows, Network Link Conditioner d’Apple). *La limitation réseau des outils de développement du navigateur ne s’applique pas au trafic WebRTC en UDP.*"),
        ("Hypothèse", "L’augmentation du délai aller-retour dégrade la qualité perçue au-delà d’environ 150 ms unidirectionnel [24] et allonge l’établissement proportionnellement au nombre d’échanges de signalisation."),
        ("Procédure", "Paliers de délai ajouté : 0, 50, 100, 200, 400 ms ; 10 appels par palier ; relevé de M1, M4, M5."),
        ("Métriques", "M1, M4 (RTT du chemin sélectionné), M5 (gigue, pertes)."),
        ("Observations / résultats", "Non mesurés à ce jour."),
        ("Interprétation", "Sans objet."),
        ("Limites", "Le délai de signalisation (WebSocket) et le délai média sont affectés ensemble si la dégradation est globale ; pour les séparer, appliquer le filtre aux seuls ports média."),
    ]),
    ("S-3 — Perte de paquets", [
        ("Environnement", "Idem S-2, avec perte aléatoire."),
        ("Hypothèse", "Une perte de 1 à 5 % reste tolérable pour la voix (dissimulation de perte) mais dégrade rapidement la vidéo."),
        ("Procédure", "Paliers 0, 1, 2, 5, 10 % ; 10 appels par palier ; échantillonnage de getStats() chaque seconde."),
        ("Métriques", "M5 (paquets perdus, gigue), débit reçu, évaluation subjective de la qualité par échelle d’opinion à 5 niveaux."),
        ("Observations / résultats", "Non mesurés à ce jour."),
        ("Interprétation", "Sans objet."),
        ("Limites", "Évaluation subjective à encadrer (ordre aléatoire, aveugle au palier) ; tests sur une seule paire d’appareils."),
    ]),
    ("S-4 — Bande passante limitée", [
        ("Environnement", "Limitation de débit à 2 Mbit/s, 500, 250, 100 kbit/s."),
        ("Hypothèse", "L’adaptation de débit des navigateurs maintient l’audio mais réduit la résolution ou la fluidité vidéo ; le chargement des photos et des vocaux s’allonge proportionnellement à leur taille."),
        ("Procédure", "Appels vidéo de 2 minutes par palier ; envoi d’une photo de 3 Mo et d’un vocal de 30 s."),
        ("Métriques", "Débit émis et reçu, résolution reçue, M7 temps de chargement/envoi des médias."),
        ("Observations / résultats", "Non mesurés à ce jour."),
        ("Interprétation", "Sans objet."),
        ("Limites", "Les algorithmes d’adaptation dépendent de la version du navigateur."),
    ]),
    ("S-5 — Coupure temporaire", [
        ("Environnement", "Coupure du réseau d’un appareil pendant 5, 15, 25 s (mode avion ou coupure du Wi-Fi), pendant un appel connecté et pendant une conversation ouverte."),
        ("Hypothèse", "Pour une coupure < 20 s, l’appel reprend ; au-delà, il se termine en « failed ». La conversation rattrape les messages manquants au retour en ligne."),
        ("Procédure", "10 essais par durée ; relevé du temps de reprise (M8), du statut final de l’appel et du nombre de messages rattrapés."),
        ("Métriques", "M8 temps de reprise ; taux de reprise ; messages manquants après rattrapage."),
        ("Observations / résultats", "Non mesurés à ce jour."),
        ("Interprétation", "Sans objet."),
        ("Limites", "Le comportement iOS en arrière-plan ou écran verrouillé peut dominer le résultat (hors contrôle de l’application)."),
    ]),
    ("S-6 — Changement de réseau", [
        ("Environnement", "Appel connecté sur Wi-Fi, bascule vers la 4G (désactivation du Wi-Fi), et inversement."),
        ("Hypothèse", "Le redémarrage d’ICE par l’appelant rétablit le média dans la limite de 3 tentatives et de 20 s ; la reprise est plus lente si l’appelé change de réseau."),
        ("Procédure", "10 essais par sens et par rôle (appelant / appelé change de réseau)."),
        ("Métriques", "M8, M9 (nouveau chemin), taux de réussite."),
        ("Observations / résultats", "Non mesurés à ce jour."),
        ("Interprétation", "Sans objet."),
        ("Limites", "Dépend de la configuration TURN en production et du fournisseur d’accès."),
    ]),
    ("S-7 — Charge croissante", [
        ("Environnement", "**Non réalisable de façon pertinente** : la plateforme sert deux utilisateurs et n’a pas de mode de simulation de charge ; les limites des offres gratuites des fournisseurs ne doivent pas être sollicitées."),
        ("Hypothèse", "—"),
        ("Procédure", "Perspective : tests de charge de l’API de messagerie (débit de messages par seconde) sur un environnement dédié, avec comptes de test."),
        ("Métriques", "Débit, latence p95 des actions, taux d’erreur."),
        ("Observations / résultats", "Non applicable."),
        ("Interprétation", "—"),
        ("Limites", "Les conclusions sur la scalabilité ne peuvent pas être tirées du prototype actuel."),
    ]),
    ("S-8 — Tests de sécurité", [
        ("Environnement", "Base PostgreSQL en mémoire (PGlite) rejouant les 10 migrations avec des simulations d’authentification ; poste de développement ; Node.js v26.1.0."),
        ("Hypothèse", "Les politiques RLS, déclencheurs et contraintes empêchent l’accès croisé, l’usurpation d’auteur, la falsification des champs immuables et la lecture des secrets ; les primitives cryptographiques détectent altération et déplacement de chiffrés."),
        ("Procédure", "Exécution de npm run test:db et npm run test:e2ee ; exécution du banc scripts/e2ee-bench.mjs."),
        ("Métriques", "Nombre de contrôles réussis ; temps de calcul (médiane, p95) ; surcoût de taille."),
        ("Observations / résultats", "**Mesurés** : 96 contrôles de base réussis (0 échec) ; 22 contrôles cryptographiques réussis ; mesures de calcul en 5.7."),
        ("Interprétation", "Les garanties d’isolation et d’intégrité testées sont vérifiées dans un environnement simulé ; voir limites."),
        ("Limites", "Environnement simulé et non la plateforme Supabase réelle ; pas de test d’intrusion externe ; pas de test du transport (TLS), de la signalisation sous attaque active ni des politiques du Storage dans leur service réel."),
    ]),
]

CH5 = [
    H1("CHAPITRE 5 — EXPÉRIMENTATION ET ÉVALUATION"),
    P("Ce chapitre distingue sans ambiguïté ce qui a été **mesuré** de ce qui est **protocolé**. Conformément à la règle de non-invention, aucun résultat de latence, de perte, de reprise ou de qualité n’est donné : "
      "ces grandeurs ne sont pas collectées par l’application actuelle et aucune campagne n’a été menée. Les seuls résultats expérimentaux sont ceux des tests automatisés et du banc de calcul (section 5.7)."),
    H2("5.1. Méthodologie expérimentale"),
    P("La méthode suit le paradigme But–Question–Métrique [40] : chaque scénario part d’un but (vérifier une propriété), formule une hypothèse mesurable et définit les métriques et la procédure. "
      "Les critères d’acceptation sont fixés **avant** la mesure. Pour chaque condition, on recommande au moins 30 répétitions, on rapporte la médiane, le 95e percentile et l’écart interquartile, et on traite séparément les échecs (taux de réussite) des durées (calculées sur les réussites). "
      "Les mesures de durée à l’intérieur d’un même appareil utilisent l’horloge monotone du navigateur (performance.now()) afin de ne pas dépendre de la synchronisation des horloges."),
    H2("5.2. Environnement de test"),
    T("Environnements : réalisé et prévu", ["Environnement", "Statut", "Usage"], [
        ["Poste de développement Windows 11, Node.js v26.1.0 (win32/x64)", "Utilisé", "Tests SQL (PGlite), tests et banc cryptographiques, compilation et lint"],
        ["Navigateur du poste en émulation de gabarit mobile (375 × 812)", "Utilisé", "Vérification visuelle de composants avec données factices"],
        ["Deux téléphones réels (iOS Safari PWA, Android Chrome)", "Non utilisé pour des mesures", "Protocole S-1 à S-6"],
        ["Émulation réseau au niveau du système", "Non utilisé", "Protocole S-2 à S-6"],
        ["Plateforme de production (Vercel, Supabase, Cloudflare)", "Non audité", "Configuration à vérifier"],
    ], [7.2, 3.0, 5.8]),
    H2("5.3. Métriques et instrumentation proposées"),
    T("Métriques", ["Réf.", "Métrique", "Définition et source"], [
        ["M1", "Temps d’établissement", "De l’appui sur « Appeler » à connectionState = connected (horloge locale de l’appelant)"],
        ["M2", "Délai de sonnerie", "De l’appui sur « Appeler » à la réception de « ringing » (appelant)"],
        ["M3", "Taux de réussite d’établissement", "Appels connectés / appels initiés"],
        ["M4", "Délai aller-retour", "currentRoundTripTime de la paire de candidats sélectionnée (getStats())"],
        ["M5", "Gigue et pertes", "jitter et packetsLost des flux entrants (getStats())"],
        ["M6", "Débit", "bytesReceived/bytesSent échantillonnés par seconde"],
        ["M7", "Temps de chargement / d’envoi d’un média", "Du déclenchement à l’affichage / à la confirmation de l’action"],
        ["M8", "Temps de reprise", "De la perte de connectivité (disconnected) au retour à connected"],
        ["M9", "Type de chemin", "Type de candidat de la paire sélectionnée : host, srflx ou relay"],
        ["M10", "Délai de livraison d’un message", "De l’envoi à l’affichage chez le destinataire (nécessite deux horloges synchronisées ou un écho mesuré)"],
        ["M11", "Coût de chiffrement", "Temps de calcul des primitives (mesuré, 5.7)"],
    ], [1.3, 5.2, 9.5]),
    P("**Proposition d’instrumentation (non implémentée).** Émettre des événements horodatés (call_start, offer_sent, offer_received, answer_sent, ice_connected, media_flowing, call_end, reconnect_start, reconnect_end ; "
      "voice_record_start/end, upload_start/end) vers un journal d’essai local ou une table dédiée sans contenu ; échantillonner getStats() chaque seconde pendant l’appel ; "
      "stocker M9 pour distinguer chemin direct et chemin relayé. Cette instrumentation doit préserver la confidentialité (aucun contenu, identifiants pseudonymisés) et être désactivée par défaut."),
    H2("5.4. Scénarios de test"),
    P("Les huit scénarios sont présentés selon les rubriques imposées. Pour les scénarios S-1 à S-7, la rubrique « résultats » est « non mesurés à ce jour »."),
]
SCEN_TABLES = []

CH5B = [
    H2("5.5. Évaluation de la sécurité"),
    P("**Mesuré (S-8).** La suite de tests de base rejoue les migrations et vérifie notamment : l’absence de lecture croisée entre couples (un tiers ne voit aucun message, aucun appel, aucune clé), l’impossibilité d’usurper l’auteur d’un message ou l’appelant d’un appel, "
      "l’immuabilité des champs fixes (auteur, type, chemin de fichier, durée, marqueur de chiffrement), l’inaccessibilité des tables du verrou d’application (même pour leur propriétaire), la confidentialité de la clé privée enveloppée vis-à-vis du partenaire, "
      "le refus des messages en clair lorsque les deux membres ont une clé et le rejet d’un nombre d’itérations de dérivation trop faible. 96 contrôles sont réussis, aucun n’échoue. "
      "La suite cryptographique vérifie qu’un tiers ne déchiffre pas, qu’un chiffré déplacé vers un autre auteur ou type est rejeté, qu’une altération est détectée, que la sauvegarde de clé exige le bon mot de passe, "
      "que le code de sécurité est identique des deux côtés et que le MAC de signalisation détecte une empreinte substituée, un changement de rôle, d’appel ou de signataire. 22 contrôles sont réussis."),
    P("**Non mesuré / non testé.** TLS et configuration des hébergeurs ; comportement du service Storage réel ; interposition active dans la signalisation en conditions réelles ; "
      "contournement du limiteur de débit en environnement multi-instances ; révocation de session ; fuite de métadonnées dans les journaux de la plateforme ; test d’intrusion."),
    H2("5.6. Évaluation de la résilience"),
    P("La résilience est ici évaluée **uniquement par revue du mécanisme** (3.9 et 3.11). L’efficacité de la reprise (S-5, S-6) n’est pas démontrée. Les temps de 20 s, 45 s, 60 s et le nombre de 3 redémarrages d’ICE sont des paramètres de conception dont la pertinence doit être éprouvée par les scénarios."),
    H2("5.7. Résultats obtenus"),
    P("Les mesures de calcul ci-dessous ont été obtenues avec le script scripts/e2ee-bench.mjs (WebCrypto de Node.js v26.1.0, Windows x64) : 300 répétitions pour les textes, 30 pour les fichiers, 100 pour la dérivation ECDH+HKDF, 30 pour la génération de clé, 8 pour la déprotection de la clé (PBKDF2), après échauffement. "
      "Ce sont des **coûts de calcul sur un poste de bureau**, pas des temps de bout en bout, et pas des mesures sur téléphone."),
    T("Coût de calcul de l’E2EE (ms, médiane / 95e percentile)", ["Opération", "Médiane", "p95", "Remarque"], [
        ["Génération de la paire de clés ECDH P-256", "6,58", "30,0", "Une fois par activation"],
        ["Dérivation ECDH + HKDF (clés partagées)", "2,83", "77,0", "Une fois par session"],
        ["Chiffrement d’un texte de 20 caractères", "0,23", "1,40", "AES-GCM"],
        ["Chiffrement d’un texte de 200 caractères", "0,26", "1,38", ""],
        ["Chiffrement d’un texte de 1 000 caractères", "0,50", "4,44", ""],
        ["Chiffrement d’un texte de 4 000 caractères", "1,13", "6,21", ""],
        ["Déchiffrement d’un texte de 4 000 caractères", "0,34", "1,79", ""],
        ["Chiffrement d’un fichier de 50 ko", "0,61", "9,26", "AES-GCM, clé par fichier"],
        ["Chiffrement d’un fichier de 300 ko", "2,08", "7,05", ""],
        ["Chiffrement d’un fichier de 3 Mo", "19,1", "38,6", ""],
        ["Déchiffrement d’un fichier de 3 Mo", "18,5", "34,3", ""],
        ["Signature / vérification du MAC d’un SDP", "0,17 / 0,17", "0,89 / 0,68", "Par offre et par réponse"],
        ["Calcul du code de sécurité", "0,11", "0,57", ""],
        ["Déverrouillage de la clé (PBKDF2, 600 000 itérations)", "1 947", "2 166", "Coût volontaire, à l’activation/restauration"],
    ], [7.4, 2.4, 2.4, 3.8], 8.5),
    F("fig/bench-calcul.png", "Coût de calcul du chiffrement (mesures réelles, médiane et p95)", 15.0),
    T("Surcoût de taille du chiffrement", ["Objet", "Taille claire", "Taille chiffrée", "Surcoût"], [
        ["Texte", "20 car.", "66 car.", "× 3,3"],
        ["Texte", "200 car.", "306 car.", "× 1,53"],
        ["Texte", "1 000 car.", "1 374 car.", "× 1,37"],
        ["Texte", "4 000 car.", "5 374 car.", "× 1,34"],
        ["Fichier", "toute taille", "+ 28 octets", "12 (IV) + 16 (étiquette)"],
    ], [3.0, 4.0, 4.5, 4.5]),
    F("fig/bench-taille.png", "Surcoût de taille d’un texte chiffré (base64, IV et étiquette inclus)", 10.5),
    T("Autres vérifications automatiques", ["Vérification", "Résultat"], [
        ["Tests d’isolation SQL (npm run test:db)", "96 contrôles réussis, 0 échec"],
        ["Tests cryptographiques (npm run test:e2ee)", "22 contrôles réussis"],
        ["Compilation de production (next build)", "Réussie"],
        ["Analyse statique (ESLint)", "0 erreur, 2 avertissements (attribut alt d’un composant de logo)"],
    ], [8.0, 8.0]),
    H2("5.8. Analyse des résultats"),
    B([
        "**Analyse 1.** Sur le poste de test, le calcul de chiffrement d’un message courant est inférieur à 1,2 ms (médiane) et celui d’une photo de 300 ko de l’ordre de 2 ms. Rapporté à un budget de 150 ms de délai unidirectionnel [24], ce coût est faible. "
        "**Réserve :** l’hypothèse H2 n’est que partiellement testée, car le coût sur un téléphone d’entrée de gamme, l’occupation mémoire et l’effet sur la latence de bout en bout ne sont pas mesurés.",
        "**Analyse 2.** Le coût dominant du chiffrement est d’**usage**, non de calcul : la gestion d’un mot de passe de chiffrement, le déverrouillage d’environ 2 s sur le poste de test (volontairement coûteux), la perte d’accès en cas d’oubli. Le compromis se déplace de la performance vers l’ergonomie et la disponibilité des données.",
        "**Analyse 3.** Le surcoût de taille des textes est amorti au-delà de quelques centaines de caractères (× 1,34 limite due au codage base64) ; il est négligeable pour les fichiers (28 octets).",
        "**Analyse 4.** Les 96 contrôles montrent que les garanties d’isolation sont exprimées dans la base et non dans l’interface. Ils ne démontrent pas l’absence de vulnérabilité : le périmètre est celui des cas testés.",
        "**Constat d’absence de preuve.** Les propriétés de latence d’établissement, de gigue, de perte, de reprise et de taux de réussite, centrales dans la problématique, ne peuvent pas être évaluées sans l’instrumentation et la campagne décrites en 5.3 et 5.4.",
    ]),
]

CH6 = [
    H1("CHAPITRE 6 — DISCUSSION, LIMITES ET PERSPECTIVES"),
    H2("6.1. Discussion des résultats"),
    P("Les résultats obtenus valident la **faisabilité** d’une architecture qui combine contrôle d’accès au niveau de la base, signalisation sans serveur dédié, média pair-à-pair avec relais éphémère et chiffrement de bout en bout optionnel à faible coût de calcul. "
      "Ils ne valident pas les propriétés de performance et de disponibilité en conditions réelles. La contribution principale de l’étude est donc double : une description vérifiable de l’architecture, et un cadre expérimental précis pour la compléter."),
    H2("6.2. Adéquation entre les objectifs et les résultats"),
    T("Objectifs et degré d’atteinte", ["Objectif", "Degré d’atteinte", "Justification"], [
        ["Reconstituer l’architecture réelle", "Atteint", "Chapitres 2–4, matrice en annexe A"],
        ["Analyser la signalisation et la reconnexion", "Atteint (analyse), non mesuré", "3.4, 3.5, 3.9"],
        ["Étudier médias et persistance", "Atteint", "3.6, 3.7, 4.4, 4.5"],
        ["Analyser le modèle de sécurité et ses limites", "Atteint", "3.10, 4.12, 5.5"],
        ["Documenter les problèmes rencontrés", "Atteint, plusieurs sans validation", "4.14"],
        ["Évaluer expérimentalement performance et résilience", "Partiel", "Calcul et sécurité mesurés ; réseau protocolé seulement"],
    ], [5.8, 3.8, 6.4]),
    H2("6.3. Compromis entre sécurité, performance et disponibilité"),
    F("fig/triangle.png", "Triangle des compromis sécurité – performance – disponibilité", 9.5),
    T("Analyse des compromis", ["Mécanisme", "Gain de sécurité", "Coût en performance", "Coût en disponibilité / usage", "Preuve"], [
        ["E2EE applicatif", "Contenu illisible par l’opérateur", "Calcul faible (mesuré) ; taille × 1,34", "Mot de passe à gérer ; perte possible des données ; restauration sur autre appareil", "Mesure de calcul ; reste non mesuré"],
        ["MAC des empreintes DTLS", "Résiste à une interposition dans la signalisation", "< 1 ms par offre/réponse (mesuré)", "Refus d’appel si clé verrouillée ou changée", "Mesure + tests unitaires"],
        ["Relais TURN", "Neutre (le média reste chiffré)", "Saut réseau supplémentaire (non mesuré)", "Améliore la connectivité entre réseaux différents (hypothèse)", "Aucune mesure"],
        ["RLS + validation serveur", "Isolation par couple", "Évaluation des politiques à chaque requête (non mesuré)", "Complexité des migrations", "96 contrôles"],
        ["Notifications sans contenu", "Pas de fuite via le service push", "Neutre", "Notification moins informative", "Revue du code"],
        ["Verrou d’application", "Protège un appareil déverrouillé prêté", "Neutre", "Étape supplémentaire à chaque ouverture", "Revue du code"],
        ["Reprise automatique d’appel", "—", "Redémarrage d’ICE : charge de signalisation", "Plus d’états à gérer", "Aucune mesure"],
    ], [2.6, 3.0, 3.4, 4.2, 2.8], 8),
    P("**Analyse.** Aucune solution n’est « meilleure » dans l’absolu : activer l’E2EE protège contre un opérateur curieux mais aggrave le risque de perte de données ; maintenir la reconnexion améliore la continuité mais complexifie l’état ; "
      "minimiser les métadonnées réduit les possibilités de diagnostic, donc l’observabilité. Le triangle est un espace d’arbitrage : l’architecture cible doit expliciter ses choix, ses hypothèses de menace et ses indicateurs."),
    H2("6.4. Apports du prototype"),
    B([
        "Un cas concret de séparation entre état de communication et affichage (hypothèse H1), documenté et implémenté.",
        "Une signalisation double (diffusion + base) répondant au caractère non fiable de la diffusion.",
        "Une couche E2EE optionnelle de bout en bout (messages, fichiers, signalisation) avec refus de rétrogradation côté base et vérification par code de sécurité.",
        "Un recueil de problèmes réels et de corrections, avec statut de preuve.",
        "Un protocole expérimental prêt à l’emploi.",
    ]),
    H2("6.5. Limites actuelles"),
    H3("6.5.1. Limites liées à l’environnement PWA"),
    B([
        "**CallKit/PushKit absents.** Une PWA ne peut pas présenter l’interface d’appel native du système ni être réveillée par un push VoIP ; l’appel entrant application fermée se réduit à une notification.",
        "**Arrière-plan.** Le système d’exploitation peut suspendre la page, interrompre la capture du micro ou verrouiller l’audio ; l’application peut réduire ce risque (Wake Lock, reprise du micro) mais pas l’empêcher.",
        "**Audio web.** Verrouillé avant un premier geste ; sensible au commutateur silencieux sur iOS ; setSinkId indisponible sur Safari iOS.",
        "**Notifications.** Dépendent de l’installation de la PWA, de la permission et des politiques de la plateforme ; supprimer une notification peut, selon la plateforme, être sanctionné par le retrait de l’autorisation (risque signalé, non quantifié).",
    ]),
    H3("6.5.2. Limites liées aux communications temps réel"),
    B([
        "Sans relais TURN configuré, deux téléphones sur des réseaux différents peuvent ne pas se joindre.",
        "Pas d’adaptation volontaire du débit ni des codecs par l’application : elle s’en remet au navigateur.",
        "Appels uniquement un-à-un, en pair-à-pair ; pas d’appel de groupe.",
        "Aucune métrique de qualité collectée.",
    ]),
    H3("6.5.3. Limites méthodologiques"),
    B(["Peu d’appareils, pas de campagne ; résultats de calcul sur un poste de bureau ; configuration de production non vérifiable depuis le dépôt ; bibliographie à revérifier."]),
    H2("6.6. Perspectives d’amélioration"),
    P("**Les éléments suivants sont des propositions, non confirmées comme implémentées.**"),
    B([
        "**Observabilité** : instrumentation décrite en 5.3, export des événements d’appel et des statistiques WebRTC, tableau de bord de taux de réussite et de temps d’établissement [33][38].",
        "**E2EE renforcé** : protocole à cliquet (type Double Ratchet) apportant le secret de transmission aval et la récupération après compromission [30][29] ; rotation des clés ; vérification des clés par un tiers de confiance ; audit externe.",
        "**Résilience** : relais TURN redondants multi-régions ; reprise de téléversement ; file d’envoi hors ligne ; mesure et réglage des délais (20 s, 45 s, 60 s) d’après les scénarios S-5 et S-6.",
        "**Cloud et scalabilité** : limitation de débit distribuée ; séparation en services ; SFU pour des appels de groupe ; tests de charge sur environnement dédié.",
        "**Migration native éventuelle** : application iOS native avec **CallKit** (interface d’appel système) et **PushKit** (push VoIP) et notifications natives ; cette perspective n’est pas partie de l’implémentation actuelle.",
        "**Fichiers génériques** : transfert chiffré de documents, avec limites de taille et analyse antivirale.",
        "**Métadonnées** : réduire l’information journalisée, étudier l’acheminement par relais pour masquer les adresses IP.",
    ]),
    H2("6.7. Perspectives de déploiement à plus grande échelle"),
    P("Le passage à plus de deux utilisateurs impose de revoir les curseurs de lecture (un par membre), l’indicateur de saisie, la signalisation d’appel (appels de groupe via SFU), la gestion des clés (chiffrement de groupe) et la limitation de débit. "
      "Ces évolutions modifient la nature du problème ; elles ne sont pas déductibles des résultats du prototype."),
]

CONCLUSION = [
    H1("CONCLUSION GÉNÉRALE"),
    P("**Rappel du problème.** Ce mémoire cherchait à savoir comment concevoir une architecture garantissant simultanément confidentialité, intégrité, disponibilité et faible latence dans une plateforme de communication multimédia temps réel fonctionnant sur des réseaux hétérogènes."),
    P("**Démarche.** À partir d’un audit du dépôt du prototype Allyza, l’architecture réelle du module de messagerie a été reconstituée, classée par niveau de preuve, confrontée à l’état de l’art et complétée par des mesures de calcul et des tests automatisés. "
      "Les problèmes réellement rencontrés ont été consignés avec leur statut de validation."),
    P("**Réponse, dans les limites des preuves.** (i) *Confidentialité* : vis-à-vis des tiers, elle repose sur l’authentification, les politiques RLS, le stockage privé et le transport chiffré ; vis-à-vis de l’opérateur, elle n’est obtenue que lorsque le chiffrement de bout en bout optionnel est activé par les deux personnes, "
      "mécanisme implémenté et testé unitairement mais non validé de bout en bout (classe B). (ii) *Intégrité* : assurée en base par des contraintes et déclencheurs vérifiés (96 contrôles) et, pour le contenu chiffré et la signalisation, par un chiffrement authentifié et un MAC vérifiés par 22 contrôles. "
      "(iii) *Disponibilité* : des mécanismes de reprise existent (double signalisation, rattrapage, redémarrage d’ICE, reprise du micro), mais leur efficacité n’est pas mesurée. "
      "(iv) *Faible latence* : le coût de calcul du chiffrement est faible sur le poste de test (inférieur à 1,2 ms pour un message de 4 000 caractères), mais la latence d’établissement et de transmission n’est pas mesurée. "
      "(v) *Réseaux hétérogènes* : la nécessité d’un relais TURN est établie par la littérature ; sa présence et son efficacité en production ne sont pas vérifiées."),
    P("**Conclusion.** L’étude ne démontre donc pas que l’architecture garantit simultanément les quatre propriétés. Elle démontre qu’une telle architecture peut être construite avec des composants gérés et des primitives standard, "
      "que ses compromis sont explicitables et que les propriétés restant à établir sont mesurables par un protocole précis. L’architecture cible et la migration native (CallKit/PushKit) relèvent exclusivement des perspectives."),
    P("**Ouverture.** La suite logique consiste à instrumenter l’application, à conduire les scénarios S-1 à S-6 sur appareils réels avec dégradations réseau contrôlées, puis à réviser les paramètres de reprise et la configuration du relais d’après ces mesures."),
]

BIB = [
    "[1] Alvestrand, H. — *RFC 8825 : Overview: Real-Time Protocols for Browser-Based Applications*. IETF, 2021.",
    "[2] Uberti, J., Jennings, C., Rescorla, E. (éd.) — *RFC 8829 : JavaScript Session Establishment Protocol (JSEP)*. IETF, 2021.",
    "[3] Keränen, A., Holmberg, C., Rosenberg, J. — *RFC 8445 : Interactive Connectivity Establishment (ICE)*. IETF, 2018.",
    "[4] Petit-Huguenin, M. et al. — *RFC 8489 : Session Traversal Utilities for NAT (STUN)*. IETF, 2020.",
    "[5] Reddy, T. et al. — *RFC 8656 : Traversal Using Relays around NAT (TURN)*. IETF, 2020.",
    "[6] Begen, A., Kyzivat, P., Perkins, C., Handley, M. — *RFC 8866 : SDP: Session Description Protocol*. IETF, 2021.",
    "[7] Rescorla, E. — *RFC 8827 : WebRTC Security Architecture*. IETF, 2021.",
    "[8] Rescorla, E. — *RFC 8826 : Security Considerations for WebRTC*. IETF, 2021.",
    "[9] Rescorla, E., Modadugu, N. — *RFC 6347 : DTLS Version 1.2* (2012) ; McGrew, D., Rescorla, E. — *RFC 5764 : DTLS Extension to Establish Keys for SRTP* (2010). IETF.",
    "[10] Baugher, M. et al. — *RFC 3711 : The Secure Real-time Transport Protocol (SRTP)*. IETF, 2004.",
    "[11] Schulzrinne, H. et al. — *RFC 3550 : RTP: A Transport Protocol for Real-Time Applications*. IETF, 2003.",
    "[12] Rescorla, E. — *RFC 8446 : The Transport Layer Security (TLS) Protocol Version 1.3*. IETF, 2018.",
    "[13] Fette, I., Melnikov, A. — *RFC 6455 : The WebSocket Protocol*. IETF, 2011.",
    "[14] Thomson, M. et al. — *RFC 8030 : Generic Event Delivery Using HTTP Push* (2016) ; *RFC 8291 : Message Encryption for Web Push* (2017) ; *RFC 8292 : VAPID for Web Push* (2017). IETF.",
    "[15] Krawczyk, H., Eronen, P. — *RFC 5869 : HMAC-based Extract-and-Expand Key Derivation Function (HKDF)*. IETF, 2010.",
    "[16] Moriarty, K. et al. — *RFC 8018 : PKCS #5: Password-Based Cryptography Specification v2.1*. IETF, 2017.",
    "[17] Percival, C., Josefsson, S. — *RFC 7914 : The scrypt Password-Based Key Derivation Function*. IETF, 2016.",
    "[18] Dworkin, M. — *NIST SP 800-38D : Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC*. NIST, 2007.",
    "[19] Barker, E. et al. — *NIST SP 800-56A Rev. 3 : Recommendation for Pair-Wise Key-Establishment Schemes Using Discrete Logarithm Cryptography*. NIST, 2018.",
    "[20] W3C — *WebRTC: Real-Time Communication in Browsers* (Recommendation). W3C, 2023.",
    "[21] W3C — *Media Capture and Streams*.",
    "[22] W3C — *Web Cryptography API* (Recommendation). W3C, 2017.",
    "[23] W3C — *Push API* ; *Service Workers* ; *Screen Wake Lock API* ; *Web Authentication* ; *Web Audio API* ; *MediaStream Recording* ; *Audio Output Devices API*.",
    "[24] ITU-T — *Recommandation G.114 : One-way transmission time*. UIT, 2003.",
    "[25] Saltzer, J. H., Schroeder, M. D. — « The protection of information in computer systems ». *Proceedings of the IEEE*, 63(9), 1975.",
    "[26] Brewer, E. — « Towards robust distributed systems ». Keynote, ACM PODC, 2000 ; Gilbert, S., Lynch, N. — « Brewer’s conjecture and the feasibility of consistent, available, partition-tolerant web services ». *ACM SIGACT News*, 33(2), 2002.",
    "[27] Avižienis, A., Laprie, J.-C., Randell, B., Landwehr, C. — « Basic concepts and taxonomy of dependable and secure computing ». *IEEE Transactions on Dependable and Secure Computing*, 1(1), 2004.",
    "[28] Unger, N. et al. — « SoK: Secure Messaging ». *IEEE Symposium on Security and Privacy*, 2015.",
    "[29] Cohn-Gordon, K., Cremers, C., Dowling, B., Garratt, L., Stebila, D. — « A formal security analysis of the Signal messaging protocol ». *IEEE European Symposium on Security and Privacy*, 2017.",
    "[30] Perrin, T., Marlinspike, M. — *The Double Ratchet Algorithm*. Signal, spécification, 2016.",
    "[31] Jennings, C., Hardie, T., Westerlund, M. — « Real-time communications for the web ». *IEEE Communications Magazine*, 51(4), 2013.",
    "[32] Kurose, J., Ross, K. — *Computer Networking: A Top-Down Approach*. Pearson ; Tanenbaum, A., van Steen, M. — *Distributed Systems*. ; Perkins, C. — *RTP: Audio and Video for the Internet*. Addison-Wesley, 2003.",
    "[33] Beyer, B., Jones, C., Petoff, J., Murphy, N. R. (éd.) — *Site Reliability Engineering*. O’Reilly, 2016.",
    "[34] OWASP — *Application Security Verification Standard* (v4.0.3, 2021) ; *Password Storage Cheat Sheet*.",
    "[35] Documentation officielle : Supabase (Auth, Row Level Security, Realtime, Storage) ; Next.js (App Router, Server Actions, after) ; Cloudflare Realtime TURN ; bibliothèque web-push.",
    "[36] Audet, F., Jennings, C. — *RFC 4787 : Network Address Translation (NAT) Behavioral Requirements for Unicast UDP*. IETF, 2007.",
    "[37] Jones, M., Bradley, J., Sakimura, N. — *RFC 7519 : JSON Web Token (JWT)*. IETF, 2015.",
    "[38] Sridharan, C. — *Distributed Systems Observability*. O’Reilly, 2018.",
    "[39] Kleppmann, M. — *Designing Data-Intensive Applications*. O’Reilly, 2017.",
    "[40] Basili, V. R., Caldiera, G., Rombach, H. D. — « The Goal Question Metric Approach ». *Encyclopedia of Software Engineering*, Wiley, 1994.",
]
BIB_NOTE = ("Remarque de vérification : ces références (RFC, recommandations W3C et ITU-T, publications) ont été citées à partir de sources normatives et académiques connues, "
            "sans consultation en ligne durant la rédaction. Les numéros de page, éditions exactes et URL doivent être revérifiés avant dépôt. "
            "Les documentations officielles des produits (Supabase, Next.js, Cloudflare) évoluent : consulter la version en vigueur à la date de dépôt.")

MATRIX = [
    # Élément, classe, preuve, techno, limites
    ["Messages texte (envoi/réception)", "A", "messages.ts ; ChatClient.tsx ; migration 0003", "Server Actions, PostgreSQL, Realtime", "Une seule conversation par couple"],
    ["Réponse à un message / copie", "A", "ChatClient.tsx (reply_to)", "—", "—"],
    ["Édition (texte)", "A", "editMessageAction ; trigger messages_guard", "SQL", "Auteur seulement ; texte seulement"],
    ["Suppression (logique)", "A", "deleteMessageAction ; deleted_at ; suppression du fichier", "SQL, Storage", "Aucune politique DELETE : irréversible côté interface"],
    ["Stickers (20)", "A", "stickers.ts ; migration 0005 ; Sticker.tsx", "SVG", "Jeu fixe défini dans le code"],
    ["Émojis (sélecteur, messages 1–3 émojis en grand)", "A", "EmojiPicker.tsx", "—", "—"],
    ["Réactions (émoji ou sticker)", "A", "use-reactions.ts ; toggleReactionAction ; ReactionBar", "SQL, Realtime", "Sticker codé « s:n » (liste append-only)"],
    ["Appui long / menu contextuel", "A", "MessageMenu.tsx", "Pointer Events", "—"],
    ["État de lecture (curseur, coche double)", "A", "message_cursors ; markMessagesReadAction", "SQL, Realtime", "Pas d’état « livré » distinct"],
    ["État de livraison distinct", "D", "—", "—", "Non implémenté"],
    ["Indicateur « écrit… »", "A", "Canal de diffusion couple:<id>", "Realtime broadcast", "Éphémère"],
    ["Rattrapage après absence", "A", "ChatClient.tsx (visibilitychange, online)", "—", "100 messages au plus"],
    ["Profils / surnoms", "A", "nickname.ts ; getPartner()", "SQL", "Résolveur central"],
    ["Recherche dans la conversation", "A", "ChatClient.tsx ; search-store.ts", "—", "Messages chargés seulement"],
    ["Liens cliquables", "A", "Linkified.tsx", "—", "http(s) seulement"],
    ["Brouillon local", "A", "ChatClient.tsx (localStorage)", "Web Storage", "Non chiffré"],
    ["Photos (envoi, regroupement, visionneuse, enregistrement)", "A", "image.ts ; PhotoViewer.tsx", "Canvas, Storage, URL signées", "Limite 10 Mo ; 6 par envoi"],
    ["Prise de photo directe", "B", "input type=file accept=image/*", "Navigateur", "Dépend du système ; information à vérifier"],
    ["Documents et fichiers génériques", "D", "—", "—", "Bucket limité aux images et audio"],
    ["Messages vocaux (enregistrement, lecture, forme d’onde)", "A", "use-voice-recorder.ts ; AudioPlayer", "MediaRecorder, Web Audio", "Format variable selon navigateur"],
    ["Appels audio WebRTC", "A", "CallProvider.tsx ; calls.ts", "WebRTC, signalisation Realtime", "Fiabilité réseau non mesurée"],
    ["Appels vidéo WebRTC", "A", "CallProvider.tsx ; CallOverlay.tsx", "WebRTC", "Idem"],
    ["Signalisation d’appel", "A", "Canal call:<id> ; table calls", "Realtime broadcast + postgres_changes", "—"],
    ["Relais TURN Cloudflare", "A (code) / à vérifier (production)", "getIceServersAction", "Cloudflare Realtime TURN (REST)", "Variables de production non vérifiables"],
    ["Repli coturn / STUN public", "A (code)", "calls.ts", "coturn, STUN", "Non utilisé si Cloudflare configuré"],
    ["Mute / caméra / inversion caméra", "A", "CallProvider.tsx", "MediaStreamTrack", "Inversion non testée sur appareils"],
    ["Haut-parleur (sortie audio)", "B", "cycleOutput ; setSinkId", "Audio Output Devices API", "Indisponible sur Safari iOS"],
    ["Sonnerie / tonalités", "A (code) / B (confirmation)", "use-ring.ts ; sfx.ts", "Web Audio API", "Verrou audio avant le premier geste ; confirmation utilisateur non documentée"],
    ["Appel entrant application ouverte", "A", "CallProvider.tsx", "Realtime", "—"],
    ["Appel entrant application fermée", "B", "push.ts ; sw.js", "Web Push", "Notification seulement, pas de sonnerie"],
    ["Persistance de l’appel hors écran (palette, retour)", "A", "CallOverlay.tsx (MiniCall) ; CallProvider", "React, état au niveau du layout", "—"],
    ["Persistance en arrière-plan / écran verrouillé", "B", "Wake Lock ; reprise du micro", "Wake Lock API", "Décision du système (iOS)"],
    ["Reconnexion d’appel (ICE restart)", "A (code) / non mesuré", "onconnectionstatechange", "ICE", "Efficacité non démontrée"],
    ["Historique d’appels, rappeler / annuler", "A", "CallHistory.tsx", "SQL", "—"],
    ["Notifications push (messages, appels, manqués)", "A (code) / B (production)", "push.ts ; sw.js ; after()", "Web Push, VAPID", "Clés de production non vérifiables"],
    ["Pastilles « nouveau » persistantes", "A", "AppShell.tsx ; notifications", "SQL, Realtime", "—"],
    ["Authentification", "A", "auth.ts ; proxy.ts", "Supabase Auth, JWT", "Révocation instantanée non démontrée"],
    ["Autorisation (RLS)", "A", "Migrations 0001–0010", "PostgreSQL RLS", "Testée en environnement simulé"],
    ["Verrou d’application (PIN, mot de passe, biométrie)", "A", "app-lock.ts ; applock.ts ; webauthn-verify.ts", "scrypt, WebAuthn", "Hors périmètre de la messagerie, sert d’accès"],
    ["Chiffrement en transit (TLS/WSS)", "A (plateforme)", "Hébergeurs", "TLS", "Configuration non auditée"],
    ["Chiffrement de bout en bout", "B", "crypto.ts ; E2eeProvider ; migration 0010", "WebCrypto ECDH/HKDF/AES-GCM", "Non validé entre comptes ; production non confirmée ; pas de secret aval"],
    ["Authentification de la signalisation d’appel (MAC)", "B", "crypto.ts (signSdp) ; CallProvider", "HMAC-SHA-256", "Actif seulement avec l’E2EE"],
    ["Observabilité / métriques", "D", "—", "—", "Seulement console.error/warn"],
    ["CallKit / PushKit / application native", "D", "—", "—", "Perspective"],
    ["Architecture cible", "D", "—", "—", "Proposition"],
]

ENVVARS = [
    ["NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY", "Client Supabase (public)", "Navigateur + serveur"],
    ["SUPABASE_SERVICE_ROLE_KEY", "Lecture des abonnements push, nettoyage ; jamais exposée", "Serveur uniquement"],
    ["NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT", "Web Push", "Public / serveur"],
    ["CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN", "Génération des identifiants TURN éphémères", "Serveur uniquement"],
    ["TURN_URLS, TURN_SHARED_SECRET", "Alternative coturn", "Serveur uniquement"],
    ["APP_LOCK_SECRET", "Signature du cookie de déverrouillage (repli : dérivé de la clé de service)", "Serveur uniquement"],
    ["NEXT_PUBLIC_SITE_URL", "Liens de redirection", "Public"],
]

EVENTS = [
    ["call_start / call_end", "Début et fin d’appel, motif de fin", "M1, M3"],
    ["offer_sent / offer_received / answer_sent / answer_received", "Jalons de la signalisation", "M1, M2"],
    ["ice_state", "iceConnectionState et connectionState successifs", "M1, M8"],
    ["selected_pair", "Type de candidat (host/srflx/relay), protocole", "M9"],
    ["stats_tick (1 Hz)", "RTT, gigue, pertes, débit", "M4–M6"],
    ["reconnect_start / reconnect_end", "Redémarrages d’ICE", "M8"],
    ["voice_record_start / end ; upload_start / end", "Durée, taille, type MIME, durée d’envoi", "M7"],
    ["media_load", "Durée de chargement d’une image ou d’un vocal", "M7"],
    ["message_sent / message_displayed", "Chronométrage de l’envoi et de l’affichage", "M10"],
]
