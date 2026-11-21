# Simulace pro ZČU FEL ZAE

Interaktivní výklad regulace stejnosměrného motoru a zkouškový trenažér pro předmět ZAE (regulace) na ZČU FEL.

| Stránka | Odkaz |
|---|---|
| **Větší motor krok za krokem** – od samotného motoru po kaskádu s omezením proudu, posuvníky, grafy, odvození | https://geproha.github.io/zae-sim-velky-motor/ |
| **Zkouškový trenažér** – 10 verzí ukázkového vstupního testu, Bodeho grafy, návrh P/PI, postupy | https://geproha.github.io/zae-sim-velky-motor/trenazer.html |
| **Nápověda** – jak nahlásit chybu nebo připomínku | https://geproha.github.io/zae-sim-velky-motor/napoveda.html |

## Našel jsi chybu nebo máš nápad?

👉 **[Nahlásit chybu, připomínku nebo otázku](https://github.com/geproha/zae-sim-velky-motor/issues/new/choose)** – vyplníš krátký formulář. Potřebuješ jen (bezplatný) účet na GitHubu; nic se neinstaluje.

Nevíš jak? **[Nápověda krok za krokem](https://geproha.github.io/zae-sim-velky-motor/napoveda.html)**, i pro ty, kdo GitHub nikdy nepoužili. Přehled všech hlášení je v záložce [Issues](https://github.com/geproha/zae-sim-velky-motor/issues).

## Co je v repozitáři

```
docs/                    hotový web (GitHub Pages zveřejňuje tuto složku)
  index.html             výklad „Větší motor krok za krokem“
  trenazer.html          zkouškový trenažér
  napoveda.html          nápověda k hlášení chyb
  *.js                   model motoru, výklad, trenažér a data testu
  vendor/katex/          knihovna pro vzorce (MIT)
.github/ISSUE_TEMPLATE/  formuláře pro hlášení (chyba, připomínka, otázka)
CONTRIBUTING.md          jak přispět
LICENSE                  licence MIT
```

Soubory v `docs/` se generují ze soukromého studijního vaultu autora (skript `build.py`); opravy proto prosím hlas přes formulář, ne úpravou souborů.

## O projektu

Vytvořeno s umělou inteligencí na základě podkladů z předmětu ZČU FEL ZAE. Parametry motoru a regulátorů pocházejí z výukových podkladů předmětu (ZAE14), ostatní hodnoty jsou vlastní scénáře a odhady a ve výkladu jsou vždy označené. Nejde o oficiální materiál předmětu; směrodatné jsou přednášky a podklady vyučujících.

Autor: [geproha](https://github.com/geproha) · licence MIT (`LICENSE`) · KaTeX MIT (`docs/vendor/katex/LICENSE`)
