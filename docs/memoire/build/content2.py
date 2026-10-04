# -*- coding: utf-8 -*-
from blocks import *

CH3 = [
    H1("CHAPITRE 3 — CONCEPTION DE L’ARCHITECTURE DE COMMUNICATION"),
    P("Ce chapitre expose l’architecture **telle qu’elle est implémentée** (architecture actuelle) puis, dans la section 3.12, une architecture **cible** proposée. "
      "Les diagrammes de séquence représentent le comportement observé dans le code ; les éléments relevant de la proposition sont étiquetés comme tels."),
    H2("3.1. Principes architecturaux"),
    B([
        "**Défense en profondeur** [25] : l’accès aux données est contrôlé à plusieurs niveaux indépendants (authentification, politiques RLS, validation côté serveur, stockage privé), de sorte que l’échec d’une couche ne suffise pas à exposer le contenu.",
        "**Autorité côté base** : les règles d’appartenance au couple sont exprimées en SQL (RLS) et non seulement dans l’interface ; une interface modifiée ne peut pas les contourner.",
        "**Séparation de l’état d’une communication et de son affichage** (hypothèse H1) : l’appel vit dans un composant monté au niveau du layout, l’écran n’en est qu’une vue.",
        "**Affichage optimiste puis réconciliation** : un message est montré immédiatement, puis remplacé par la ligne confirmée ; la reprise après absence se fait par relecture de la base.",
        "**Minimisation du contenu hors du canal protégé** : les notifications ne portent ni texte ni média ; la signalisation ne porte que ce qui est nécessaire à la négociation.",
        "**Dégradation gracieuse** : les fonctions indisponibles (son verrouillé, sélection de sortie audio, relais non configuré) sont signalées ou masquées plutôt que simulées.",
    ]),
    H2("3.2. Architecture générale d’Allyza (actuelle)"),
    P("**Fait observé.** L’architecture est une architecture de type « backend géré » : l’application serveur Next.js (actions serveur, proxy d’authentification) est exécutée sur Vercel ; Supabase fournit la base PostgreSQL, l’authentification, le stockage et deux mécanismes temps réel ; "
      "le navigateur de chaque utilisateur porte la quasi-totalité de la logique de présentation et de la logique d’appel. Il n’y a pas de serveur de signalisation dédié ni de serveur média propre : "
      "la signalisation transite par le canal de diffusion de Supabase et le média circule en pair-à-pair, éventuellement relayé par le service TURN de Cloudflare."),
    F("fig/architecture-actuelle.png", "Architecture générale actuelle du module Messagerie", 14.5),
    H2("3.3. Architecture du module Messagerie"),
    P("Le modèle de données de la messagerie est volontairement compact. **Fait observé** (migrations 0003, 0005, 0009, 0010) :"),
    T("Tables et ressources de la messagerie", ["Ressource", "Rôle", "Contraintes notables"], [
        ["messages", "Messages texte, image, audio, sticker", "kind ∈ {text, image, audio, sticker} ; body ≤ 4 000 car. (≤ 12 000 après 0010) ; storage_path unique et préfixé par <couple>/chat/ ; reply_to ; edited_at ; deleted_at (suppression logique) ; enc ∈ {0,1} ; aucune politique DELETE"],
        ["message_cursors", "Curseur « lu jusqu’à » par personne", "une ligne par utilisateur ; mise à jour par son titulaire uniquement"],
        ["reactions", "Réactions (émoji ou sticker « s:n ») par message", "unicité (auteur, cible, émoji) ; émoji ≤ 8 caractères"],
        ["notifications", "Pastilles « nouveau » sans contenu", "insertion révoquée aux clients ; créées par trigger ; lues/mises à jour par le destinataire"],
        ["push_subscriptions", "Abonnements Web Push", "accès réservé au propriétaire"],
        ["calls", "Métadonnées des appels (jamais le média)", "statut ∈ {ringing, accepted, rejected, cancelled, missed, ended, failed} ; garde sur les champs immuables"],
        ["e2ee_keys", "Clé publique et clé privée enveloppée par personne", "lecture de sa propre ligne seulement ; clé du partenaire via une fonction ne retournant que la clé publique"],
        ["couple-media (Storage)", "Photos et vocaux", "bucket privé, 10 Mo par objet, types MIME image et audio (+ octet-stream pour le chiffré)"],
    ], [3.2, 4.8, 8.0]),
    F("fig/seq-envoi.png", "Diagramme de séquence : envoi d’un message texte", 15.0),
    F("fig/seq-reception.png", "Diagramme de séquence : réception, accusé de lecture et rattrapage", 14.0),
    P("**Analyse.** Le chemin d’envoi comporte trois étapes serveur indépendantes : validation et limitation (action serveur), contrôle d’accès (RLS) et notification. Le message apparaît à l’expéditeur avant confirmation et chez le destinataire par l’événement de changement de ligne. "
      "L’accusé de lecture est un **curseur** et non un statut par message : plus simple et adapté à deux participants, mais il ne distingue pas l’état « livré » de l’état « lu »."),
    H2("3.4. Architecture de la signalisation"),
    P("**Fait observé.** La signalisation d’appel repose sur un canal de diffusion privé nommé call:<identifiant du couple>, protégé par des politiques sur realtime.messages qui n’autorisent que les membres du couple. "
      "Chaque signal est un objet {callId, from, type, kind, sdp?, candidate?, muted?, cameraOff?, mac?} avec type ∈ {ringing, offer, answer, ice, hangup, reject, media}. "
      "La table calls complète ce canal : l’insertion d’une ligne (postgres_changes) fait sonner l’appelé même si le signal de diffusion est perdu, et la mise à jour de statut ferme l’appel de l’autre côté. "
      "Au démarrage et à chaque retour au premier plan, une lecture de l’appel actif (myActiveCallAction) rattrape un appel manqué par le canal."),
    P("**Analyse.** Cette double voie (diffusion non durable + table durable) est une réponse au caractère non fiable de la diffusion : la diffusion donne la rapidité, la table donne la garantie. "
      "Le prix est une logique de déduplication (ensemble d’identifiants d’appels clos, closedIds) pour éviter qu’une offre tardive ne fasse resonner un appel terminé."),
    H2("3.5. Architecture des communications audio et vidéo"),
    P("**Fait observé.** Les appels utilisent RTCPeerConnection avec bundlePolicy « max-bundle » et un réservoir de candidats (iceCandidatePoolSize = 2). La négociation suit le modèle offre/réponse : l’appelant crée l’offre ; "
      "tant que l’appel n’est pas décroché, l’offre est rediffusée toutes les 3 s (l’appelé peut ne pas encore être abonné) ; l’appelé répond après acceptation. Les candidats ICE sont échangés au fil de l’eau (trickle ICE) par le même canal et mis en file tant que la description distante n’est pas posée. "
      "Les serveurs ICE sont obtenus par une action serveur (voir 3.5.1) et mis en cache côté client pendant 2 h et préchargés à l’ouverture de l’application."),
    F("fig/seq-appel.png", "Diagramme de séquence : établissement d’un appel audio ou vidéo", 15.5),
    H3("3.5.1. Infrastructure d’appel : STUN, TURN, Cloudflare"),
    P("**Fait observé.** L’action getIceServersAction fournit, par ordre de priorité : (1) les identifiants du service **Cloudflare Realtime TURN**, obtenus par un appel REST authentifié (POST vers l’interface generate-ice-servers de Cloudflare, durée de vie 3 h), "
      "dont les URL en port 53 sont retirées ; (2) à défaut, un serveur **coturn** auto-hébergé avec identifiants éphémères calculés par HMAC à partir d’un secret partagé ; (3) à défaut, le serveur STUN public stun.l.google.com:19302. "
      "Aucun secret de longue durée n’atteint le navigateur."),
    NOTE("Rôle exact de Cloudflare", "Cloudflare n’intervient dans Allyza que comme **fournisseur d’un relais TURN** et d’identifiants éphémères. Il ne traite ni la signalisation, ni la messagerie, ni le stockage, ni l’hébergement de l’application. "
         "Le relais n’est sollicité que si ICE ne trouve pas de chemin direct ; les paquets qu’il relaie sont des paquets SRTP chiffrés de bout en bout entre les pairs. "
         "L’architecture ne constitue donc pas une architecture « cloud-native » complète ; elle utilise un service cloud ciblé. La présence effective de ces identifiants dans l’environnement de production : information à vérifier dans l’implémentation actuelle."),
    H3("3.5.2. Contrôles et états média"),
    P("Le micro et la caméra (API de capture [21]) sont contrôlés en activant ou désactivant la piste locale (track.enabled) et en signalant l’état à l’autre pair (signal « media »). L’inversion de caméra utilise un nouveau getUserMedia et replaceTrack sur l’émetteur vidéo. "
      "La sélection du haut-parleur utilise setSinkId sur l’élément média audible ; le bouton n’apparaît que si l’API existe et si au moins deux sorties sont énumérées. L’audio distant d’un appel audio est lu par un élément média invisible rattaché au flux distant."),
    H2("3.6. Gestion des messages et des médias"),
    F("fig/seq-media.png", "Diagramme de séquence : envoi d’une image ou d’un message vocal", 15.0),
    P("**Fait observé.** Les fichiers sont téléversés **directement** du navigateur vers le stockage privé, ce qui évite de les faire transiter par le serveur applicatif ; l’action serveur n’enregistre que la ligne de message après avoir vérifié que le chemin appartient au dossier du couple. "
      "Les images sont redimensionnées (plus grand côté ≤ 1 800 px), ré-encodées en WebP (qualité 0,86) par un passage par un canevas, ce qui supprime les métadonnées EXIF (position, appareil) ; les GIF sont conservés. "
      "Les messages vocaux sont enregistrés avec MediaRecorder (types candidats dans l’ordre : audio/mp4, audio/aac, audio/webm;codecs=opus, audio/webm ; débit demandé 32 kbit/s). "
      "La lecture utilise des URL signées d’une heure, mises en cache côté client 55 minutes."),
    H2("3.7. Gestion de la persistance"),
    P("Les messages, réactions, curseurs, notifications et appels sont persistés en base. Les médias sont persistés dans le stockage objet. L’état d’une communication en cours (flux, connexion pair-à-pair, minuteries) n’est **pas** persisté : "
      "il vit en mémoire dans le navigateur. Le brouillon de message non envoyé est conservé localement (stockage du navigateur) et survit à un changement d’application ; il n’est pas chiffré au repos par l’application."),
    H2("3.8. Gestion des états de communication"),
    F("fig/etat-appel.png", "Machine à états d’un appel et séparation CallProvider / CallOverlay", 14.5),
    P("**Fait observé.** L’état d’appel est porté par le composant CallProvider, monté dans le layout de l’application, donc au-dessus de toutes les pages. Les phases sont : inactif, sortant ou entrant, connexion, connecté, terminé. "
      "L’écran (CallOverlay) peut être plein écran ou réduit en palette flottante (MiniCall) ; réduire ne touche ni aux pistes, ni à la connexion, ni à la signalisation, et le flux distant continue d’être lu par la palette elle-même. "
      "Le bouton « Retour » de l’écran d’appel réduit l’appel ; il ne le termine pas. Le raccrochage automatique à la fermeture de la page (événement pagehide) a été retiré : il se déclenchait sur le simple passage en arrière-plan sur iOS."),
    P("**Analyse.** Le traitement de la persistance de l’appel comme un problème de **gestion d’état** (et non d’interface) est le résultat de l’audit : il est la condition pour que l’utilisateur puisse naviguer dans l’application pendant un appel. "
      "Il ne résout pas ce que le système d’exploitation décide indépendamment de l’application (voir 6.5)."),
    H2("3.9. Gestion des coupures et reconnexions"),
    F("fig/resilience.png", "Cycle de résilience d’un appel", 15.5),
    P("**Fait observé.** Lorsque l’état de connexion devient « disconnected » ou « failed », l’interface affiche « reconnexion… » ; l’**appelant** relance la négociation avec un redémarrage d’ICE (jusqu’à 3 fois) en diffusant une nouvelle offre ; "
      "si rien ne rétablit la connexion en 20 s, l’appel se termine avec le statut « failed ». L’appelé conserve ses minuteries propres (30 s pour se connecter après réponse ; 60 s de sonnerie). "
      "Au retour au premier plan, si la piste micro locale est terminée par le système, elle est reprise par un nouveau getUserMedia et replaceTrack sur la même connexion ; un Wake Lock d’écran est demandé pendant l’appel connecté."),
    P("**Limite.** Aucune mesure du temps de reprise n’existe. Le mécanisme d’ICE restart est **implémenté** mais son efficacité lors d’un changement réel de réseau (Wi-Fi vers 4G) n’est pas démontrée (scénario 6, chapitre 5)."),
    H2("3.10. Sécurisation de l’architecture"),
    F("fig/securite.png", "Couches de sécurité de l’architecture actuelle", 14.5),
    T("Mécanismes de sécurité : état de la preuve", ["Mécanisme", "Description (fait observé)", "Classe"], [
        ["Authentification", "Supabase Auth, identifiant converti en adresse technique, mot de passe ; JWT [37] dans un cookie rafraîchi par le proxy, qui vérifie l’utilisateur à chaque requête ; limitation à 8 essais/15 min par identifiant et 20/15 min par IP", "A"],
        ["Autorisation", "Fonction is_couple_member(couple_id) dans les politiques RLS de toutes les tables de la messagerie ; INSERT limité à author_id = auth.uid() ; pas de DELETE sur messages", "A"],
        ["Stockage", "Bucket privé, politiques lecture/écriture par appartenance au couple, suppression réservée au propriétaire de l’objet ; URL signées d’une heure", "A"],
        ["Validation serveur", "zod sur toutes les entrées ; chemins de médias vérifiés (préfixe, absence de « .. ») ; limites de débit (60 msg/min, 40 médias/min, 20 appels/min)", "A"],
        ["Secrets", "Clé service Supabase et clé privée VAPID côté serveur uniquement ; identifiants TURN éphémères (3 h)", "A"],
        ["Verrou d’application", "PIN/mot de passe haché par scrypt [17] (N=16 384, r=8, p=1), biométrie par clé publique WebAuthn vérifiée côté serveur, cookie HttpOnly SameSite=Lax signé de 12 h, rendu du seul écran de verrouillage quand verrouillé", "A"],
        ["Notifications", "Charge utile : type, langue, nom affiché (surnom du destinataire), identifiant d’appel ; aucun contenu de message ; clés VAPID ; TTL 24 h (60 s pour un appel)", "A"],
        ["Chiffrement en transit", "HTTPS/WSS fournis par Vercel et Supabase ; cookie Secure en production ; DTLS-SRTP des navigateurs pour le média. Configuration TLS des hébergeurs non auditée ici", "A (plateforme)"],
        ["Chiffrement de bout en bout", "Optionnel : voir 4.12. Code, tests unitaires et tests de base présents ; validation entre deux comptes non réalisée ; application de la migration en production non confirmée", "B"],
        ["Chiffrement au repos", "Fourni par la plateforme d’hébergement des données (information à vérifier) ; aucun chiffrement applicatif des brouillons locaux", "P"],
    ], [3.0, 11.0, 2.0], 8.5),
    NOTE("Distinction TLS / E2EE", "Sans activation du chiffrement de bout en bout, l’exploitant de la base (Supabase), l’hébergeur applicatif et quiconque obtient la clé de service peuvent lire le contenu des messages et, via des URL signées, les médias. "
         "Le chiffrement TLS protège le transit, pas le contenu contre l’opérateur. C’est précisément la limite que la couche E2EE optionnelle tente de lever."),
    P("**Menaces considérées** (grille inspirée de [34]). Écoute réseau (TLS, DTLS-SRTP) ; usurpation d’identité (authentification) ; accès croisé entre couples (RLS) ; énumération et exposition de fichiers (bucket privé, URL signées expirant en une heure) ; force brute (limiteurs ; verrouillage temporaire de l’application après échecs) ; "
      "vol de session (cookies HttpOnly ; vérification du JWT par le proxy ; pas de révocation instantanée démontrée) ; abus d’API (validation et limites en mémoire par instance, donc contournables en environnement multi-instances) ; "
      "interposition dans la signalisation (MAC des empreintes DTLS, uniquement si l’E2EE est actif) ; rejeu (liaison du MAC à l’identifiant d’appel et au rôle offre/réponse, mais sans contrôle de fraîcheur)."),
    H2("3.11. Résilience de l’architecture"),
    P("La résilience repose sur cinq dispositifs observés : double voie de signalisation (diffusion + base), rattrapage des messages à la reprise de visibilité et au retour en ligne, redémarrage d’ICE, reprise du micro, "
      "et nettoyage des appels « zombies » (un appel « ringing » depuis plus de 90 s est marqué manqué ; un appel « accepted » depuis plus de 4 h est clos). "
      "Ces dispositifs sont des **moyens** ; leur **efficacité** n’est pas mesurée."),
    H2("3.12. Architecture actuelle et architecture cible"),
    P("**Proposition / perspective, non confirmée comme implémentée.** L’architecture cible reprend les mêmes responsabilités mais les sépare en services, ajoute l’observabilité et durcit la sécurité."),
    F("fig/architecture-cible.png", "Architecture cible proposée (perspective)", 14.5),
    T("Écarts entre architecture actuelle et architecture cible", ["Domaine", "Actuelle (implémentée)", "Cible (proposition)"], [
        ["Services", "Application monolithique Next.js + services gérés", "Services messagerie, signalisation, médias derrière une passerelle"],
        ["Limitation de débit", "En mémoire par instance", "Distribuée (stockage partagé)"],
        ["E2EE", "ECDH statique + AES-GCM, optionnel", "Protocole à cliquet (type Double Ratchet) [30], rotation des clés, audit externe"],
        ["Observabilité", "console.error/warn uniquement", "Journaux structurés, métriques, traces ; getStats() WebRTC collecté"],
        ["Relais", "Un fournisseur TURN (ou coturn) configuré par variables", "Relais redondants multi-régions"],
        ["Clients", "PWA", "PWA + application native iOS (CallKit, PushKit)"],
        ["Fichiers", "Images et audio", "Documents et fichiers génériques chiffrés"],
    ], [2.6, 6.2, 7.2]),
    H2("3.13. Diagrammes d’architecture"),
    P("Les diagrammes d’architecture figurent dans les sections 3.2 (architecture générale), 3.8 (états), 3.9 (résilience), 3.10 (sécurité) et 3.12 (architecture cible)."),
    H2("3.14. Diagrammes de séquence"),
    P("Les diagrammes de séquence couvrent l’envoi et la réception d’un message (3.3), l’envoi d’un média (3.6), l’établissement d’un appel (3.5) et l’appel entrant avec sonnerie (ci-dessous). "
      "La reconnexion est représentée par le cycle de résilience (3.9). Le transfert d’un **document** n’est pas représenté : la fonctionnalité n’existe pas dans le code (classe D)."),
    F("fig/seq-entrant.png", "Diagramme de séquence : appel entrant et sonnerie", 15.5),
    P("La sonnerie est synthétisée avec la Web Audio API [23] : les oscillateurs passent par un unique nœud de gain maître, mis à zéro instantanément lorsque l’appel est accepté, refusé, annulé, expiré ou manqué, afin qu’aucun son ne subsiste. "
      "L’audio web étant verrouillé jusqu’à un premier geste de l’utilisateur, une application ouverte mais jamais touchée peut vibrer sans sonner ; hors de l’application, seule la notification est possible."),
    H2("3.15. Justification des choix technologiques"),
    T("Choix technologiques, motifs et alternatives", ["Choix", "Motif (fait ou analyse)", "Alternatives écartées ou possibles"], [
        ["PWA", "Une base de code unique, installable, sans passage par une boutique", "Application native (CallKit/PushKit) : proposition, hors périmètre actuel"],
        ["Supabase (PostgreSQL + RLS + Realtime + Storage)", "Autorisation exprimée en SQL au plus près des données ; temps réel intégré", "API sur mesure + WebSocket propre : plus de contrôle, plus d’exploitation"],
        ["Signalisation par diffusion Supabase", "Pas de serveur à exploiter ; canaux privés soumis à la RLS", "Serveur WebSocket dédié ; service de signalisation hébergé"],
        ["WebRTC pair-à-pair", "Média chiffré entre pairs sans serveur média ; adapté à deux participants", "SFU/MCU pour les groupes (proposition)"],
        ["TURN Cloudflare avec identifiants éphémères (coturn en secours)", "Remplace un service d’appel payant ; aucun secret longue durée côté client", "TURN auto-hébergé exclusivement ; services hébergés d’appel"],
        ["Web Push (VAPID) avec after()", "Seul canal de notification d’une PWA hors application ; after() évite l’interruption de la tâche sur serverless", "Notifications natives APNs (proposition)"],
        ["E2EE applicatif WebCrypto", "Aucune dépendance ; primitives standard [22]", "Protocole Signal/Matrix [29][30] : plus robuste, plus coûteux à implémenter"],
        ["Tonalités WebAudio synthétisées", "Aucun fichier à télécharger ni à mettre en cache", "Fichiers audio"],
    ], [3.6, 6.4, 6.0], 8.5),
]

CH4 = [
    H1("CHAPITRE 4 — IMPLÉMENTATION DU PROTOTYPE ALLYZA"),
    H2("4.1. Environnement de développement"),
    P("Le développement a été mené sous Windows 11 avec Node.js v26.1.0, Next.js 16.3.5 (mode développement sur le port 3100), TypeScript en mode strict, ESLint avec les règles du compilateur React, "
      "et déploiement sur Vercel. La base est un projet Supabase auquel les migrations SQL sont appliquées manuellement par l’éditeur SQL (information relevée pendant le développement). Le dépôt compte 34 commits entre le 21 et le 25 septembre 2026."),
    H2("4.2. Structure générale du prototype"),
    T("Organisation du code de la messagerie", ["Emplacement", "Rôle"], [
        ["src/app/(app)/messages/chat/page.tsx", "Page serveur : charge 150 derniers messages, réactions, curseurs, partenaire"],
        ["src/features/messaging/ChatClient.tsx (≈ 790 lignes)", "Conversation : état, temps réel, rattrapage, composer, médias, E2EE côté lecture/écriture"],
        ["src/features/messaging/ (autres)", "ChatShell (cadre sous clavier), MessageMenu (appui long), PhotoViewer, EmojiPicker, Linkified, CallHistory, ChatInfo"],
        ["src/actions/messages.ts", "Actions serveur : envoi texte/sticker/média, édition, suppression, lecture"],
        ["src/features/calls/CallProvider.tsx (≈ 510 lignes), CallOverlay.tsx", "État d’appel, WebRTC, signalisation ; affichage et palette"],
        ["src/actions/calls.ts", "Serveurs ICE, démarrage et statut d’appel, appel actif"],
        ["src/lib/e2ee/crypto.ts, store.ts ; src/features/e2ee/E2eeProvider.tsx", "Primitives, stockage de la clé, cycle de vie du chiffrement"],
        ["src/lib/push.ts, public/sw.js", "Envoi Web Push (serveur) ; Service Worker"],
        ["src/lib/sfx.ts, src/features/calls/use-ring.ts", "Tonalités et sonnerie"],
        ["supabase/migrations/0001–0010", "Schéma, RLS, déclencheurs, stockage, temps réel"],
        ["scripts/dbtest.mjs, e2ee-test.mjs, e2ee-bench.mjs", "Tests d’isolation SQL (PGlite), tests et banc de calcul cryptographiques"],
    ], [7.0, 9.0], 8.5),
    H2("4.3. Implémentation de la messagerie"),
    P("**Réception et synchronisation.** Le composant ChatClient s’abonne à un canal postgres_changes filtré par couple (INSERT et UPDATE de messages, UPDATE de message_cursors) et à un canal de diffusion privé pour l’indicateur de saisie (émis au plus toutes les 2,2 s). "
      "Un message est ajouté par une fonction upsert qui remplace le message temporaire (préfixe tmp-) correspondant, évitant les doublons dus à la double arrivée (réponse de l’action et événement). "
      "À chaque retour au premier plan ou retour en ligne, une requête relit les messages plus récents que le dernier connu (jusqu’à 100) : c’est le **rattrapage**, introduit après constat que les événements manqués pendant l’arrière-plan n’étaient jamais affichés."),
    P("**Interactions.** Appui long de 420 ms (annulé si le doigt bouge de plus de 10 px) ouvrant un menu contextuel positionné pour rester dans l’écran, avec un voile découpé (clip-path) pour ne pas flouter le message ; réactions rapides et sélecteur complet (20 stickers, groupes d’émojis) ; "
      "réponse avec citation ; édition et suppression logique réservées à l’auteur ; recherche accent-insensible sur les textes déjà chargés ; liens http(s) cliquables ; séparateurs de jours (« Aujourd’hui », « Hier ») ; séparateur « Nouveaux messages » ; brouillon local."),
    P("**États.** Un message de l’utilisateur passe de « temporaire » (opacité réduite) à « envoyé » (ligne confirmée) ; le dernier message envoyé porte une coche, ou une double coche lorsque le curseur du partenaire l’a dépassé. "
      "Il n’y a pas d’état « livré » distinct (classe D). La pastille « nouveau » de la navigation provient de la table notifications, relue au retour au premier plan."),
    H2("4.4. Transmission des médias"),
    P("Les photographies sont sélectionnées par l’entrée de fichier du système (qui peut proposer l’appareil photo selon la plateforme : information à vérifier), limitées à six par envoi, traitées comme décrit en 3.6, "
      "regroupées à l’affichage lorsqu’elles proviennent du même auteur à moins de deux minutes d’écart (grille de deux colonnes, quatre tuiles au plus avec indication du reste) et ouvertes dans une visionneuse offrant l’enregistrement (feuille de partage lorsque disponible, sinon téléchargement). "
      "**Les documents et fichiers génériques ne sont pas pris en charge** (le sélecteur n’accepte que des images ; le bucket n’autorise que des types image et audio)."),
    H2("4.5. Messages vocaux"),
    P("L’enregistreur ouvre le micro, choisit le premier type MIME pris en charge, enregistre par tranches de 100 ms, calcule un niveau sonore pour la forme d’onde et, à l’arrêt, assemble un Blob ; si le type fourni par MediaRecorder est vide (observé comme possible sur Safari), un type de repli est utilisé. "
      "Un enregistrement vide ou de moins de 200 octets n’est pas envoyé. L’extension du fichier (m4a, aac, webm) découle du type. À la réception, la lecture décode le fichier pour calculer une forme d’onde de 32 barres."),
    H2("4.6. Appels audio"),
    P("L’appel audio réutilise exactement la machine de l’appel vidéo sans piste vidéo. Le flux distant, sans élément visuel, est rattaché à un élément média invisible ; sans lui, aucun son n’était produit (voir 4.14). "
      "Les options de capture activent la suppression d’écho, la réduction de bruit et le contrôle automatique du gain. Le mute désactive la piste locale et signale l’état à l’autre pair."),
    H2("4.7. Appels vidéo"),
    P("La capture vidéo demande une résolution idéale de 1 280 × 720 avec le mode de face choisi. L’interface comporte l’image distante plein écran, un aperçu local flottant déplaçable avec accrochage aux coins et permutation au toucher, "
      "et des contrôles qui se masquent après 4,5 s d’inactivité. La réduction de l’appel affiche une palette de 112 × 156 px, déplaçable, rangeable sur un bord avec une poignée de rappel."),
    H2("4.8. Signalisation des appels"),
    P("Voir 3.4 et 3.5. L’implémentation ajoute deux optimisations de latence : l’offre diffusée porte le type d’appel (kind) afin que le téléphone de l’appelé sonne **sans attendre** la réplication de la ligne de la base, "
      "et les serveurs ICE sont préchargés et mis en cache. L’effet de ces optimisations sur le temps d’établissement n’a pas été mesuré."),
    H2("4.9. Persistance des données"),
    P("Voir 3.7. La table calls enregistre statut, instants de début, de réponse et de fin : elle alimente l’historique des appels (résultat : durée, manqué, sans réponse, refusé, annulé, interrompu) et la fonction de rappel."),
    H2("4.10. Gestion des reconnexions"),
    P("Voir 3.9. Les minuteries observées sont : sonnerie côté appelant 45 s, côté appelé 60 s ; renvoi de l’offre 3 s ; garde de connexion après réponse 30 s ; abandon après déconnexion 20 s ; ICE restart ≤ 3."),
    H2("4.11. Gestion des notifications"),
    P("Le Service Worker (version de cache « allyza-v5 ») ne met en cache que la coquille hors ligne et les ressources statiques immuables : pages, appels API, trafic Supabase et URL signées ne sont jamais mis en cache. "
      "À la réception d’un push, il affiche un texte localisé (« {nom} vous a écrit », « {nom} vous appelle », « Appel manqué de {nom} »), sauf pour un message lorsqu’une fenêtre visible est déjà sur la conversation. "
      "L’envoi (protocole Web Push [14]) côté serveur est exécuté dans after() de Next.js ; il lit les abonnements du destinataire avec la clé de service, respecte sa préférence de notification, supprime les abonnements expirés (404/410) et applique un TTL de 24 h (60 s pour un appel)."),
    H2("4.12. Mesures de sécurité mises en œuvre : chiffrement de bout en bout"),
    NOTE("Statut : classe B", "Le chiffrement de bout en bout est **implémenté dans le code et testé unitairement**, mais (i) il n’a pas été validé entre deux comptes réels, (ii) la migration 0010 n’est pas confirmée comme appliquée en production, (iii) il est optionnel et n’est actif que lorsque les deux personnes l’ont activé."),
    B([
        "**Identité** : une paire ECDH P-256 est générée sur l’appareil ; la clé publique est enregistrée en base ; la clé privée n’est stockée en base qu’**enveloppée** (AES-GCM sous une clé dérivée d’un mot de passe de chiffrement par PBKDF2-SHA256, 600 000 itérations, sel aléatoire [16]) et, sur l’appareil, comme clé **non extractable** (IndexedDB).",
        "**Clés partagées** : ECDH entre la clé privée locale et la clé publique du partenaire, puis HKDF-SHA256 [15] avec deux informations de contexte distinctes pour obtenir une clé de messages (AES-GCM 256) et une clé d’authentification (HMAC-SHA-256) pour la signalisation d’appel.",
        "**Messages** : AES-GCM avec IV aléatoire de 96 bits ; les données authentifiées additionnelles lient le chiffré au couple, à l’auteur et au type de message (un chiffré ne peut pas être déplacé vers un autre auteur ou type). Format « 1.<base64(IV‖chiffré)> ».",
        "**Médias** : une clé AES-GCM aléatoire par fichier ; le fichier chiffré est téléversé (type octet-stream) et la clé voyage dans un message chiffré.",
        "**Appels** : le MAC HMAC porte sur les empreintes DTLS de l’offre ou de la réponse, l’identifiant d’appel et le rôle ; un appel dont le MAC est invalide est refusé ; un appel est refusé au départ si le chiffrement est requis mais verrouillé.",
        "**Vérification** : un code de sécurité de 12 groupes de 5 chiffres, identique des deux côtés si les clés correspondent, est affiché ; une empreinte de la clé du partenaire est mémorisée à la première vue (confiance à la première utilisation, TOFU) et un changement bloque l’envoi jusqu’à confirmation.",
        "**Non-régression** : dès que les deux membres ont une clé, un déclencheur SQL refuse les messages en clair ; un message ne peut pas voir son marqueur « enc » modifié.",
    ]),
    P("**Limites assumées.** Pas de secret de transmission aval (clés statiques : le vol d’une clé privée ouvre les messages passés) ; métadonnées (qui, quand, type, taille, durée des vocaux, identifiant d’appel) non masquées ; "
      "perte irrécupérable du mot de passe de chiffrement ; fichiers chiffrés en un seul bloc en mémoire (adapté à la limite de 10 Mo, non à de grands fichiers) ; pas d’audit externe ; les anciens messages ne sont pas chiffrés rétroactivement."),
    H2("4.13. Limites de l’implémentation"),
    B([
        "Pas de métriques collectées (ni côté client, ni côté serveur) : la latence, le temps d’établissement et le taux d’échec ne sont pas mesurables à partir de l’application actuelle.",
        "Limiteur de débit en mémoire par instance ; donc non partagé entre instances serverless.",
        "La reprise du micro et du Wake Lock dépendent de la prise en charge des navigateurs.",
        "Appel entrant application fermée : notification seulement, sans sonnerie.",
        "Une seule conversation par couple, sans groupe.",
    ]),
    H2("4.14. Problèmes techniques rencontrés et corrections"),
    P("Cette section applique le format : symptôme, cause, diagnostic, correction, impact, limites, validation. Aucun problème n’est déclaré résolu sans élément de preuve ; le statut est indiqué explicitement."),
]

PROBLEMS = [
    ("P1 — Messages vocaux rejetés par le stockage", "Statut : corrigé et vérifié par essai", [
        ("Symptôme", "Les messages vocaux « ne partent pas » (signalé par l’utilisateur)."),
        ("Cause", "Le bucket privé n’autorisait que quatre types MIME d’image (migration 0001) ; tout téléversement audio était refusé."),
        ("Diagnostic", "Lecture de la configuration du bucket et de l’erreur de téléversement."),
        ("Correction", "Migration 0009 ajoutant audio/webm, audio/mp4, audio/aac, audio/mpeg, audio/ogg, audio/x-m4a."),
        ("Impact", "Les enregistrements sont acceptés par le stockage."),
        ("Limites", "Dépend de l’application de la migration à la base de production."),
        ("Validation", "Téléversements réels de fichiers audio/webm et audio/mp4 réussis par le développeur ; pas de campagne sur appareils."),
    ]),
    ("P2 — Messages vocaux vides ou lents", "Statut : corrections livrées, effet non mesuré", [
        ("Symptôme", "Messages reçus parfois vides ; envoi jugé lent (signalés par l’utilisateur)."),
        ("Cause", "**Hypothèses non démontrées** : conteneur WebM non lisible par certains Safari ; type MIME de MediaRecorder parfois vide sur Safari ; débit audio par défaut élevé pour de la voix."),
        ("Diagnostic", "Analyse du code de l’enregistreur et du comportement documenté de MediaRecorder."),
        ("Correction", "MP4/AAC en premier, débit demandé 32 kbit/s, type de repli, refus d’envoyer un enregistrement vide (< 200 octets ou sans tranche)."),
        ("Impact", "Réduction attendue de la taille des fichiers (non mesurée)."),
        ("Limites", "La cause réelle sur les appareils concernés n’est pas confirmée."),
        ("Validation", "À faire : protocole 5.3 (S-V : taille, durée d’envoi, lisibilité sur iOS/Android)."),
    ]),
    ("P3 — Appel audio sans son distant", "Statut : correction livrée, confirmation utilisateur non documentée", [
        ("Symptôme", "Absence de son de l’autre personne en appel audio."),
        ("Cause", "Le flux distant ne contenant que de l’audio n’était attaché à aucun élément média ; seul l’affichage vidéo en attachait un."),
        ("Diagnostic", "Lecture du composant d’affichage : l’élément n’existait que pour la vidéo."),
        ("Correction", "Élément <video> invisible rattaché au flux distant en appel audio ; relance de play() sur les événements de chargement, d’ajout de piste et de retour de visibilité ; suppression d’une analyse audio secondaire sur le flux distant, susceptible de couper le son sous Safari (hypothèse)."),
        ("Impact", "Lecture de l’audio distant."),
        ("Limites", "Le comportement exact sur Safari iOS reste à vérifier sur appareil."),
        ("Validation", "À faire : S-A (appel audio bout en bout sur deux appareils)."),
    ]),
    ("P4 — Appels coupés quand l’application passe en arrière-plan", "Statut : cause supprimée ; limite de plateforme persistante", [
        ("Symptôme", "Perte du micro puis coupure de l’appel après un certain temps ou à la sortie de l’application."),
        ("Cause", "Un gestionnaire pagehide raccrochait l’appel ; iOS déclenche pagehide lors d’un simple passage en arrière-plan. Aucun Wake Lock n’empêchait l’extinction de l’écran."),
        ("Diagnostic", "Revue du cycle de vie de la page et des gestionnaires d’événements."),
        ("Correction", "Suppression du gestionnaire ; Wake Lock d’écran pendant l’appel connecté ; reprise du micro si la piste est terminée au retour au premier plan."),
        ("Impact", "L’application ne termine plus volontairement l’appel."),
        ("Limites", "Le système peut suspendre une PWA ; aucune API web ne garantit le micro en arrière-plan sur iOS."),
        ("Validation", "À faire : scénarios S-5 et S-6 sur appareils."),
    ]),
    ("P5 — Latence d’établissement des appels", "Statut : optimisations livrées, effet non mesuré", [
        ("Symptôme", "Établissement jugé lent (signalé par l’utilisateur)."),
        ("Cause", "Analyse du code : récupération des serveurs ICE à la demande sur le chemin critique des deux côtés ; appelé informé par la réplication de la ligne de base plutôt que par la diffusion ; vérifications de nettoyage séquentielles dans l’action de démarrage."),
        ("Diagnostic", "Lecture du flux d’appel ; **aucune mesure chronométrée** n’a été effectuée."),
        ("Correction", "Cache de 2 h et préchargement des serveurs ICE ; réservoir de candidats ; offre diffusée portant le type d’appel ; nettoyage des appels périmés seulement s’il existe un appel actif."),
        ("Impact", "Réduction attendue (non quantifiée)."),
        ("Limites", "Les causes réelles dominantes (réseau, relais) ne sont pas isolées sans instrumentation."),
        ("Validation", "À faire : mesure du temps d’établissement avant/après (5.3, métrique M1)."),
    ]),
    ("P6 — Bouton haut-parleur sans effet", "Statut : corrigé dans le code", [
        ("Symptôme", "Le bouton ne produisait aucun changement audible ni visuel."),
        ("Cause", "Sélecteur ciblant un élément inexistant ; aucun état visuel ; l’API setSinkId n’existe pas partout."),
        ("Diagnostic", "Revue du gestionnaire."),
        ("Correction", "Ciblage de l’élément audible, état affiché cohérent avec la sortie réelle, bouton masqué si l’API ou plusieurs sorties sont absentes."),
        ("Impact", "Fonctionnel là où setSinkId est disponible."),
        ("Limites", "Indisponible sur Safari iOS (limite du navigateur, non contournée)."),
        ("Validation", "À faire sur appareil Android/Chrome."),
    ]),
    ("P7 — Notifications push non reçues en production", "Statut : correction livrée ; réception en production non documentée", [
        ("Symptôme", "Pas de notification hors de l’application."),
        ("Cause", "En environnement serverless, une promesse d’envoi non attendue est suspendue dès que la réponse est renvoyée ; l’envoi n’aboutissait pas."),
        ("Diagnostic", "Analyse du modèle d’exécution de la plateforme."),
        ("Correction", "Exécution de l’envoi dans after() de Next.js jusqu’à la réponse du service push."),
        ("Impact", "L’envoi est mené à terme avant la fin de la fonction."),
        ("Limites", "Dépend des clés VAPID et de la clé de service définies dans l’environnement de production."),
        ("Validation", "À faire : S-N (réception sur appareils, application fermée)."),
    ]),
    ("P8 — Interaction entre le micro de l’appel et l’enregistrement vocal", "Statut : mesures préventives ; conflit non reproduit formellement", [
        ("Symptôme", "Soupçon d’enregistrements vocaux déclenchés ou perturbés pendant un appel audio (signalé par l’utilisateur)."),
        ("Cause", "Aucun mécanisme créant automatiquement un message vocal n’a été trouvé. **Hypothèse** : contention sur la ressource micro (plusieurs getUserMedia)."),
        ("Diagnostic", "Revue des flux : l’enregistreur et l’appel ouvrent des flux distincts ; aucun partage."),
        ("Correction", "Bouton d’enregistrement désactivé pendant un appel ; enregistrement en cours abandonné si un appel démarre ; aucun envoi d’enregistrement vide."),
        ("Impact", "Le micro appartient à l’appel durant l’appel."),
        ("Limites", "La cause observée par l’utilisateur n’a pas été identifiée avec certitude."),
        ("Validation", "À faire : essai d’appel avec tentative d’enregistrement sur iOS."),
    ]),
    ("P9 — Sonneries et tonalités silencieuses", "Statut : correction livrée, confirmation utilisateur non documentée", [
        ("Symptôme", "Aucune sonnerie ni tonalité d’établissement/raccrochage."),
        ("Cause", "Le code testait l’état « running » du contexte audio immédiatement après resume(), qui est asynchrone ; un contexte suspendu ou interrompu (par exemple à l’ouverture du micro) ne jouait rien. Sur iOS, l’audio web peut aussi être coupé par le commutateur silencieux."),
        ("Diagnostic", "Revue du module audio."),
        ("Correction", "Attente effective de la reprise avant lecture ; déblocage par un tampon silencieux au premier geste ; session audio déclarée en lecture pendant la sonnerie puis rétablie."),
        ("Impact", "Lecture possible après un premier geste."),
        ("Limites", "Aucun son avant le premier geste de la session ; pas de sonnerie hors application."),
        ("Validation", "À faire sur appareils."),
    ]),
    ("P10 — Appels qui « ne s’établissent plus »", "Statut : NON confirmé comme résolu", [
        ("Symptôme", "Même après décrochage, l’appel ne s’établit pas, en audio comme en vidéo (signalé le 25 septembre)."),
        ("Cause", "Non établie. **Hypothèses** : relais TURN non configuré en production (appels entre réseaux différents) ; état de la session audio iOS après la sonnerie."),
        ("Diagnostic", "Aucune reproduction ; revue du code."),
        ("Correction", "Réinitialisation de la session audio avant la capture du micro ; message explicite « relais non configuré » lorsqu’aucun serveur TURN n’est fourni ; journalisation des erreurs d’appel."),
        ("Impact", "Meilleure capacité de diagnostic."),
        ("Limites", "Le problème peut persister ; la cause n’est pas isolée."),
        ("Validation", "À faire : S-1 et S-6 avec journalisation (type de candidat sélectionné)."),
    ]),
    ("P11 — Messages absents au retour d’arrière-plan", "Statut : corrigé dans le code", [
        ("Symptôme", "Les nouveaux messages n’apparaissaient qu’après avoir quitté puis rouvert la conversation."),
        ("Cause", "Les événements temps réel émis pendant l’absence ne sont pas rejoués."),
        ("Correction", "Relecture des messages récents au retour de visibilité et au retour en ligne ; resynchronisation des pastilles de non-lu."),
        ("Limites", "Limitée aux 100 messages suivants le dernier connu."),
        ("Validation", "À faire : S-5."),
    ]),
    ("P12 — Débordement de la mise en page avec un message cité long", "Statut : corrigé, vérifié visuellement", [
        ("Symptôme", "Le bouton d’envoi et la croix de réponse sortaient de l’écran ; la conversation s’élargissait."),
        ("Cause", "Colonnes de grille dimensionnées par leur contenu."),
        ("Correction", "Colonnes bornées (minmax(0, 1fr)), bulles limitées à leur colonne, citation tronquée."),
        ("Validation", "Rendu de composants avec données factices à 375 px de large (captures d’écran du développeur)."),
    ]),
    ("P13 — Chargement des photos", "Statut : optimisations livrées, effet non mesuré", [
        ("Symptôme", "Chargement lent des éléments (demande initiale du projet)."),
        ("Cause", "Signature répétée des mêmes chemins ; images volumineuses."),
        ("Correction", "Cache de signatures au niveau du module et déduplication des requêtes en vol ; signature par lot ; chargement différé des images ; redimensionnement à 1 800 px et WebP à l’envoi."),
        ("Validation", "À faire : mesure du temps de chargement (métrique M7)."),
    ]),
]

CH4_END = []
