# Crea i due font TrueType incorporati nei PDF dei grafici (src/lib/pdf.ts): Inter Tight, solo
# caratteri latini, pesi 400 e 600, senza tabelle che il PDF non usa. Licenza: public/fonts/OFL.txt.
# Uso: pip install fonttools brotli && python scripts/font-pdf.py
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SORGENTE = "node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2"
for peso, nome in [(400, "Regular"), (600, "SemiBold")]:
    font = instancer.instantiateVariableFont(TTFont(SORGENTE), {"wght": peso})
    font.flavor = None
    for tabella in ["STAT", "DSIG", "GDEF", "GPOS", "GSUB", "gasp", "prep"]:
        if tabella in font:
            del font[tabella]
    font.save(f"public/fonts/InterTight-{nome}.ttf")
