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


