# -*- coding: utf-8 -*-
import re
p = open("build_pptx.py", encoding="utf-8").read()

def replace_block(n, newcode):
    global p
    m = re.search(r"(# =+ %d\. [^\n]*\n)(.*?)(?=\n# =+ \d+\. |\nfor sl in prs)" % n, p, re.S)
    assert m, n
    p = p[:m.start(2)] + newcode.strip("\n") + "\n" + p[m.end(2):]

replace_block(2, '''
s = new_slide(); title(s, "Des communications multimédias sur des réseaux peu fiables")
xs = [0.9, 5.0, 9.1]
labels = [("Utilisateurs", "Téléphones, navigateurs, PWA"), ("Réseaux hétérogènes", "Wi-Fi, 4G, 5G, NAT, coupures"), ("Services temps réel", "Signalisation, relais, stockage")]
for i, (h_, b_) in enumerate(labels):
    card(s, xs[i], 1.6, 3.3, 1.7, h_, b_, fill=TINT if i != 1 else WARN, body_size=17)
    if i < 2: arrow(s, xs[i] + 3.3, 2.45, xs[i + 1], 2.45)
text(s, MX, 3.65, 6.0, 3.3, [
    ("Pourquoi c’est difficile", {"bold": True, "color": VIOLET, "size": 22}),
    "La voix et la vidéo tolèrent peu de retard : environ 150 ms unidirectionnel (ITU-T G.114).",
    "La connectivité dépend de NAT, de changements de réseau et de coupures non annoncées.",
    "Le contenu est privé : sa compromission est irréversible."], size=18, space=9)
text(s, 6.9, 3.65, 5.8, 3.3, [
    ("Ce que le mémoire étudie", {"bold": True, "color": VIOLET, "size": 22}),
    "Les compromis entre sécurité, performance et disponibilité.",
    "Une architecture réellement implémentée, distinguée d’une architecture cible.",
    "Ce qui est mesuré, et ce qui reste à mesurer."], size=18, space=9)
footer(s); notes(s, "Contexte et justification — introduction générale, 1; chapitre 1, sections 1.1 à 1.4.")
''')

replace_block(7, '''
s = new_slide(); title(s, "Besoins fonctionnels et non fonctionnels")
card(s, MX, 1.5, 5.95, 5.3, "Besoins fonctionnels", ["Messages texte, réponses, édition, suppression", "Stickers, émojis, réactions", "Photos et messages vocaux", "Appels audio et vidéo, sonnerie, historique", "Poursuivre l’appel hors de l’écran d’appel", "Notifications hors application", "Persistance et rattrapage"], body_size=19)
card(s, 6.78, 1.5, 5.95, 5.3, "Besoins non fonctionnels", ["Confidentialité et intégrité", "Disponibilité de l’appel et résilience", "Faible latence d’établissement", "Persistance des échanges", "Ergonomie mobile", "Notifications sans contenu"], body_size=19, fill=TEAL_T, head_color=TEAL)
footer(s); notes(s, "Besoins — chapitre 2, 2.5 et 2.6 (références BF1 à BF12, BN1 à BN8).")
''')

replace_block(10, '''
s = new_slide(); title(s, "Module Messagerie : trois chemins pour trois trafics")
cols = [("Transactionnel", "Texte, réactions, lecture", ["Action serveur (zod, débit)", "INSERT sous RLS", "postgres_changes", "Rattrapage à la reprise"], TINT, VIOLET),
        ("Médias différés", "Photos, vocaux", ["Redimensionnement, EXIF retiré", "Téléversement direct", "Chemin validé côté serveur", "URL signées 1 h"], TINT, VIOLET),
        ("Temps réel", "Appels audio et vidéo", ["Offre/réponse par diffusion", "ICE + TURN", "SRTP pair-à-pair", "ICE restart ≤ 3"], TEAL_T, TEAL)]
for i, (a, b, items, fill, col) in enumerate(cols):
    x = MX + i * 4.07
    rect(s, x, 1.5, 3.9, 5.3, fill, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, x + 0.2, 1.65, 3.5, 0.55, [a], size=26, bold=True, color=col, face=HEAD, min_size=20)
    text(s, x + 0.2, 2.25, 3.5, 0.45, [b], size=17, color=MUTED, min_size=14)
    text(s, x + 0.2, 3.0, 3.5, 3.7, items, size=19, space=12, bullet=True)
footer(s); notes(s, "Chapitre 3, 3.3 à 3.6. Les diagrammes de séquence figurent dans le mémoire (envoi, réception, média, appel, appel entrant).")
''')

replace_block(11, '''
s = new_slide(); title(s, "Établissement d’un appel : de l’offre au média")
steps = [("1", "Offre (SDP)", "Diffusée sur le canal privé ; renvoyée toutes les 3 s"), ("2", "Sonnerie", "L’offre porte le type d’appel : B sonne sans attendre la base"),
         ("3", "Réponse (SDP)", "Après acceptation et capture du micro"), ("4", "Candidats ICE", "Direct (host, srflx) ou relayé par TURN"), ("5", "Média", "DTLS puis SRTP, pair-à-pair")]
for i, (n, a, b) in enumerate(steps):
    x = MX + i * 2.45
    rect(s, x, 1.6, 2.25, 3.0, TEAL_T if i == 4 else TINT, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    circle_num(s, x + 0.15, 1.75, n, 0.5, TEAL if i == 4 else VIOLET)
    text(s, x + 0.1, 2.35, 2.05, 0.5, [a], size=20, bold=True, color=VIOLET, min_size=16)
    text(s, x + 0.1, 2.9, 2.05, 1.65, [b], size=15, min_size=13)
    if i < 4: arrow(s, x + 2.25, 3.1, x + 2.45, 3.1)
text(s, MX, 4.95, 6.0, 1.9, [("Ce que fait le code", {"bold": True, "color": VIOLET, "size": 20}), "Un seul appel actif à la fois.", "Serveurs ICE en cache 2 h, préchargés.", "Table calls : garantie si la diffusion est perdue."], size=17, space=6)
text(s, 7.0, 4.95, 5.7, 1.9, [("Ce qui n’est pas mesuré", {"bold": True, "color": ROSE, "size": 20}), "Le temps d’établissement avant/après optimisation.", "Le taux de réussite entre réseaux différents."], size=17, space=6)
footer(s); notes(s, "Chapitre 3, 3.4 et 3.5 ; diagramme de séquence détaillé dans le mémoire (figure de la section 3.5) ; problème P5 (latence : optimisations livrées, effet non mesuré).")
''')

replace_block(13, '''
s = new_slide(); title(s, "Résilience : mécanismes présents, efficacité non démontrée")
phases = ["Communication normale", "Coupure ou changement de réseau", "Détection (connectionState)", "Reprise ICE (≤ 3 essais)", "Reprise ou abandon (20 s)"]
for i, t_ in enumerate(phases):
    x = MX + i * 2.45
    rect(s, x, 1.55, 2.25, 1.3, PEACH if i in (0, 4) else TINT, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, x + 0.05, 1.55, 2.15, 1.3, [t_], size=16, bold=True, color=VIOLET, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, min_size=13)
    if i < 4: arrow(s, x + 2.25, 2.2, x + 2.45, 2.2)
for i, (a, b) in enumerate([("Signalisation double", "diffusion rapide + table durable"), ("Rattrapage", "relecture des messages à la reprise"),
                            ("Redémarrage ICE", "par l’appelant, abandon après 20 s"), ("Reprise du micro", "nouvelle capture, même connexion")]):
    card(s, MX + i * 3.05, 3.2, 2.85, 2.1, a, b, body_size=16, head_size=18)
text(s, MX, 5.65, W - 2 * MX, 1.2, [("Aucun temps de reprise n’a été mesuré : les scénarios S-5 et S-6 sont protocolés, pas exécutés.", {"bold": True, "color": ROSE})], size=20)
footer(s); notes(s, "Chapitre 3, 3.9 et 3.11 ; chapitre 5, 5.6. Implémenté (classe A pour le code) ≠ démontré par l'expérience.")
''')

replace_block(14, '''
s = new_slide(); title(s, "Un appel est un état, pas un écran")
phs = ["idle", "sortant / entrant", "connecting", "connected", "ended"]
for i, t_ in enumerate(phs):
    x = MX + i * 1.7
    rect(s, x, 1.6, 1.5, 0.8, PEACH if t_ == "connected" else TINT, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, x, 1.6, 1.5, 0.8, [t_], size=14, bold=True, color=VIOLET, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, min_size=12)
    if i < 4: arrow(s, x + 1.5, 2.0, x + 1.7, 2.0)
rect(s, MX, 2.9, 3.9, 2.3, VIOLET, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
text(s, MX + 0.15, 3.0, 3.6, 2.1, [("CallProvider", {"bold": True, "size": 20, "color": PEACH}), "Monté dans le layout. Porte la connexion, les flux, la signalisation, les minuteries."], size=16, color=WHITE, space=5)
rect(s, MX + 4.5, 2.9, 3.9, 2.3, TEAL_T, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
text(s, MX + 4.65, 3.0, 3.6, 2.1, [("CallOverlay", {"bold": True, "size": 20, "color": TEAL}), "Simple vue : plein écran ou palette. Peut disparaître sans toucher à l’appel."], size=16, space=5)
arrow(s, MX + 3.9, 4.05, MX + 4.5, 4.05, TEAL)
text(s, MX, 5.5, 8.4, 1.3, ["Retiré : le raccrochage sur pagehide (iOS le déclenche en arrière-plan). Ajouté : Wake Lock d’écran, reprise du micro."], size=16)
text(s, 9.4, 1.55, 3.4, 5.3, [
    ("Hypothèse H1", {"bold": True, "color": VIOLET, "size": 20}),
    "Séparer l’état de l’appel de son affichage le rend tolérant aux changements d’interface.",
    ("Limite de la PWA", {"bold": True, "color": ROSE, "size": 20}),
    "Le système peut suspendre la page : aucune API web ne le garantit."], size=16, space=8)
footer(s); notes(s, "Chapitre 3, 3.8 ; problème P4. Le comportement hors écran est traité comme un problème de gestion d'état, pas d'interface.")
''')

replace_block(20, '''
s = new_slide(); title(s, "Le triangle des compromis")
tri = s.shapes.add_shape(MSO_SHAPE.ISOSCELES_TRIANGLE, Inches(1.4), Inches(2.0), Inches(4.6), Inches(3.9))
tri.fill.solid(); tri.fill.fore_color.rgb = rgb(TINT); tri.line.color.rgb = rgb(VIOLET); tri.line.width = Pt(2.5); tri.shadow.inherit = False
text(s, 2.2, 1.5, 3.0, 0.5, ["SÉCURITÉ"], size=20, bold=True, color=VIOLET, align=PP_ALIGN.CENTER, check=False)
text(s, 0.4, 5.95, 3.4, 0.8, ["PERFORMANCE", ("latence, qualité", {"size": 14, "bold": False, "color": MUTED})], size=18, bold=True, color=VIOLET, align=PP_ALIGN.CENTER, space=0, check=False)
text(s, 3.9, 5.95, 3.4, 0.8, ["DISPONIBILITÉ", ("résilience", {"size": 14, "bold": False, "color": MUTED})], size=18, bold=True, color=VIOLET, align=PP_ALIGN.CENTER, space=0, check=False)
text(s, 7.5, 1.6, 5.3, 5.2, [
    ("Pas de « meilleure » solution", {"bold": True, "color": VIOLET, "size": 22}),
    "E2EE : protège de l’opérateur ; ajoute la gestion de clés et un risque de perte.",
    "Reprise automatique : améliore la continuité ; ajoute des états à gérer et à tester.",
    "Métadonnées minimales : protègent ; réduisent le diagnostic, donc l’observabilité.",
    "Relais TURN : fiabilise la connexion ; ajoute un saut réseau (non mesuré)."], size=18, space=10)
footer(s); notes(s, "Chapitre 6, 6.3 : tableau d'analyse des compromis avec l'état de la preuve de chaque mécanisme.")
''')

replace_block(21, '''
s = new_slide(); title(s, "Limites du prototype, en toute transparence")
lim = [("Contraintes PWA", ["Pas de CallKit/PushKit", "Arrière-plan décidé par le système", "Audio verrouillé avant le premier geste", "Pas de choix du haut-parleur sur Safari iOS"]),
       ("Temps réel", ["Relais TURN à configurer en production", "Appels un-à-un uniquement", "Aucune métrique de qualité collectée"]),
       ("Méthode", ["Aucune campagne sur appareils", "Tests SQL dans PGlite, pas sur Supabase réel", "E2EE non validé entre deux comptes", "Bibliographie à revérifier"])]
for i, (a, items) in enumerate(lim):
    card(s, MX + i * 4.07, 1.5, 3.9, 5.3, a, items, body_size=18, fill=TINT if i != 1 else WARN)
footer(s); notes(s, "Chapitre 6, 6.5.")
''')

replace_block(22, '''
s = new_slide(); title(s, "Architecture cible : une proposition, non implémentée")
def dbox(x, y, w, h, t_, fill=TINT, col=VIOLET):
    rect(s, x, y, w, h, fill, line=col, shape=MSO_SHAPE.ROUNDED_RECTANGLE, dash=True, lw=1.5, radius=0.1)
    text(s, x, y, w, h, [t_], size=15, bold=True, color=INK, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, min_size=12)
dbox(MX, 1.5, 2.6, 0.95, "PWA + application iOS native", PEACH, ROSE); dbox(MX + 2.8, 1.5, 2.6, 0.95, "Passerelle API / Auth"); dbox(MX + 5.6, 1.5, 2.6, 0.95, "Observabilité", TEAL_T, TEAL)
dbox(MX, 3.0, 2.6, 0.95, "Service messagerie"); dbox(MX + 2.8, 3.0, 2.6, 0.95, "Service signalisation"); dbox(MX + 5.6, 3.0, 2.6, 0.95, "Service médias")
dbox(MX, 4.5, 2.6, 0.95, "Base répliquée, sauvegardes"); dbox(MX + 2.8, 4.5, 2.6, 0.95, "Stockage objet chiffré"); dbox(MX + 5.6, 4.5, 2.6, 0.95, "STUN / TURN redondants", TEAL_T, TEAL)
dbox(MX, 5.95, 8.2, 0.85, "Sécurité : E2EE à cliquet, rotation des clés, audit, tests d’intrusion", WARN, PEACH)
for x_ in (MX + 1.3, MX + 4.1, MX + 6.9):
    arrow(s, x_, 2.45, x_, 3.0); arrow(s, x_, 3.95, x_, 4.5)
text(s, 9.2, 1.5, 3.6, 5.3, [
    ("Évolutions proposées", {"bold": True, "color": VIOLET, "size": 20}),
    "Services séparés derrière une passerelle.", "Journaux, métriques, getStats().", "E2EE à cliquet, audité.", "Relais TURN multi-régions.", "iOS natif : CallKit, PushKit."], size=17, space=9)
footer(s); notes(s, "Chapitre 3, 3.12, et chapitre 6, 6.6. Tout ce qui figure ici est une perspective : ne pas présenter CallKit ou PushKit comme faisant partie de l'implémentation actuelle.")
''')

replace_block(23, '''
s = new_slide(); title(s, "Perspectives")
steps = [("Prototype actuel", "Architecture réelle documentée"), ("Mesurer", "Instrumenter, exécuter S-1 à S-6"), ("Renforcer", "E2EE à cliquet, relais redondants"), ("Étendre", "Natif iOS, groupes, charge")]
for i, (a, b) in enumerate(steps):
    x = MX + i * 3.05
    card(s, x, 2.0, 2.75, 2.8, a, b, body_size=18, fill=TINT if i else TEAL_T, head_color=VIOLET if i else TEAL)
    if i < 3: arrow(s, x + 2.75, 3.4, x + 3.05, 3.4)
text(s, MX, 5.3, W - 2 * MX, 1.4, ["Tout ce qui précède est une proposition ou une perspective, non confirmée comme implémentée."], size=20, color=ROSE, bold=True)
footer(s); notes(s, "Chapitre 6, 6.6 et 6.7.")
''')

replace_block(24, '''
s = new_slide(); title(s, "Apports du projet")
card(s, MX, 1.5, 5.95, 5.3, "Apports techniques", ["Séparation état d’appel / affichage", "Signalisation double : diffusion + base", "E2EE optionnel, refus de rétrogradation", "Problèmes réels et corrections documentés", "Protocole expérimental prêt à l’emploi"], body_size=19)
card(s, 6.78, 1.5, 5.95, 5.3, "Apports académiques", ["Réseaux : NAT, ICE, TURN, résilience", "Cybersécurité : RLS, TLS vs E2EE, métadonnées", "Systèmes distribués : cohérence à terme", "Cloud : services gérés et limites", "Temps réel : WebRTC, signalisation"], body_size=19, fill=TEAL_T, head_color=TEAL)
footer(s); notes(s, "Chapitre 6, 6.4.")
''')

replace_block(25, '''
s = new_slide(DEEP)
text(s, MX, 0.5, 6, 0.4, ["CONCLUSION"], size=14, color=PEACH, bold=True, check=False)
flow = [("Problème", "Garantir confidentialité, intégrité, disponibilité, faible latence"), ("Démarche", "Audit du dépôt, classes A/B/C/D, tests, protocole"), ("Solution", "Backend géré, WebRTC, E2EE optionnel"), ("Résultats", "96 + 22 contrôles ; chiffrement peu coûteux en calcul"), ("Perspectives", "Mesurer, renforcer, étendre")]
for i, (a, b) in enumerate(flow):
    x = MX + i * 2.45
    rect(s, x, 1.2, 2.3, 3.3, "3B1F52", shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, x + 0.1, 1.3, 2.1, 0.55, [a], size=22, bold=True, color=PEACH, face=HEAD, min_size=17)
    text(s, x + 0.1, 1.95, 2.1, 2.4, [b], size=16, color="E9E1F0", min_size=13)
text(s, MX, 4.9, W - 2 * MX, 1.9, ["L’architecture proposée n’est pas démontrée comme garantissant simultanément les quatre propriétés ; elle est construisible, ses compromis sont explicites et ce qui reste à établir est mesurable par un protocole précis."], size=24, color=WHITE, face=HEAD, min_size=18)
footer(s, dark=True); notes(s, "Conclusion générale : répond à la problématique sans aller au-delà des preuves.")
''')

# larger text on remaining slides
p = p.replace('"Trois familles de trafic dans un même module : transactionnel, médias différés, temps réel.",\n    "Contraintes réelles d’une PWA mobile : arrière-plan, notifications, audio verrouillé."], size=16, space=7)', '"Trois familles de trafic dans un même module : transactionnel, médias différés, temps réel.",\n    "Contraintes réelles d’une PWA mobile : arrière-plan, notifications, audio verrouillé."], size=18, space=9)')
p = p.replace('card(s, x, y, 3.9, 1.75, a, b, body_size=15)', 'card(s, x, y, 3.9, 1.75, a, b, body_size=17)')
p = p.replace('card(s, x, y, 3.75, 1.35, a, b, body_size=14, head_size=16)', 'card(s, x, y, 3.75, 1.35, a, b, body_size=16, head_size=18)')
p = p.replace('"Pas de serveur de signalisation ni de serveur média propre.", {"italic": True, "color": MUTED})], size=15, space=8)', '"Pas de serveur de signalisation ni de serveur média propre.", {"italic": True, "color": MUTED})], size=17, space=9)')
p = p.replace('fit_pic(s, os.path.join(FIG, "architecture-actuelle.png"), MX, 1.4, 8.2, 5.4)', 'fit_pic(s, os.path.join(FIG, "architecture-actuelle.png"), 0.4, 1.4, 8.6, 5.5)')
p = p.replace('card(s, MX, 1.5, 5.95, 5.3, "Enseignements"', 'card(s, MX, 1.5, 5.95, 5.3, "Enseignements"').replace('"L’isolation est exprimée dans la base, pas seulement dans l’interface."], body_size=16)', '"L’isolation est exprimée dans la base, pas seulement dans l’interface."], body_size=18)')
p = p.replace('"Mesures sur un poste de bureau, pas sur téléphone."], body_size=16, fill=WARN', '"Mesures sur un poste de bureau, pas sur téléphone."], body_size=18, fill=WARN')
open("build_pptx.py", "w", encoding="utf-8").write(p)
print("patched")
