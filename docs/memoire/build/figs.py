# -*- coding: utf-8 -*-
"""Figures du mémoire (matplotlib). Chaque figure représente le système tel qu'il est dans le dépôt, ou est
explicitement étiquetée « cible ». Les graphiques de mesure lisent bench-e2ee.json (mesures réelles)."""
import json, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Polygon

OUT = os.path.join(os.path.dirname(__file__), "..", "fig")
os.makedirs(OUT, exist_ok=True)
VIOLET, VIOLET_L, PEACH, ROSE, GREY, INK, TEAL, RED = "#3B1F52", "#E9E1F0", "#F4C4B2", "#C45C7E", "#8A8394", "#1E1A24", "#2F7F7A", "#B3392F"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": GREY, "figure.dpi": 200})


def save(fig, name):
    for a in fig.axes:
        for t in list(a.texts) + [a.title, a._left_title, a._right_title]:
            if t.get_text().startswith("Fig."):
                t.set_visible(False)
    if getattr(fig, "_suptitle", None) is not None and fig._suptitle.get_text().startswith("Fig."):
        fig._suptitle.set_visible(False)
    fig.savefig(os.path.join(OUT, name), bbox_inches="tight", facecolor="white")
    plt.close(fig)


def box(ax, x, y, w, h, text, fc=VIOLET_L, ec=VIOLET, tc=INK, fs=8.5, bold=False, ls="-", r=0.08):
    p = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.02,rounding_size={r}", fc=fc, ec=ec, lw=1.2, ls=ls)
    ax.add_patch(p)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs, color=tc, fontweight="bold" if bold else "normal", wrap=True)


def arrow(ax, p, q, text="", color=VIOLET, ls="-", fs=7.5, off=(0, 0.08), both=False, rad=0.0):
    a = FancyArrowPatch(p, q, arrowstyle="<|-|>" if both else "-|>", mutation_scale=10, lw=1.3, color=color, ls=ls,
                        connectionstyle=f"arc3,rad={rad}")
    ax.add_patch(a)
    if text:
        ax.text((p[0] + q[0]) / 2 + off[0], (p[1] + q[1]) / 2 + off[1], text, ha="center", va="bottom", fontsize=fs, color=color)


def canvas(w, h, xl, yl):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, xl); ax.set_ylim(0, yl); ax.axis("off")
    return fig, ax


def sequence(name, actors, steps, title, height_per=0.42, width=None, note_fs=7.3):
    n = len(actors)
    width = width or max(7.2, 1.55 * n + 1)
    H = len(steps) * height_per + 1.6
    fig, ax = plt.subplots(figsize=(width, H))
    ax.set_xlim(0, n); ax.set_ylim(-len(steps) - 0.8, 1.2); ax.axis("off")
    xs = [i + 0.5 for i in range(n)]
    for x, a in zip(xs, actors):
        ax.add_patch(FancyBboxPatch((x - 0.46, 0.35), 0.92, 0.6, boxstyle="round,pad=0.02,rounding_size=0.06", fc=VIOLET, ec=VIOLET))
        ax.text(x, 0.65, a, ha="center", va="center", color="white", fontsize=7.6, fontweight="bold")
        ax.plot([x, x], [0.35, -len(steps) - 0.5], color=GREY, lw=0.8, ls=(0, (4, 3)))
    y = 0
    for s in steps:
        y -= 1
        kind = s[0]
        if kind == "msg":
            _, a, b, label, *opt = s
            dashed = bool(opt and opt[0] == "ret")
            color = TEAL if (opt and opt[0] == "rt") else (GREY if dashed else VIOLET)
            ax.annotate("", xy=(xs[b], y), xytext=(xs[a], y), arrowprops=dict(arrowstyle="-|>", color=color, lw=1.2, ls="--" if dashed else "-"))
            ax.text((xs[a] + xs[b]) / 2, y + 0.07, label, ha="center", va="bottom", fontsize=note_fs, color=INK)
        elif kind == "self":
            _, a, label = s
            ax.annotate("", xy=(xs[a], y - 0.25), xytext=(xs[a], y), arrowprops=dict(arrowstyle="-|>", color=ROSE, lw=1.1, connectionstyle="arc3,rad=-0.9"))
            ax.text(xs[a] + 0.12, y - 0.05, label, ha="left", va="center", fontsize=note_fs, color=ROSE)
        elif kind == "note":
            _, a, b, label = s
            x0, x1 = xs[a] - 0.4, xs[b] + 0.4
            ax.add_patch(FancyBboxPatch((x0, y - 0.3), x1 - x0, 0.6, boxstyle="round,pad=0.01,rounding_size=0.05", fc="#FFF4EE", ec=PEACH, lw=1))
            ax.text((x0 + x1) / 2, y, label, ha="center", va="center", fontsize=note_fs, color=INK)
    ax.set_title(title, fontsize=9.5, color=VIOLET, fontweight="bold", loc="left")
    save(fig, name)


# ---------------------------------------------------------------- 1. architecture actuelle

# ---------------------------------------------------------------- 2..8 séquences
def seq_envoi():
    A = ["Client A", "Server Action\n(Vercel)", "PostgreSQL\n+ RLS", "Realtime", "Client B", "Web Push\n+ SW de B"]
    S = [
        ("self", 0, "affichage optimiste (tmp-…)"),
        ("note", 0, 1, "[si E2EE actif] chiffrement AES-GCM côté client (le serveur ne reçoit que le chiffré)"),
        ("msg", 0, 1, "sendTextMessageAction(zod, 60/min)"),
        ("msg", 1, 2, "INSERT messages (JWT de A)"),
        ("self", 2, "RLS : membre du couple, auteur = auth.uid()"),
        ("self", 2, "triggers : notifications ; refus du clair si E2EE"),
        ("msg", 2, 1, "ligne insérée", "ret"),
        ("msg", 1, 0, "résultat → upsert (remplace tmp)", "ret"),
        ("msg", 2, 3, "changement de ligne (postgres_changes)", "rt"),
        ("msg", 3, 4, "INSERT messages (filtrage RLS)", "rt"),
        ("msg", 1, 5, "after() : pingPartner(« message »), sans contenu"),
        ("msg", 5, 4, "notification système « X vous a écrit »", "rt"),
    ]
    sequence("seq-envoi.png", A, S, "Fig. — Envoi d'un message texte", width=9.4)


def seq_reception():
    A = ["Client A", "Realtime", "Client B", "Server Action", "PostgreSQL"]
    S = [
        ("msg", 1, 2, "INSERT messages", "rt"),
        ("self", 2, "upsert + tonalité (si conversation visible)"),
        ("msg", 2, 3, "markMessagesReadAction()"),
        ("msg", 3, 4, "UPSERT message_cursors (last_read_at = now)"),
        ("msg", 4, 1, "UPDATE message_cursors", "rt"),
        ("msg", 1, 0, "curseur de B → coche double chez A", "rt"),
        ("note", 0, 4, "Rattrapage : à visibilitychange / online, B relit messages WHERE created_at > dernier connu"),
        ("msg", 2, 4, "SELECT (rattrapage après veille ou coupure)"),
        ("msg", 4, 2, "messages manqués → upsert", "ret"),
    ]
    sequence("seq-reception.png", A, S, "Fig. — Réception, accusé de lecture et rattrapage", width=8.6)


def seq_media():
    A = ["Client A", "Storage privé\n(couple-media)", "Server Action", "PostgreSQL", "Client B"]
    S = [
        ("self", 0, "image : redimensionnement ≤1800 px, EXIF retiré, WebP 0,86  |  vocal : MediaRecorder MP4/AAC 32 kbit/s"),
        ("note", 0, 1, "[si E2EE actif] clé AES-GCM aléatoire par fichier → fichier chiffré ; la clé voyage dans un message chiffré"),
        ("msg", 0, 1, "upload direct <couple>/chat/<uuid>.<ext> (RLS Storage)"),
        ("msg", 0, 2, "sendMediaMessageAction(chemin, durée)"),
        ("self", 2, "chemin validé : préfixe <couple>/chat/, sans « .. »"),
        ("msg", 2, 3, "INSERT messages (kind = image | audio)"),
        ("msg", 3, 4, "postgres_changes", "rt"),
        ("msg", 4, 1, "createSignedUrls(chemins, 3600 s)"),
        ("msg", 1, 4, "URL signées (cache module, 55 min)", "ret"),
        ("self", 4, "[E2EE] téléchargement du chiffré puis déchiffrement local"),
    ]
    sequence("seq-media.png", A, S, "Fig. — Envoi d'une image ou d'un message vocal", width=9.4, note_fs=7)


def seq_appel():
    A = ["Appelant A", "Server Action", "calls (DB)", "Canal broadcast\ncall:<couple>", "Appelé B", "TURN\nCloudflare"]
    S = [
        ("msg", 0, 1, "getIceServersAction (mis en cache 2 h)"),
        ("msg", 1, 5, "generate-ice-servers (ttl 3 h)"),
        ("self", 0, "getUserMedia (audio ± vidéo)"),
        ("msg", 0, 1, "startCallAction : un seul appel actif"),
        ("msg", 1, 2, "INSERT calls (ringing) + Web Push « call »"),
        ("self", 0, "RTCPeerConnection, createOffer, setLocalDescription"),
        ("msg", 0, 3, "signal « offer » (SDP) — renvoyé toutes les 3 s", "rt"),
        ("msg", 3, 4, "offer (+ kind) → sonnerie", "rt"),
        ("msg", 4, 3, "« ringing »", "rt"),
        ("msg", 4, 1, "updateCallStatus(accepted)"),
        ("self", 4, "getUserMedia, setRemoteDescription, createAnswer"),
        ("msg", 4, 3, "signal « answer » (SDP)", "rt"),
        ("msg", 0, 4, "candidats ICE (trickle) dans les deux sens", "rt"),
        ("note", 0, 4, "ICE choisit : direct (host/srflx) ou relayé TURN → DTLS → SRTP : média pair-à-pair"),
        ("self", 0, "connectionState = connected → minuterie, état micro/caméra"),
    ]
    sequence("seq-appel.png", A, S, "Fig. — Établissement d'un appel audio/vidéo (signalisation)", width=10)


def seq_entrant():
    A = ["Appelant A", "Server Action", "Service Web Push", "SW / PWA de B", "Canal broadcast", "PWA de B (ouverte)"]
    S = [
        ("msg", 0, 1, "startCallAction → INSERT calls"),
        ("msg", 1, 2, "after() : pingPartner(« call », callId) TTL 60 s", "rt"),
        ("note", 2, 3, "App fermée ou en arrière-plan : seulement une notification (requireInteraction, vibration)"),
        ("msg", 2, 3, "push (sans contenu)", "rt"),
        ("msg", 0, 4, "offer", "rt"),
        ("msg", 4, 5, "offer(kind) ou INSERT calls → écran d'appel entrant", "rt"),
        ("self", 5, "sonnerie WebAudio via un GainNode maître"),
        ("note", 5, 5, "coupée net : accepté, refusé, annulé, expiré (60 s)"),
        ("msg", 5, 4, "ringing / answer / reject", "rt"),
        ("msg", 3, 5, "notificationclick : focus + navigation vers la conversation"),
    ]
    sequence("seq-entrant.png", A, S, "Fig. — Appel entrant et sonnerie", width=10.2)


def fig_etat_appel():
    fig, ax = canvas(9, 4.6, 100, 50)
    ph = [("idle", 3), ("outgoing /\nincoming", 24), ("connecting", 47), ("connected", 69), ("ended", 88)]
    for t, x in ph:
        box(ax, x, 30, 14 if x < 80 else 11, 11, t, fc=PEACH if t == "connected" else VIOLET_L, bold=True)
    for (a, xa), (b, xb) in zip(ph, ph[1:]):
        arrow(ax, (xa + 14 if xa < 80 else xa + 11, 35.5), (xb, 35.5))
    arrow(ax, (76, 30), (76, 24), "", color=RED); ax.text(76, 22.5, "disconnected / failed\n→ « reconnexion… »\nICE restart ≤ 3 (appelant)\nabandon après 20 s", ha="center", va="top", fontsize=7.3, color=RED)
    box(ax, 3, 4, 40, 13, "CallProvider (monté dans le layout)\nPeerConnection · MediaStreams · signalisation · minuteries\n→ état de l'appel, indépendant de l'écran", fc=VIOLET, ec=VIOLET, tc="white", fs=8)
    box(ax, 50, 4, 46, 13, "CallOverlay (affichage)\nécran plein · palette flottante (MiniCall) · poignée au bord\n→ peut disparaître sans toucher à l'appel", fc="#E3F1EF", ec=TEAL, fs=8)
    arrow(ax, (43, 10.5), (50, 10.5), "props", both=True)
    ax.text(1, 48, "Fig. — Machine à états d'un appel et séparation état / affichage", fontsize=9.5, color=VIOLET, fontweight="bold")
    save(fig, "etat-appel.png")


def fig_securite():
    fig, ax = canvas(9, 5.8, 100, 62)
    layers = [
        ("Transport : HTTPS / WSS (TLS) assuré par les hébergeurs ; média WebRTC : DTLS-SRTP (navigateur)", "#F2ECF7", "P"),
        ("Authentification : Supabase Auth (identifiant + mot de passe), JWT en cookie, vérifié par proxy.ts", "#E9E1F0", "A"),
        ("Autorisation : RLS (is_couple_member), 70 politiques SQL ; Storage privé ; URL signées 1 h", "#DFD3EA", "A"),
        ("Application : validation zod, débit limité (mémoire), chemins validés, clé service côté serveur", "#D4C5E3", "A"),
        ("Verrou d'application : PIN / mot de passe (scrypt N=16384) / biométrie WebAuthn, cookie signé 12 h", "#C9B7DC", "A"),
        ("Notifications : charge utile sans contenu (type + nom), VAPID", "#BEA9D5", "A"),
        ("Chiffrement de bout en bout (opt-in) : ECDH P-256 + HKDF → AES-GCM ; MAC des empreintes DTLS", "#FFE5DA", "B"),
    ]
    y = 52
    for t, c, st in layers:
        ax.add_patch(FancyBboxPatch((2, y), 96, 6.4, boxstyle="round,pad=0.02,rounding_size=0.8", fc=c, ec=VIOLET, lw=1))
        ax.text(4, y + 3.2, t, va="center", fontsize=7.8, color=INK)
        ax.text(96, y + 3.2, "classe " + st, va="center", ha="right", fontsize=7.5, color=ROSE if st == "B" else (GREY if st == "P" else TEAL), fontweight="bold")
        y -= 7.4
    ax.text(2, 1.5, "A = implémenté, vérifié dans le code · B = dans le code, non validé de bout en bout · P = fourni par la plateforme, non audité ici",
            fontsize=7.3, color=GREY)
    ax.text(1, 60.5, "Fig. — Couches de sécurité de l'architecture actuelle", fontsize=9.5, color=VIOLET, fontweight="bold")
    save(fig, "securite.png")


def fig_cible():
    fig, ax = canvas(9.4, 6.8, 100, 74)
    ax.text(1, 72, "Fig. — Architecture cible (proposition, non implémentée)", fontsize=9.5, color=VIOLET, fontweight="bold")
    box(ax, 2, 56, 30, 11, "Clients PWA + application native iOS\n(CallKit / PushKit)", fc=PEACH, ec=ROSE, bold=True, ls="--")
    box(ax, 38, 56, 24, 11, "Passerelle API / Auth\nlimitation de débit distribuée", ls="--", bold=True)
    box(ax, 68, 56, 30, 11, "Observabilité\nlogs · métriques · traces\ngetStats() WebRTC", fc="#E3F1EF", ec=TEAL, bold=True, ls="--")
    for i, t in enumerate(["Service messagerie", "Service signalisation", "Service médias"]):
        box(ax, 2 + i * 33, 36, 30, 11, t, ls="--", bold=True)
    box(ax, 2, 16, 30, 11, "Base de données\nréplication, sauvegardes", ls="--")
    box(ax, 35, 16, 30, 11, "Stockage objet chiffré\n(E2EE par défaut)", ls="--")
    box(ax, 68, 16, 30, 11, "STUN / TURN redondants\n(plusieurs régions)", fc="#E3F1EF", ec=TEAL, ls="--")
    box(ax, 2, 2, 96, 8, "Sécurité : E2EE audité (protocole à cliquet type Double Ratchet) · rotation des clés · journaux d'audit · tests d'intrusion · métadonnées minimisées", fc="#FFE5DA", ec=PEACH, fs=8)
    arrow(ax, (32, 61.5), (38, 61.5), both=True); arrow(ax, (62, 61.5), (68, 61.5), both=True, color=TEAL, ls="--")
    for x in (17, 50, 83):
        arrow(ax, (50, 56), (x, 47))
    arrow(ax, (17, 36), (17, 27), both=True); arrow(ax, (50, 36), (50, 27), both=True); arrow(ax, (83, 36), (83, 27), both=True, color=TEAL)
    save(fig, "architecture-cible.png")


def fig_triangle():
    fig, ax = canvas(6.6, 5.4, 100, 82)
    ax.add_patch(Polygon([(50, 70), (8, 8), (92, 8)], closed=True, fc="#F6F1FA", ec=VIOLET, lw=1.6))
    ax.text(50, 74, "SÉCURITÉ", ha="center", fontsize=10, fontweight="bold", color=VIOLET)
    ax.text(6, 3, "PERFORMANCE\n(latence, qualité)", ha="center", fontsize=9, fontweight="bold", color=VIOLET)
    ax.text(94, 3, "DISPONIBILITÉ\n(résilience)", ha="center", fontsize=9, fontweight="bold", color=VIOLET)
    ax.text(50, 49, "E2EE : coût de calcul (mesuré),\nclés à gérer, perte possible\nde l'accès aux données", ha="center", fontsize=7.2, color=INK)
    ax.text(25, 28, "TURN : +un saut réseau\npour fiabiliser", ha="center", fontsize=7.2, color=INK)
    ax.text(75, 28, "Reconnexion : plus d'état\nà gérer et à tester", ha="center", fontsize=7.2, color=INK)
    ax.text(50, 14, "Notifications sans contenu :\nmoins d'information, moins de confort", ha="center", fontsize=7.2, color=INK)
    ax.text(1, 79, "Fig. — Triangle des compromis", fontsize=9.5, color=VIOLET, fontweight="bold")
    save(fig, "triangle.png")


def fig_resilience():
    fig, ax = canvas(9, 2.8, 100, 24)
    steps = ["Communication\nnormale", "Coupure /\nchangement de réseau", "Détection\n(connectionState)", "Reprise ICE\n(restart ≤ 3)", "Reprise ou\nabandon (20 s)"]
    for i, t in enumerate(steps):
        box(ax, 1 + i * 20, 6, 17, 12, t, fc=PEACH if i in (0, 4) else VIOLET_L, bold=True, fs=8)
        if i < 4:
            arrow(ax, (18 + i * 20, 12), (21 + i * 20, 12))
    ax.text(1, 22.5, "Fig. — Cycle de résilience d'un appel (mécanismes présents dans CallProvider)", fontsize=9.5, color=VIOLET, fontweight="bold")
    save(fig, "resilience.png")


# ---------------------------------------------------------------- graphiques de mesures réelles
def fig_bench():
    d = json.load(open(os.path.join(os.path.dirname(__file__), "..", "bench-e2ee.json")))
    t = d["tests"]
    fig, axs = plt.subplots(1, 2, figsize=(9, 3.4))
    sizes = list(t["text"].keys())
    enc = [t["text"][s]["encrypt_ms"]["median"] for s in sizes]; dec = [t["text"][s]["decrypt_ms"]["median"] for s in sizes]
    p95e = [t["text"][s]["encrypt_ms"]["p95"] for s in sizes]
    x = range(len(sizes))
    axs[0].bar([i - 0.2 for i in x], enc, 0.4, color=VIOLET, label="chiffrement (médiane)")
    axs[0].bar([i + 0.2 for i in x], dec, 0.4, color=PEACH, label="déchiffrement (médiane)")
    axs[0].plot(list(x), p95e, "o--", color=ROSE, label="chiffrement (p95)")
    axs[0].set_xticks(list(x)); axs[0].set_xticklabels([f"{s} car." for s in sizes]); axs[0].set_ylabel("ms"); axs[0].set_title("Messages texte (AES-GCM)", fontsize=9); axs[0].legend(fontsize=7)
    fs = list(t["file"].keys())
    fe = [t["file"][s]["encrypt_ms"]["median"] for s in fs]; fd = [t["file"][s]["decrypt_ms"]["median"] for s in fs]
    lab = [f"{int(s)//1000} ko" if int(s) < 1_000_000 else f"{int(s)/1e6:.0f} Mo" for s in fs]
    x = range(len(fs))
    axs[1].bar([i - 0.2 for i in x], fe, 0.4, color=VIOLET, label="chiffrement"); axs[1].bar([i + 0.2 for i in x], fd, 0.4, color=PEACH, label="déchiffrement")
    axs[1].set_xticks(list(x)); axs[1].set_xticklabels(lab); axs[1].set_ylabel("ms (médiane)"); axs[1].set_title("Fichiers (photo, vocal)", fontsize=9); axs[1].legend(fontsize=7)
    for a in axs:
        a.spines[["top", "right"]].set_visible(False)
    fig.suptitle(f"Fig. — Coût de calcul de l'E2EE, Node {d['env']['node']} ({d['env']['platform']}/{d['env']['arch']}), mesure réelle", fontsize=9, color=VIOLET, x=0.01, ha="left")
    save(fig, "bench-calcul.png")

    fig, ax = plt.subplots(figsize=(5.4, 3.2))
    sz = [int(s) for s in sizes]; ratio = [t["text"][s]["overhead_ratio"] for s in sizes]
    ax.plot(sz, ratio, "o-", color=VIOLET)
    for a, b in zip(sz, ratio):
        ax.annotate(f"×{b}", (a, b), textcoords="offset points", xytext=(5, 6), fontsize=8)
    ax.set_xscale("log"); ax.set_xlabel("taille du texte clair (caractères)"); ax.set_ylabel("taille chiffrée / taille claire"); ax.spines[["top", "right"]].set_visible(False)
    ax.set_title("Fig. — Surcoût de taille d'un message chiffré (mesuré)", fontsize=9, color=VIOLET, loc="left")
    save(fig, "bench-taille.png")


from arch import fig_arch_actuelle


if __name__ == "__main__":
    fig_arch_actuelle(); seq_envoi(); seq_reception(); seq_media(); seq_appel(); seq_entrant(); fig_etat_appel(); fig_securite(); fig_cible(); fig_triangle(); fig_resilience(); fig_bench()
    print(sorted(os.listdir(OUT)))
