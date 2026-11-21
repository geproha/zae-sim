# zae-sim-velky-motor

Simulace pro ZČU FEL ZAE: interaktivní výklad regulace stejnosměrného motoru („Větší motor krok za krokem“) a zkouškový trenažér vstupního testu.

**Web:** https://geproha.github.io/zae-sim-velky-motor/ · trenažér: https://geproha.github.io/zae-sim-velky-motor/trenazer.html

- Stránky jsou za sdíleným heslem; heslo dostaneš od autora. Obsah je v repozitáři zašifrovaný (AES-256-GCM, klíč z hesla přes PBKDF2-SHA256, 600 000 iterací) a dešifruje se až v prohlížeči. Po prvním přihlášení si prohlížeč klíč pamatuje pro obě stránky.
- Vytvořeno s umělou inteligencí na základě podkladů z předmětu ZČU FEL ZAE. Parametry motoru a regulátorů jsou z výukových podkladů předmětu (ZAE14), ostatní hodnoty jsou vlastní scénáře a odhady, ve výkladu vždy označené.
- Soubory se generují skriptem `build_pages.py` ze soukromého studijního vaultu; neupravuj je ručně.

## Licence

Kód: MIT (`LICENSE`). Přibalená knihovna [KaTeX](https://katex.org/) je pod licencí MIT (`vendor/katex/LICENSE`).
