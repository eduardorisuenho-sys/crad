#!/usr/bin/env python3
"""
Lista oficial de espécies para o CRADS (roda no servidor, que tem internet).

Baixa o pacote Darwin Core Archive da Flora e Funga do Brasil (JBRJ) e grava
uma versão reduzida, só com as espécies que ocorrem na UF (padrão TO), mais os
sinônimos delas. O formato continua o mesmo (meta.xml + arquivos), então o app
lê com o mesmo importador. Nada é inventado: tudo vem do pacote oficial.

Uso:  python3 flora.py SAIDA.zip [UF] [ARQUIVO_DE_ENTRADA.zip]
"""
import datetime, io, json, os, re, ssl, sys, urllib.request, zipfile

URL = "https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil"


def atributo(tag, nome):
    m = re.search(r'\s%s="([^"]*)"' % nome, " " + tag)
    return m.group(1) if m else None


def blocos(meta):
    """(tipo, arquivo, separador, linhas de cabeçalho, índice do id, {termo: índice})"""
    for m in re.finditer(r"<(core|extension)\s([^>]*)>([\s\S]*?)</\1>", meta):
        tag, corpo = m.group(2), m.group(3)
        tipo = re.split(r"[/#]", atributo(tag, "rowType") or "")[-1].lower()
        local = re.search(r"<location>([^<]+)</location>", corpo)
        if not local:
            continue
        sep = (atributo(tag, "fieldsTerminatedBy") or "\\t").replace("\\t", "\t")
        pular = int(atributo(tag, "ignoreHeaderLines") or "0")
        idm = re.search(r'<(?:id|coreid)\s[^>]*index="(\d+)"', corpo)
        termos = {}
        for f in re.finditer(r"<field\s[^>]*>", corpo):
            i, t = atributo(f.group(0), "index"), atributo(f.group(0), "term")
            if i is not None and t:
                termos[re.split(r"[/#]", t)[-1]] = int(i)
        yield tipo, local.group(1).strip(), sep, pular, int(idm.group(1)) if idm else 0, termos


def reduzir(entrada: bytes, uf: str) -> bytes:
    zin = zipfile.ZipFile(io.BytesIO(entrada))
    nomes = {n.split("/")[-1]: n for n in zin.namelist()}
    meta = zin.read(nomes["meta.xml"]).decode("utf-8")
    info = list(blocos(meta))
    ler = lambda arq: zin.read(nomes[arq]).decode("utf-8").split("\n")

    # 1) quem ocorre na UF
    na_uf = set()
    for tipo, arq, sep, pular, idi, termos in info:
        if tipo != "distribution" or arq not in nomes:
            continue
        loc = termos.get("locationID")
        for linha in ler(arq)[pular:]:
            c = linha.rstrip("\r").split(sep)
            if loc is not None and len(c) > loc and re.sub(r"^BR-", "", c[loc].strip().upper()) == uf:
                na_uf.add(c[idi].strip())

    # 2) táxons: os da UF e os sinônimos deles
    manter = set(na_uf)
    for tipo, arq, sep, pular, idi, termos in info:
        if tipo != "taxon":
            continue
        aceito = termos.get("acceptedNameUsageID")
        for linha in ler(arq)[pular:]:
            c = linha.rstrip("\r").split(sep)
            if aceito is not None and len(c) > aceito and c[aceito].strip() in na_uf:
                manter.add(c[idi].strip())

    # 3) grava o pacote reduzido, com os mesmos arquivos e cabeçalhos
    saida = io.BytesIO()
    with zipfile.ZipFile(saida, "w", zipfile.ZIP_DEFLATED) as zout:
        zout.writestr("meta.xml", meta)
        for tipo, arq, sep, pular, idi, termos in info:
            if arq not in nomes:
                continue
            linhas = ler(arq)
            corpo = linhas[:pular] + [l for l in linhas[pular:] if l.strip() and l.rstrip("\r").split(sep)[idi].strip() in manter]
            zout.writestr(arq, "\n".join(corpo) + "\n")
    return saida.getvalue()


def baixar(url=URL):
    """Baixa o pacote. Sites do governo às vezes mandam o certificado incompleto:
    nesse caso tenta de novo sem conferir a cadeia (o conteúdo é público)."""
    req = urllib.request.Request(url, headers={"User-Agent": "CRADS (Tocantins)"})
    try:
        return urllib.request.urlopen(req, timeout=900).read()
    except (ssl.SSLError, urllib.error.URLError) as erro:
        if "CERTIFICATE" not in str(erro).upper() and "SSL" not in str(erro).upper():
            raise
        print("certificado do site não conferiu; tentando de novo sem conferir a cadeia")
        return urllib.request.urlopen(req, timeout=900, context=ssl._create_unverified_context()).read()


def contar_especies(pacote: bytes) -> int:
    z = zipfile.ZipFile(io.BytesIO(pacote))
    meta = z.read("meta.xml").decode("utf-8")
    for tipo, arq, sep, pular, idi, termos in blocos(meta):
        if tipo == "taxon":
            return max(0, len([l for l in z.read(arq).decode("utf-8").split("\n")[pular:] if l.strip()]))
    return 0


def anotar(destino, **dados):
    """situacao.json ao lado do pacote: o app mostra se deu certo ou o erro."""
    dados["quando"] = datetime.datetime.now().isoformat(timespec="seconds")
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(destino)), "situacao.json"), "w") as f:
            json.dump(dados, f, ensure_ascii=False)
    except OSError:
        pass


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    destino, uf = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "TO").upper()
    final = destino[:-5] if destino.endswith(".novo") else destino
    anotar(final, ok=False, andamento="baixando a lista do Jardim Botânico (pode levar alguns minutos)")
    try:
        entrada = open(sys.argv[3], "rb").read() if len(sys.argv) > 3 else baixar()
        anotar(final, ok=False, andamento="separando as espécies do " + uf)
        reduzido = reduzir(entrada, uf)
        with open(destino, "wb") as f:
            f.write(reduzido)
        if destino != final:
            os.replace(destino, final)
        n = contar_especies(reduzido)
        anotar(final, ok=True, uf=uf, registros=n, tamanho_kb=len(reduzido) // 1024)
        print(f"Lista da Flora e Funga ({uf}) gravada em {final} ({len(reduzido) // 1024} KB, {n} nomes)")
    except Exception as erro:  # noqa: BLE001 — o motivo vai para o app
        anotar(final, ok=False, erro=f"{type(erro).__name__}: {erro}")
        print(f"Não deu para baixar a lista: {erro}")
        sys.exit(1)


if __name__ == "__main__":
    main()
