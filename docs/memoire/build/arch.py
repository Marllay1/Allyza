# -*- coding: utf-8 -*-
from matplotlib.patches import FancyArrowPatch
import figs_base as fb


def fig_arch_actuelle():
    box, arrow, ax_fig = fb.box, fb.arrow, fb.canvas(9.2, 6.4, 100, 70)
    fig, ax = ax_fig
    box(ax, 2, 50, 24, 15, "Client A\nPWA Allyza\n(navigateur)\nNext.js 16 / React 19", fc=fb.PEACH, ec=fb.ROSE, bold=True)
    box(ax, 74, 50, 24, 15, "Client B\nPWA Allyza\n(navigateur)\nService Worker (push)", fc=fb.PEACH, ec=fb.ROSE, bold=True)
    box(ax, 36, 48, 28, 19, "Application serveur\n(Vercel)\nNext.js : Server Actions,\nproxy d'authentification", bold=True)
    box(ax, 14, 22, 23, 18, "Supabase\nPostgreSQL + RLS\nAuth (JWT, cookie)\nStorage privé", bold=True)
    box(ax, 39, 22, 22, 18, "Supabase Realtime\npostgres_changes\n+ broadcast privé", bold=True)
    box(ax, 63, 22, 23, 18, "Services externes\nCloudflare Realtime\nTURN (REST)\nService Web Push", bold=True)
    box(ax, 30, 3, 40, 12, "Média WebRTC pair-à-pair (DTLS-SRTP)\nrelayé par TURN si nécessaire", fc="#E3F1EF", ec=fb.TEAL, bold=True)
    arrow(ax, (26, 58), (36, 58), "HTTPS", both=True, off=(0, 0.6))
    arrow(ax, (74, 58), (64, 58), "HTTPS", both=True, off=(0, 0.6))
    arrow(ax, (42, 48), (28, 40), "SQL (RLS), Storage", both=True, off=(-12, -1))
    arrow(ax, (58, 48), (74, 40), "TURN, Web Push", both=True, off=(12, -1))
    arrow(ax, (14, 50), (44, 40), "WSS : événements, signalisation", color=fb.TEAL, ls="--", both=True, off=(-1, 2.2))
    arrow(ax, (86, 50), (56, 40), "WSS", color=fb.TEAL, ls="--", both=True, off=(4, 2.2))
    for x0, x1 in ((7, 30), (93, 70)):
        ax.plot([x0, x0], [50, 9], color=fb.TEAL, lw=1.3)
        ax.add_patch(FancyArrowPatch((x0, 9), (x1, 9), arrowstyle="<|-|>", mutation_scale=10, lw=1.3, color=fb.TEAL))
    ax.text(5.2, 30, "audio / vidéo", rotation=90, color=fb.TEAL, fontsize=7.5, ha="center", va="center")
    ax.text(94.8, 30, "audio / vidéo", rotation=90, color=fb.TEAL, fontsize=7.5, ha="center", va="center")
    ax.text(1, 68.5, "Fig. — Architecture actuelle (composants présents dans le dépôt)", fontsize=9.5, color=fb.VIOLET, fontweight="bold")
    ax.plot([2, 6], [0.2, 0.2], color=fb.VIOLET, lw=1.3); ax.text(7, 0.2, "requêtes", fontsize=7.5, va="center")
    ax.plot([20, 24], [0.2, 0.2], color=fb.TEAL, lw=1.3, ls="--"); ax.text(25, 0.2, "temps réel", fontsize=7.5, va="center")
    fb.save(fig, "architecture-actuelle.png")
