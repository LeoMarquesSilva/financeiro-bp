# MCPs para design e frontend

Este projeto já usa o **MCP shadcn** (componentes UI). Abaixo estão outros MCPs que ajudam em design, UI e consistência visual. Configure em **Cursor** em `.cursor/mcp.json` (ou em Settings → MCP).

---

## Já configurados

### shadcn
- **Uso:** Buscar, ver exemplos e adicionar componentes do registry shadcn (Card, Button, Sheet, etc.).
- **Config:** Já em `.cursor/mcp.json`.
- **Doc:** [ui.shadcn.com/docs/mcp](https://ui.shadcn.com/docs/mcp)

### lucide-icons
- **Uso:** Buscar ícones Lucide por nome/categoria e obter código React/JSX (o projeto usa `lucide-react`).
- **Config:** Já em `.cursor/mcp.json`.
- **Doc:** [mcpservers.org – Lucide Icons](https://mcpservers.org/servers/SeeYangZhi/lucide-icons-mcp)

### page-design-guide
- **Uso:** Guia de design (cores, tipografia, padrões de layout, acessibilidade, animação, componentes). Pergunte ao assistente coisas como “Que princípios de layout devo seguir para esta página?” ou “Revise a hierarquia visual deste formulário.”
- **Config:** Já em `.cursor/mcp.json`.
- **Doc:** [mcpservers.org – Page Design Guide](https://mcpservers.org/servers/chihebnabil/page-design-guide-mcp)

---

## Recomendados para design

### 1. Flowbite MCP
- **O que faz:** Componentes Tailwind (Flowbite), conversão **Figma → código** e geração de arquivo de tema a partir de cor de marca.
- **Relevante para:** Quem usa Figma; temas baseados em cor; componentes em HTML/React/Svelte.
- **Instalação (Cursor):** Adicione em `mcp.json`:
```json
"flowbite": {
  "command": "npx",
  "args": ["-y", "flowbite-mcp"],
  "env": {
    "FIGMA_ACCESS_TOKEN": "SEU_TOKEN_FIGMA"
  }
}
```
- **Doc:** [flowbite.com/docs/getting-started/mcp](https://flowbite.com/docs/getting-started/mcp)  
- **Opcional:** `FIGMA_ACCESS_TOKEN` só é necessário para a ferramenta de Figma → código.

---

### 2. Lucide Icons MCP
- **O que faz:** Busca nos 1500+ ícones Lucide, por nome ou categoria, e devolve exemplos em React/JSX.
- **Relevante para:** Este projeto já usa `lucide-react`; o MCP evita procurar ícone manualmente e gera o import correto.
- **Instalação (Cursor):** Adicione em `mcp.json`:
```json
"lucide-icons": {
  "command": "npx",
  "args": ["lucide-icons-mcp", "--stdio"]
}
```
- **Doc:** [GitHub seeyangzhi/lucide-icons-mcp](https://github.com/SeeYangZhi/lucide-icons-mcp)

---

### 3. Tailkits UI MCP
- **O que faz:** 200+ seções/componentes em Tailwind (hero, features, pricing, FAQ, etc.) com suporte MCP para descrever a UI em linguagem natural e receber código.
- **Relevante para:** Landing pages, marketing, páginas com muitas seções; design consistente.
- **Observação:** Produto pago (há componentes gratuitos); integração MCP é um dos diferenciais.
- **Doc:** [tailkits.com/ui](https://tailkits.com/ui) | [mcpservers.org – Tailkits UI](https://mcpservers.org/servers/tailkits-com-ui)

---

### 4. Page Design Guide MCP *(já configurado)*
- **O que faz:** Guia de design (psicologia de cores, tipografia, padrões de layout como F-Pattern e Bento Grid, acessibilidade, animação, botões, cards, formulários, navegação).
- **Relevante para:** Decisões de layout, hierarquia visual e acessibilidade sem sair do Cursor.
- **Doc:** [mcpservers.org – Page Design Guide](https://mcpservers.org/servers/chihebnabil/page-design-guide-mcp)

---

### 5. UntitledUI MCP
- **O que faz:** Fornece componentes do design system UntitledUI (botões, inputs, modais, dashboards, tabelas, sidebars) com tokens Tailwind.
- **Relevante para:** Projetos que querem um design system “enterprise” consistente.
- **Doc:** [mcpservers.org – UntitledUI MCP](https://mcpservers.org/servers/sbilde/untitledui-mcp)

---

### 6. A11y MCP Server
- **O que faz:** Auditoria de acessibilidade em páginas (axe-core) para identificar e ajudar a corrigir problemas.
- **Relevante para:** Garantir que o frontend atenda boas práticas de a11y.
- **Doc:** [mcpservers.org – A11y MCP](https://mcpservers.org/servers/priyankark/a11y-mcp)

---

## Onde descobrir mais MCPs

- **Cursor Directory:** [cursor.directory/mcp](https://cursor.directory/mcp) – MCPs e regras da comunidade.
- **Awesome MCP Servers:** [mcpservers.org](https://mcpservers.org) – Lista curada com busca por categoria (UI, Design, etc.).
- **Especificação MCP:** [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

## Resumo rápido

| MCP            | Foco              | Custo / token   |
|----------------|-------------------|------------------|
| shadcn         | Componentes React (já em uso) | Grátis   |
| Flowbite       | Tailwind + Figma → código + temas | Grátis*  |
| Lucide Icons   | Ícones (busca + código)        | Grátis   |
| Tailkits UI    | Seções Tailwind (landing, etc.)| Pago     |
| Page Design Guide | Guia layout/cores/a11y     | Grátis   |
| UntitledUI     | Design system enterprise       | Depende  |
| A11y           | Auditoria a11y                 | Grátis   |

\* Flowbite: uso do MCP é grátis; token Figma só para a ferramenta Figma → código.
