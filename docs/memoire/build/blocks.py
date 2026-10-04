# -*- coding: utf-8 -*-
"""Mini-DSL pour décrire le mémoire. Texte : **gras**, *italique*, `code`."""

def H1(t, new_page=True): return ("h1", t, new_page)
def H2(t): return ("h2", t)
def H3(t): return ("h3", t)
def P(t): return ("p", t)
def B(items): return ("bullets", items)
def N(items): return ("numbers", items)
def NOTE(label, t): return ("note", label, t)
def T(caption, header, rows, widths=None, font=9): return ("table", caption, header, rows, widths, font)
def F(path, caption, width_cm=15.5): return ("fig", path, caption, width_cm)
def PB(): return ("pagebreak",)
