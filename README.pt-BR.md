<div align="center">

# 🎁 Git Wrapped

**O seu ano em código, resumido.**
Cards compartilháveis para qualquer perfil do GitHub: linguagens, sequências, ritmo de código e a sua personalidade dev.

[English](README.md)

<img src="docs/examples/pt-BR/summary-dark.svg" alt="Card de resumo do Git Wrapped" width="720">

</div>

## O que é

O Spotify tem o Wrapped. O seu histórico de commits também merece um. O Git Wrapped transforma um ano de atividade no GitHub em cards 1200×630 prontos para postar ou colocar no README do seu perfil.

- **Seis cards**: resumo, linguagens, repositórios mais ativos, ritmo de código, calendário de contribuições e personalidade dev
- **Temas escuro e claro**, em SVG puro: nítido em qualquer tamanho e funciona em README
- **Português e inglês**: use `--lang pt-BR` para os cards saírem em português
- **CLI e API HTTP**: gere arquivos localmente ou rode um servidor e embuta os cards com uma linha de Markdown
- **Zero dependências em runtime**: só Node.js, a biblioteca padrão e a API GraphQL do GitHub
- **Privado por padrão**: nomes de repositórios privados nunca aparecem nos cards
- **Teste sem token**: `--demo` usa dados de exemplo embutidos

## Como usar

Precisa do Node.js 22.18 ou mais novo.

```bash
git clone https://github.com/guilhermeoliveirabrito/gitwrapped.git
cd gitwrapped
npm install

# sem token, com dados de exemplo
npm run cli -- --demo
```

Para usar o seu perfil, crie um [token de acesso pessoal](https://github.com/settings/tokens) (dados públicos não exigem nenhum escopo; adicione `read:user` para contar contribuições privadas):

```bash
export GITHUB_TOKEN=ghp_seu_token
npm run cli -- seu-usuario --lang pt-BR --tz=-3
```

Os cards são salvos em `./wrapped`. A opção `--lang pt-BR` deixa os textos em português e a opção `--tz` define o fuso usado no gráfico por hora (por padrão, o fuso do seu sistema).

## Manter o README do perfil atualizado (GitHub Action)

O jeito mais simples de mostrar os cards no seu perfil não precisa de servidor. Este repositório também é um GitHub Action: ele gera os cards de novo toda semana e faz o commit no repositório do seu perfil (o que tem o nome `seu-usuario/seu-usuario`).

Crie `.github/workflows/gitwrapped.yml` nele:

```yaml
name: Update Git Wrapped

on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  wrapped:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: guilhermeoliveirabrito/gitwrapped@main
        with:
          lang: "pt-BR"
          tz: "-3"
```

E use os cards no `README.md` do perfil. O `<picture>` escolhe o card claro ou escuro conforme o tema de quem está vendo:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="gitwrapped/summary-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="gitwrapped/summary-light.svg">
  <img alt="Meu ano em código" src="gitwrapped/summary-dark.svg">
</picture>
```

Rode o workflow uma vez na aba **Actions** para criar os primeiros cards. A tabela completa de opções está no [README em inglês](README.md#keep-your-profile-readme-up-to-date-github-action).

## Embutir com o servidor HTTP

Se preferir hospedar a API, suba o servidor e cada card vira uma URL de imagem:

```bash
export GITHUB_TOKEN=ghp_seu_token
npm run build && npm start
```

```markdown
![Meu 2025](https://seu-host/api/card/summary?user=seu-usuario&year=2025&lang=pt-BR)
```

Também há um `Dockerfile` para hospedar por conta própria. Veja a seção de API e Docker no [README em inglês](README.md#embed-with-the-http-server).

## Contribuindo

Contribuições são bem-vindas, inclusive traduções dos cards. Leia o [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE) © Guilherme Oliveira de Brito Silva
