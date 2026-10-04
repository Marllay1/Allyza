# -*- coding: utf-8 -*-
from blocks import *

THEME = "Conception d’une architecture de communication temps réel sécurisée et résiliente pour les applications multimédias distribuées"
SUBTITLE = "Cas d’étude : le module Messagerie du prototype expérimental Allyza"
PROBLEMATIQUE = ("Comment concevoir une architecture permettant de garantir simultanément confidentialité, intégrité, disponibilité "
                 "et faible latence dans une plateforme de communication multimédia temps réel fonctionnant sur des réseaux hétérogènes ?")

RESUME = [
    "Ce mémoire étudie la conception d’une architecture de communication temps réel sécurisée et résiliente pour des applications multimédias distribuées. "
    "Le support d’étude est Allyza, une application web progressive (PWA) privée destinée à deux utilisateurs, dont seul le module de messagerie est traité : "
    "messages textuels, stickers, réactions, photographies, messages vocaux, appels audio et vidéo WebRTC, notifications et verrouillage de l’application.",
    "Une phase d’audit du dépôt source (34 commits, du 21 au 25 septembre 2026) a permis de reconstituer l’architecture réellement présente : un client Next.js/React, "
    "des actions serveur déployées sur Vercel, une base PostgreSQL protégée par des politiques de sécurité au niveau des lignes (RLS) et un stockage objet privé fournis par Supabase, "
    "un canal temps réel (postgres_changes et diffusion privée) servant aussi de signalisation WebRTC, et un service de relais TURN de Cloudflare dont seuls des identifiants éphémères sont utilisés. "
    "Les fonctionnalités sont classées en quatre catégories (implémentée, partielle, prévue, proposition) afin de ne jamais présenter comme acquis ce qui relève de la perspective.",
    "Sur le plan expérimental, seules des mesures de calcul et des tests automatisés ont été réalisés : le coût d’un chiffrement de bout en bout optionnel (AES-GCM, ECDH P-256) "
    "est inférieur à 1,2 ms en médiane pour un message de 4 000 caractères et de l’ordre de 19 ms pour un fichier de 3 Mo sur le poste de test, "
    "et 96 contrôles d’isolation en base ainsi que 22 contrôles cryptographiques sont réussis. Les scénarios réseau (latence, perte, coupure, changement de réseau) font l’objet d’un protocole détaillé, "
    "mais aucun résultat n’est revendiqué à ce stade. Le mémoire conclut sur les compromis entre sécurité, performance et disponibilité et sur les limites propres au contexte PWA, "
    "et propose une architecture cible (observabilité, E2EE à cliquet, relais redondants, application native) présentée strictement comme perspective.",
]
ABSTRACT = [
    "This thesis studies the design of a secure and resilient real-time communication architecture for distributed multimedia applications. "
    "The case study is Allyza, a private progressive web app (PWA) for two users; only its messaging module is examined: text, stickers, reactions, photos, voice notes, "
    "WebRTC audio and video calls, push notifications and application lock.",
    "An audit of the source repository (34 commits, 21–25 September 2026) reconstructs the architecture actually present: a Next.js/React client, server actions hosted on Vercel, "
    "a PostgreSQL database with row-level security and private object storage from Supabase, a real-time channel that also carries WebRTC signalling, and Cloudflare’s TURN relay used only through short-lived credentials. "
    "Features are classified as implemented, partial, planned or proposed so that perspectives are never presented as results.",
    "Only computational measurements and automated tests were carried out: the cost of an optional end-to-end encryption layer (AES-GCM, ECDH P-256) is below 1.2 ms (median) for a 4,000-character message and about 19 ms for a 3 MB file "
    "on the test workstation, and 96 database isolation checks plus 22 cryptographic checks pass. Network scenarios (latency, loss, outage, network change) are specified as an experimental protocol; no result is claimed. "
    "The thesis discusses trade-offs between security, performance and availability and the limits of the PWA context, and proposes a target architecture as future work.",
]
KEYWORDS_FR = "communication temps réel ; WebRTC ; messagerie ; cybersécurité ; chiffrement de bout en bout ; résilience ; réseaux hétérogènes ; PWA ; observabilité ; Row Level Security"
KEYWORDS_EN = "real-time communication; WebRTC; messaging; cybersecurity; end-to-end encryption; resilience; heterogeneous networks; PWA; observability; Row Level Security"

ACRONYMS = [
    ("AAD", "Additional Authenticated Data (données authentifiées additionnelles, AES-GCM)"),
    ("AES-GCM", "Advanced Encryption Standard en mode Galois/Counter"),
    ("API", "Application Programming Interface"),
    ("CGNAT", "Carrier-Grade NAT"),
    ("DTLS", "Datagram Transport Layer Security"),
    ("E2EE", "End-to-End Encryption, chiffrement de bout en bout"),
    ("ECDH", "Elliptic Curve Diffie–Hellman"),
    ("HKDF", "HMAC-based Key Derivation Function"),
    ("HMAC", "Hash-based Message Authentication Code"),
    ("ICE", "Interactive Connectivity Establishment"),
    ("JWT", "JSON Web Token"),
    ("MAC", "Message Authentication Code"),
    ("MITM", "Man-in-the-Middle"),
    ("NAT", "Network Address Translation"),
    ("PBKDF2", "Password-Based Key Derivation Function 2"),
    ("PWA", "Progressive Web App"),
    ("RLS", "Row Level Security"),
    ("RTP / SRTP", "Real-time Transport Protocol / Secure RTP"),
    ("SDP", "Session Description Protocol"),
    ("SFU", "Selective Forwarding Unit"),
    ("STUN", "Session Traversal Utilities for NAT"),
    ("TLS", "Transport Layer Security"),
    ("TOFU", "Trust On First Use"),
    ("TURN", "Traversal Using Relays around NAT"),
    ("VAPID", "Voluntary Application Server Identification (Web Push)"),
    ("WSS", "WebSocket Secure"),
]

INTRO = [
    H1("INTRODUCTION GÉNÉRALE"),
    H2("1. Contexte et justification"),
    P("Les échanges numériques reposent de plus en plus sur des services qui combinent texte, images, voix et vidéo dans une même interface. Ces services doivent fonctionner sur des accès très différents "
      "(Wi-Fi domestique, 4G, 5G, réseaux d’entreprise filtrés), derrière des traducteurs d’adresses (NAT) et avec des conditions de transmission variables dans le temps. "
      "La communication temps réel se distingue du transfert de fichiers par sa tolérance limitée au retard : la recommandation ITU-T G.114 considère qu’un délai de transmission unidirectionnel de l’ordre de 150 ms est acceptable pour la plupart des usages conversationnels [24]. "
      "Elle se distingue aussi par la nature de ses données : une conversation privée contient des informations personnelles dont la compromission est difficilement réversible."),
    P("Concevoir une telle plateforme n’est donc pas un simple exercice de développement d’interface. Il faut arbitrer entre des propriétés qui peuvent s’opposer : chiffrer davantage ajoute du calcul et de la gestion de clés, "
      "relayer les flux pour traverser les NAT ajoute un saut réseau, reconnecter automatiquement ajoute de l’état à gérer et à tester, et protéger les métadonnées limite les informations disponibles pour diagnostiquer. "
      "Ces arbitrages sont rarement documentés pour des prototypes de petite taille, alors qu’ils déterminent la qualité réelle de la communication."),
    P("Allyza, application web progressive privée développée entre le 21 et le 25 septembre 2026, offre un terrain d’étude adapté : son module de messagerie réunit en un seul système des échanges transactionnels (texte, réactions), des médias différés (photos, messages vocaux) et des flux temps réel (appels audio et vidéo), "
      "le tout contraint par l’environnement d’une PWA sur téléphone."),
    H2("2. Problématique"),
    NOTE("Question centrale", PROBLEMATIQUE),
    P("Cette question se décline en sous-questions : (i) comment protéger la confidentialité et l’intégrité des contenus et de la signalisation sans dégrader sensiblement la latence perçue ; "
      "(ii) comment maintenir la continuité d’une communication lorsque le réseau ou le cycle de vie de l’application la perturbe ; (iii) quelles propriétés peuvent être démontrées par mesure et lesquelles ne peuvent, à ce stade, qu’être argumentées."),
    H2("3. Hypothèses de travail"),
    B([
        "**H1** — Une architecture qui sépare l’état d’une communication de son affichage est plus tolérante aux changements de contexte de l’interface (fermeture de l’écran d’appel, passage en arrière-plan) qu’une architecture où l’écran porte l’état.",
        "**H2** — Le coût de calcul d’un chiffrement applicatif de bout en bout est faible devant les délais réseau, pour des messages et des fichiers de taille courante. *Cette hypothèse est partiellement testée par mesure de calcul (chapitre 5) ; l’impact sur la latence de bout en bout n’est pas mesuré.*",
        "**H3** — Un relais TURN est nécessaire pour établir de façon fiable des appels entre réseaux différents ; sans lui, le taux d’échec augmente. *Hypothèse issue de la littérature [3][5], non mesurée sur Allyza.*",
        "**H4** — Les mécanismes de sécurité en transit (TLS, DTLS-SRTP) ne suffisent pas à protéger les contenus contre l’opérateur du service ; seul un chiffrement de bout en bout le permet [7][28].",
    ]),
    H2("4. Objectifs"),
    P("**Objectif général.** Concevoir et étudier une architecture de communication temps réel sécurisée et résiliente pour une application multimédia distribuée, à travers le cas d’étude Allyza."),
    P("**Objectifs spécifiques.**"),
    B([
        "reconstituer, à partir du code, l’architecture réellement implémentée du module de messagerie et la distinguer d’une architecture cible ;",
        "analyser les mécanismes de signalisation, de négociation et de reconnexion des appels audio et vidéo ;",
        "étudier la gestion des médias (photos, messages vocaux) et la persistance des échanges ;",
        "analyser le modèle de sécurité (authentification, autorisation, stockage privé, chiffrement en transit, chiffrement de bout en bout optionnel) et ses limites, y compris pour les métadonnées ;",
        "documenter les problèmes techniques réellement rencontrés, leurs causes, leurs corrections et ce qui reste à valider ;",
        "construire une méthodologie expérimentale reproductible et rendre compte honnêtement des mesures déjà disponibles.",
    ]),
    H2("5. Méthodologie"),
    P("La démarche suit sept étapes : analyse du besoin, état de l’art, spécification, conception, implémentation, expérimentation et analyse. L’audit du dépôt a été réalisé par lecture du code source, des migrations SQL, de la configuration et de l’historique Git ; "
      "il a été complété par l’exécution des suites de tests automatisées du projet et d’un micro-banc d’essai des primitives cryptographiques. Chaque affirmation sur Allyza renvoie à un élément vérifiable du dépôt ; "
      "lorsque la vérification n’est pas possible, la mention « Information à vérifier dans l’implémentation actuelle » est utilisée."),
    P("Dans tout le mémoire, on distingue explicitement : le **fait observé** (présent dans le code ou dans l’historique), le **résultat expérimental** (mesuré), l’**analyse**, l’**hypothèse**, la **proposition** et la **perspective**. "
      "Les fonctionnalités sont classées en : **A** réellement implémentée ; **B** partiellement implémentée ; **C** prévue mais non finalisée ; **D** proposition ou perspective."),
    H2("6. Délimitation du travail"),
    P("Le travail porte sur le module Messagerie d’Allyza : messages texte, stickers, émojis, réactions, édition, suppression, accusés de lecture, photographies, messages vocaux, appels audio et vidéo, signalisation, "
      "persistance des appels, notifications et verrouillage de l’application. Les autres espaces d’Allyza (suivi personnel, journal, souvenirs, jeux, etc.) ne sont évoqués que lorsqu’ils influencent l’architecture de communication."),
    H2("7. Limites du travail"),
    B([
        "Aucune campagne de mesure en conditions réseau réelles ou dégradées n’a été réalisée : le chapitre 5 fournit le protocole, pas des résultats de terrain.",
        "Les tests ont été exécutés sur un poste de développement (Windows, Node.js v26.1.0) et dans une base PostgreSQL en mémoire (PGlite), non sur des téléphones ni sur l’infrastructure de production.",
        "L’état de configuration de la production (variables d’environnement, application de la migration de chiffrement) n’est pas vérifiable depuis le dépôt.",
        "Les références bibliographiques ont été citées de mémoire à partir de sources normatives et académiques connues ; elles doivent être revérifiées avant dépôt (voir bibliographie).",
    ]),
    H2("8. Organisation du mémoire"),
    P("Le chapitre 1 présente le contexte, l’état de l’art et le cadre conceptuel. Le chapitre 2 analyse le projet Allyza, ses besoins et la matrice de vérification des fonctionnalités. "
      "Le chapitre 3 expose la conception de l’architecture de communication, actuelle puis cible. Le chapitre 4 décrit l’implémentation du prototype et les problèmes rencontrés. "
      "Le chapitre 5 présente la méthodologie expérimentale et les mesures effectivement disponibles. Le chapitre 6 discute les résultats, les limites et les perspectives, avant la conclusion générale."),
]

CH1 = [
    H1("CHAPITRE 1 — CONTEXTE, ÉTAT DE L’ART ET CADRE CONCEPTUEL"),
    P("Ce chapitre rassemble les notions nécessaires pour analyser une architecture de communication multimédia : nature des contraintes temps réel, technologies de transport et de signalisation, "
      "modèle de sécurité des communications, résilience et observabilité. Il ne décrit pas Allyza, traité à partir du chapitre 2."),
    H2("1.1. Communications temps réel"),
    P("Une communication est dite temps réel lorsque la valeur de l’information dépend du délai avec lequel elle est délivrée. La voix et la vidéo interactives sont des flux inélastiques : un paquet arrivé trop tard est inutile, "
      "alors qu’un transfert de fichier tolère de longs délais et se retransmet. Cette distinction explique que les protocoles de média temps réel privilégient la ponctualité sur la fiabilité complète : "
      "RTP transporte les échantillons avec horodatage et numéro de séquence mais sans retransmission garantie [11], et SRTP en assure la confidentialité et l’intégrité [10]."),
    H2("1.2. Applications multimédias distribuées"),
    P("Une application multimédia distribuée associe des clients hétérogènes, des services de coordination et des ressources de stockage ou de relais. On y distingue généralement trois familles de trafic, "
      "qui n’ont pas les mêmes exigences : (i) les **données transactionnelles** (messages, réactions, états de lecture), qui exigent cohérence et persistance mais tolèrent quelques centaines de millisecondes ; "
      "(ii) les **médias différés** (photographies, messages vocaux enregistrés), dominés par le débit et l’espace de stockage ; (iii) les **flux temps réel** (appels), dominés par la latence, la gigue et la perte. "
      "Un même système doit donc composer trois logiques de qualité de service (voir [32])."),
    H2("1.3. Réseaux hétérogènes"),
    P("Un utilisateur mobile passe d’un réseau Wi-Fi à un réseau cellulaire sans que l’application ne l’ait décidé ; son adresse IP publique change alors, et les associations établies dans les NAT sont perdues. "
      "Les NAT (y compris les NAT de niveau opérateur, CGNAT) empêchent l’ouverture de connexions entrantes et rendent la connectivité directe entre deux pairs incertaine [3][36]. "
      "Le débit disponible, le délai et le taux de perte varient dans le temps ; la connectivité peut être interrompue sans signal explicite. Une architecture temps réel doit donc être conçue pour un environnement **non déterministe** : "
      "elle ne peut pas supposer qu’une connexion établie le restera, ni qu’un événement émis sera reçu."),
    H2("1.4. Contraintes des communications temps réel"),
    T("Grandeurs caractéristiques d’une communication temps réel", ["Grandeur", "Définition", "Effet sur l’usage"], [
        ["Latence (délai)", "Temps de transmission d’un paquet ou d’un message entre deux points", "Interactivité ; au-delà d’environ 150 ms unidirectionnel, la conversation se dégrade [24]"],
        ["Gigue (jitter)", "Variation du délai entre paquets successifs", "Nécessite un tampon de gigue, qui ajoute du délai"],
        ["Perte de paquets", "Proportion de paquets non reçus ou reçus trop tard", "Artefacts audio/vidéo ; correction par dissimulation ou retransmission"],
        ["Débit", "Quantité de données par unité de temps", "Qualité vidéo ; adaptation du codage"],
        ["Disponibilité", "Aptitude du service à être rendu lorsqu’on le sollicite [27]", "Réussite de l’établissement et continuité de l’appel"],
    ], [3.2, 6.3, 6.5]),
    H2("1.5. Technologies de communication temps réel"),
    H3("1.5.1. WebSocket et événements serveur"),
    P("Le protocole WebSocket établit un canal bidirectionnel persistant au-dessus de HTTP [13]. Il permet de pousser des événements (nouveau message, indicateur de saisie) sans interrogation répétée. "
      "Il ne garantit pas la livraison après une coupure : un client déconnecté manque les événements émis pendant son absence, ce qui impose un mécanisme de rattrapage par lecture de l’état."),
    H3("1.5.2. WebRTC"),
    P("WebRTC désigne un ensemble de protocoles et d’interfaces de programmation permettant à des navigateurs d’échanger audio, vidéo et données en pair-à-pair [1][20][31]. "
      "La négociation d’une session repose sur l’échange de descriptions de session au format SDP [6] selon le modèle offre/réponse décrit par JSEP [2] ; **WebRTC ne normalise pas le canal de signalisation** qui transporte ces descriptions : "
      "chaque application choisit le sien. Les candidats de connectivité sont découverts et testés par ICE [3], qui s’appuie sur STUN pour découvrir l’adresse publique [4] et sur TURN pour relayer le trafic lorsque la connexion directe est impossible [5]. "
      "Les flux média sont protégés par SRTP, dont les clés sont établies par une négociation DTLS entre les deux pairs [9][10]."),
    H3("1.5.3. Signalisation et relais"),
    P("Parce que la signalisation est hors norme, sa sécurité relève de l’application. L’architecture de sécurité de WebRTC suppose que le canal de signalisation transmette fidèlement les empreintes de certificats DTLS ; "
      "un acteur qui contrôle ce canal peut, en l’absence d’authentification supplémentaire des empreintes, s’interposer dans l’appel [7][8]. Cette observation est centrale pour la suite (section 3.10)."),
    H2("1.6. Sécurité des communications"),
    P("On retient les trois propriétés classiques : **confidentialité** (seules les parties autorisées accèdent au contenu), **intégrité** (le contenu n’est pas modifié sans détection) et **disponibilité** (le service est utilisable quand il le faut) [27]. "
      "S’y ajoutent l’authentification, l’autorisation et la non-répudiation selon le contexte. Saltzer et Schroeder rappellent des principes de conception qui guident l’analyse : moindre privilège, défense en profondeur, mécanisme économique, conception ouverte [25]."),
    H3("1.6.1. Chiffrement en transit et chiffrement de bout en bout"),
    P("Le **chiffrement en transit** (TLS [12], DTLS [9]) protège le contenu entre deux extrémités d’une liaison : le serveur qui termine la connexion TLS voit le contenu en clair. "
      "Le **chiffrement de bout en bout (E2EE)** protège le contenu entre les terminaux des correspondants : le serveur ne manipule que du chiffré. Les deux ne sont pas interchangeables : "
      "un service entièrement protégé par TLS peut néanmoins lire, stocker et divulguer tous les messages [28]. C’est la distinction absolue retenue dans ce mémoire."),
    H3("1.6.2. Primitives utilisées dans les messageries chiffrées"),
    P("Les messageries chiffrées combinent un échange de clés (Diffie–Hellman sur courbes elliptiques [19]), une dérivation de clés (HKDF [15]) et un chiffrement authentifié (AES-GCM [18]). "
      "Les protocoles modernes ajoutent un cliquet de clés (Double Ratchet) qui procure le secret de transmission aval (forward secrecy) et la récupération après compromission [30][29]. "
      "Les messageries comparées dans la littérature (Signal, WhatsApp, Matrix) sont analysées par Unger et al. selon la confiance initiale, la conservation des conversations et la facilité d’usage [28]."),
    H3("1.6.3. Métadonnées"),
    P("Un contenu chiffré n’implique pas des métadonnées protégées : l’identité des correspondants, l’horodatage, la fréquence, la durée des appels, la taille des messages et les adresses IP restent observables par l’infrastructure, "
      "et peuvent suffire à reconstituer des habitudes [28]. La protection des métadonnées est un problème distinct du chiffrement du contenu."),
    H2("1.7. Résilience des communications"),
    P("La résilience est ici entendue comme l’aptitude à maintenir ou rétablir un service acceptable malgré des fautes ou des perturbations [27]. Pour un appel, cela recouvre la détection de la perte de connectivité, la reprise de la négociation de chemin "
      "(le redémarrage d’ICE (ICE restart) est prévu par la spécification d’ICE [3]), la limitation du temps d’attente avant abandon honnête et la préservation de l’état local lorsque l’interface change. "
      "Pour la messagerie, cela recouvre la reprise après coupure par relecture de l’état manquant plutôt que par la seule confiance dans les événements."),
    H2("1.8. Architectures distribuées et services temps réel"),
    P("Un système distribué est confronté aux compromis décrits par le théorème CAP : en présence d’une partition réseau, on ne peut garantir à la fois la cohérence et la disponibilité [26]. "
      "Les interfaces de messagerie adoptent en pratique une **cohérence à terme** avec affichage optimiste : le message apparaît localement avant confirmation, puis est réconcilié avec l’état serveur [39]. "
      "L’observabilité (journaux, métriques, traces) conditionne la capacité à diagnostiquer et à mesurer un tel système [33][38]."),
    H2("1.9. Solutions existantes"),
    P("Les solutions de communication temps réel se répartissent en trois familles. Les **services hébergés** (plateformes d’appel et de messagerie en ligne) délèguent la complexité à un fournisseur, au prix de la dépendance et, selon l’offre, d’un coût proportionnel à l’usage. "
      "Les **briques ouvertes** (serveurs SFU open source, serveurs TURN comme coturn, protocoles de messagerie fédérée) donnent la maîtrise mais demandent de l’exploitation. "
      "Enfin, les **messageries à chiffrement de bout en bout** reposent sur des protocoles publiés (Signal, Matrix) [30][29]. Le choix du prototype étudié (section 3.15) est situé par rapport à ces familles ; il ne s’agit pas d’une évaluation comparative de produits."),
    H2("1.10. Synthèse de l’état de l’art"),
    B([
        "WebRTC fournit un transport média sécurisé entre pairs, mais laisse à l’application la signalisation et donc une partie de la sécurité.",
        "La traversée de NAT exige STUN et, pour la fiabilité sur réseaux différents, un relais TURN [3][5].",
        "TLS et E2EE répondent à des menaces différentes ; les métadonnées restent exposées dans les deux cas.",
        "La résilience repose sur la détection, la reprise bornée dans le temps et la relecture d’état, plus que sur la confiance dans la livraison des événements.",
        "Sans instrumentation, les propriétés de latence et de disponibilité ne peuvent pas être démontrées.",
    ]),
]

CH2 = [
    H1("CHAPITRE 2 — PRÉSENTATION ET ANALYSE DU PROJET ALLYZA"),
    H2("2.1. Présentation générale d’Allyza"),
    P("**Fait observé.** Allyza est une application web progressive bilingue (français et anglais), installable sur l’écran d’accueil (manifeste avec affichage « standalone » et page de démarrage /home), "
      "destinée à un couple : deux comptes liés entre eux, dont les données sont isolées par appartenance au couple. Elle est développée avec Next.js 16.3.5 (routeur App Router et actions serveur), React 19.2.8, TypeScript 5 et Tailwind CSS 4, "
      "s’appuie sur Supabase (supabase-js 2.116, @supabase/ssr 0.12.7) pour la base, l’authentification, le stockage et le temps réel, et est déployée sur Vercel (information tirée des journaux de build fournis pendant le développement)."),
    P("Le prototype est traité ici comme **terrain d’expérimentation** : il permet d’implémenter concrètement les mécanismes étudiés (signalisation, relais, chiffrement, reprise) et d’en observer les limites, sans prétendre qu’il constitue un produit de référence."),
    H2("2.2. Vision et objectifs du projet"),
    P("Le projet vise un espace numérique privé pour deux personnes, où la confidentialité prime sur la diffusion. Dans cette perspective, la messagerie n’est pas un service public à grande échelle : "
      "elle est une conversation unique entre les deux membres du couple (aucune conversation de groupe n’est présente dans le code). Cette restriction simplifie le modèle (un curseur de lecture par personne, des appels un-à-un) mais limite la portée des conclusions sur la scalabilité."),
    H2("2.3. Fonctionnalités générales de la plateforme"),
    P("Au-delà de la messagerie, Allyza comprend un suivi personnel, un journal partagé, des souvenirs, des jeux et un espace de détente. Ces modules ne sont pas étudiés. "
      "Ils partagent avec la messagerie l’authentification, le modèle de couple, le stockage privé et le système de notifications, qui constituent des dépendances de l’architecture étudiée."),
    H2("2.4. Positionnement du module Messagerie"),
    P("Le module Messagerie s’appuie sur le client PWA, l’application serveur, la base de données, le stockage privé, le canal temps réel, le service de relais TURN et le service Web Push. Leur agencement est représenté à la figure de la section 3.2."),
    H2("2.5. Besoins fonctionnels"),
    T("Besoins fonctionnels du module Messagerie", ["Réf.", "Besoin", "Classe"], [
        ["BF1", "Échanger des messages texte (réponse à un message, édition, suppression, copie)", "A"],
        ["BF2", "Réagir à un message par un émoji ou un sticker ; envoyer des stickers", "A"],
        ["BF3", "Recevoir les messages en temps réel et après une période d’absence", "A"],
        ["BF4", "Connaître l’état d’envoi/lecture et voir l’indicateur de saisie", "A (lecture) ; D (livraison)"],
        ["BF5", "Envoyer et consulter des photographies, les enregistrer", "A"],
        ["BF6", "Enregistrer et écouter des messages vocaux", "A"],
        ["BF7", "Passer et recevoir des appels audio et vidéo avec sonnerie, micro, caméra, haut-parleur", "A / B"],
        ["BF8", "Poursuivre l’appel hors de l’écran d’appel (palette réduite)", "A (écran) ; B (arrière-plan)"],
        ["BF9", "Être notifié hors de l’application (messages, appels, appels manqués)", "B"],
        ["BF10", "Consulter l’historique des appels et rappeler", "A"],
        ["BF11", "Rechercher dans la conversation ; ouvrir les liens", "A"],
        ["BF12", "Échanger des documents et fichiers quelconques", "D (non implémenté)"],
    ], [1.6, 11.4, 3.0]),
    H2("2.6. Besoins non fonctionnels"),
    T("Besoins non fonctionnels", ["Réf.", "Exigence", "Mécanisme visé dans le prototype"], [
        ["BN1", "Confidentialité du contenu", "RLS, stockage privé, URL signées ; E2EE optionnel"],
        ["BN2", "Intégrité", "Chiffrement authentifié AES-GCM avec contexte lié ; triggers de garde en base"],
        ["BN3", "Disponibilité de l’appel", "Relais TURN, redémarrage ICE, reprise du micro"],
        ["BN4", "Faible latence d’établissement", "Mise en cache des serveurs ICE, offre diffusée sans attendre la base"],
        ["BN5", "Résilience aux changements d’interface", "Séparation état d’appel / écran, Wake Lock"],
        ["BN6", "Persistance", "Historique en base (messages, appels, curseurs de lecture)"],
        ["BN7", "Ergonomie mobile", "Cadre calé sur le viewport visuel, retours haptiques, tonalités"],
        ["BN8", "Minimisation des fuites par notification", "Charge utile limitée au type et au nom, sans contenu"],
    ], [1.6, 5.4, 9.0]),
    H2("2.7. Contraintes techniques et environnementales"),
    B([
        "**PWA** : pas d’accès aux interfaces d’appel natives (CallKit/PushKit sur iOS) ; l’audio et le micro en arrière-plan dépendent du système ; l’audio web est verrouillé avant un premier geste de l’utilisateur.",
        "**Navigateurs** : la sélection de la sortie audio (setSinkId) n’est pas disponible sur Safari iOS ; la prise en charge des API (Wake Lock, Web Push, WebAuthn) varie.",
        "**Serverless** : les actions s’exécutent sur Vercel ; le limiteur de débit du code est en mémoire par instance (best-effort) ; les tâches non attendues peuvent être interrompues (d’où l’usage de after()).",
        "**Coût** : le choix de composants à offre gratuite ou à coût faible (Supabase, Vercel, TURN de Cloudflare) borne les capacités.",
        "**Deux utilisateurs** : les résultats de charge ne sont pas extrapolables.",
    ]),
    H2("2.8. Cas d’utilisation du module Messagerie"),
    T("Cas d’utilisation principaux", ["Acteur", "Cas d’utilisation", "Préconditions"], [
        ["Membre du couple", "Envoyer / recevoir un message, une photo, un vocal, un sticker", "Authentifié ; couple complet (deux membres)"],
        ["Membre du couple", "Réagir, répondre, modifier, supprimer (ses propres messages)", "Message existant"],
        ["Appelant", "Initier un appel audio ou vidéo ; annuler ; rappeler", "Aucun autre appel actif"],
        ["Appelé", "Recevoir, accepter ou refuser un appel ; sonnerie", "Application ouverte (écran d’appel) ou notification"],
        ["Membre du couple", "Quitter l’écran d’appel, réduire, rouvrir ; raccrocher", "Appel en cours"],
        ["Membre du couple", "Activer le chiffrement de bout en bout, comparer le code de sécurité", "Mot de passe de chiffrement choisi"],
        ["Système", "Rattraper les messages manqués ; notifier hors application", "Reprise de visibilité / reconnexion"],
    ], [3.0, 8.4, 4.6]),
    H2("2.9. Scénarios de communication"),
    P("Les scénarios retenus pour l’étude sont : message texte ; envoi de média ; message vocal ; appel audio ; appel vidéo ; appel entrant ; interruption réseau ; reconnexion ; "
      "réception d’un message pendant l’utilisation de l’application ou après une période d’arrière-plan. Ils structurent les diagrammes du chapitre 3 et le protocole du chapitre 5."),
    H2("2.10. Matrice de vérification : état réel des fonctionnalités"),
    P("La matrice ci-dessous résume la classification A/B/C/D. Le détail avec les preuves dans le dépôt figure en annexe A. Elle constitue le fondement du principe directeur du mémoire : "
      "en cas de doute entre ce qui serait techniquement logique et ce qui est présent dans le code, c’est le second qui est retenu."),
    T("Synthèse de la classification des fonctionnalités", ["Classe", "Signification", "Éléments principaux"], [
        ["A", "Réellement implémentée (présente dans le code, relue)", "Messages texte, stickers, réactions, édition/suppression, accusés de lecture, rattrapage, photos, vocaux, appels WebRTC, signalisation par diffusion, relais TURN via identifiants, sonnerie, historique, palette réduite, Web Push, verrouillage, RLS, URL signées"],
        ["B", "Partiellement implémentée ou non validée de bout en bout", "E2EE (code et tests, validation entre deux comptes non réalisée, migration non confirmée en production) ; appels sur réseaux hétérogènes (non mesurés) ; haut-parleur (selon navigateur) ; persistance de l’appel en arrière-plan sur iOS ; appel entrant application fermée"],
        ["C", "Prévue, non finalisée", "Aucune fonctionnalité identifiée dans cette catégorie à partir des éléments disponibles"],
        ["D", "Proposition / perspective", "Fichiers et documents quelconques ; état « livré » distinct de « lu » ; observabilité ; CallKit/PushKit ; E2EE à cliquet ; architecture cible"],
    ], [1.3, 5.0, 9.7]),
]
