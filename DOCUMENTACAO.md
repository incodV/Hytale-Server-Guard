# Documentação: Hytale-Server-Guard

O **Hytale-Server-Guard** é uma plataforma pública desenvolvida para auxiliar administradores de servidores a consultar e relatar jogadores com comportamentos prejudiciais (griefers, hackers, etc.). Inspirado visualmente no universo de Hytale, o projeto foi construído com foco em simplicidade, utilizando apenas HTML, CSS e JavaScript puros, sem a necessidade de frameworks complexos ou bancos de dados externos para sua versão inicial.

Esta documentação detalha a estrutura do projeto, como utilizá-lo e como o administrador geral pode gerenciar as denúncias.

---

## Estrutura do Projeto

O projeto é composto por quatro arquivos principais, projetados para serem facilmente hospedados em plataformas de sites estáticos, como o Netlify ou o GitHub Pages.

| Arquivo | Descrição |
| :--- | :--- |
| `index.html` | Contém toda a estrutura visual da página, incluindo o cabeçalho, a seção de busca, a lista de denúncias e os modais de interação. |
| `style.css` | Define o tema "Dark Fantasy" inspirado no Hytale. Responsável pela responsividade, cores, tipografia e animações da interface. |
| `app.js` | Gerencia toda a lógica da aplicação. Controla o salvamento de dados no `localStorage`, a renderização dos cards, o sistema de busca e a autenticação do administrador. |
| `data.json` | Arquivo de dados inicial. Fornece exemplos de denúncias para que a plataforma não inicie vazia na primeira execução. |

---

## Como Funciona o Armazenamento de Dados

Para manter a simplicidade e permitir que o projeto rode sem um servidor backend (Node.js, PHP, etc.), o Hytale-Server-Guard utiliza o **`localStorage`** do navegador.

Quando um usuário acessa o site pela primeira vez, o script `app.js` verifica se existem dados salvos no navegador. Caso não existam, ele carrega as informações do arquivo `data.json` e as salva localmente. A partir desse momento, todas as novas denúncias, aprovações ou exclusões são salvas diretamente no navegador do usuário.

**Nota Importante:** Como os dados ficam salvos no navegador de quem está acessando, se você limpar o cache do navegador ou acessar o site por outro dispositivo, verá apenas os dados iniciais do `data.json`. Para transformar este projeto em uma plataforma global real, será necessário conectar o `app.js` a um banco de dados real (como Firebase, Supabase ou um backend próprio) no futuro.

---

## Guia do Administrador Geral (wonerGard)

A plataforma possui um sistema de moderação exclusivo para a conta do administrador geral. Apenas o administrador pode aprovar denúncias para que elas fiquem visíveis ao público, além de poder rejeitá-las ou excluí-las permanentemente.

### Como fazer Login

1. Acesse a página inicial do Hytale-Server-Guard.
2. No canto superior direito, clique no botão **"Admin Login"**.
3. Uma janela de prompt aparecerá solicitando o nome de usuário. Digite exatamente: `wonerGard`.
4. Em seguida, será solicitada a senha. Digite a senha padrão: `admin123`.
5. Se os dados estiverem corretos, o botão mudará para **"Sair (wonerGard)"** e os controles de moderação aparecerão nos cards de denúncia.

### O Painel de Administração

Agora o projeto conta com um **Painel de Administração Dedicado**. Para acessá-lo:
1. Faça login como `wonerGard`.
2. No menu de navegação superior, aparecerá o link **"Painel Admin"** em dourado.
3. Clique nele para entrar na visão de gerenciamento.

#### Recursos do Painel:
*   **Estatísticas em Tempo Real:** Veja o total de denúncias pendentes, aprovadas e o volume total da base de dados.
*   **Tabela de Gestão:** Uma visão organizada de todas as denúncias com filtros automáticos por data.
*   **Ações Rápidas:** Botões para Aprovar, Rejeitar ou Excluir diretamente da tabela.
*   **Visualização Detalhada:** Botão "Ver" para abrir um resumo completo dos dados do denunciante e as provas.

### Ações de Moderação Clássicas

Quando logado como `wonerGard`, você terá acesso a todas as denúncias cadastradas, independentemente do status. Os usuários comuns só conseguem visualizar as denúncias que estão com o status **"Aprovado"**.

Nos cards de denúncia, você verá os seguintes botões:

*   **Aprovar:** Muda o status da denúncia para "Aprovado". A partir desse momento, a denúncia fica visível para todos os visitantes do site e aparecerá nos resultados de busca pública.
*   **Rejeitar:** Muda o status para "Rejeitado". A denúncia permanece no sistema apenas para o administrador, mas fica oculta para o público.
*   **Excluir:** Remove permanentemente a denúncia do sistema. Esta ação não pode ser desfeita.

### Como alterar a senha do Administrador

Se desejar alterar a senha padrão (`admin123`), você precisará editar o arquivo `app.js`.

1. Abra o arquivo `app.js` em um editor de texto ou código.
2. Procure pela função `toggleAdmin()`, localizada por volta da linha 140.
3. Encontre a linha que contém a verificação da senha: `if (pass === 'admin123') {`
4. Substitua `'admin123'` pela sua nova senha desejada.
5. Salve o arquivo e atualize a página no navegador.

---

## Guia para Usuários Comuns

Os visitantes do site podem utilizar a plataforma para duas funções principais: consultar o histórico de jogadores e enviar novas denúncias.

### Consultando Jogadores

A barra de pesquisa na seção principal (Hero Section) permite buscar jogadores pelo **Nome** ou pelo **UUID**. A busca é feita em tempo real. Assim que o usuário começa a digitar, a lista de cards abaixo é filtrada automaticamente.

Para usuários comuns, a busca retorna apenas resultados de denúncias que já foram **aprovadas** pela moderação.

### Enviando uma Denúncia (Política de Provas)

Para manter a plataforma leve e organizada, **não é permitido o upload de imagens diretamente no site**. Todas as provas devem ser enviadas obrigatoriamente através de links do **Lightshot**.

Se o usuário não possuir a ferramenta, incluímos um link de download direto no formulário: [Baixar Lightshot](https://app.prntscr.com/build/setup-lightshot.exe).

As denúncias que não utilizarem links válidos do `prnt.sc` devem ser rejeitadas pelo administrador.

### Formulário de Denúncia

Qualquer visitante pode enviar uma denúncia clicando no botão **"Enviar Denúncia"** na seção "Casos Recentes".

O formulário exige o preenchimento dos seguintes campos:
*   Nome do Jogador infrator.
*   UUID (Opcional, mas recomendado para precisão).
*   Discord do denunciante (para possível contato).
*   Nome do Servidor onde a infração ocorreu.
*   Motivo detalhado da denúncia.
*   **Link da Prova (Obrigatório):** Deve ser um link válido do Lightshot (`https://prnt.sc/...`).

Ao enviar o formulário, a denúncia entra automaticamente no status **"Em análise"** e fica oculta do público até que o administrador `wonerGard` a aprove.

---

## Como Hospedar o Projeto

Como o projeto é composto apenas por arquivos estáticos, a hospedagem é extremamente simples e gratuita na maioria das plataformas.

### Hospedagem via Netlify (Recomendado)

1. Crie uma conta gratuita no [Netlify](https://www.netlify.com/).
2. No painel principal (Sites), clique em **"Add new site"** e selecione **"Deploy manually"**.
3. Arraste a pasta descompactada do projeto (contendo o `index.html`, `style.css`, `app.js` e `data.json`) para a área indicada.
4. O Netlify fará o upload e gerará um link público (ex: `https://seu-site.netlify.app`) em poucos segundos.

### Hospedagem via GitHub Pages

1. Crie um repositório no GitHub e faça o upload dos quatro arquivos.
2. Vá na aba **"Settings"** do repositório.
3. No menu lateral esquerdo, clique em **"Pages"**.
4. Na seção "Build and deployment", em "Source", selecione a branch `main` (ou `master`) e clique em **Save**.
5. Em alguns minutos, seu site estará online no endereço fornecido pelo GitHub.

---

## Expansões Futuras

O código foi escrito de forma limpa e comentada para facilitar futuras atualizações. Algumas sugestões de melhorias para quando o projeto crescer:

1.  **Integração com Banco de Dados:** Substituir o `localStorage` por chamadas `fetch()` para uma API real (Node.js, Python) conectada a um banco de dados (MySQL, MongoDB) para que as denúncias sejam globais e persistentes.
2.  **Sistema de Login Real:** Implementar autenticação via JWT (JSON Web Tokens) ou OAuth (Discord Login) para maior segurança do painel de administrador.
3.  **Upload de Imagens:** Permitir que os usuários façam upload das provas diretamente no site, em vez de colar links externos.
4.  **Paginação:** Adicionar um sistema de páginas na lista de denúncias caso o número de registros se torne muito grande.
