// One entry per hosted tool. Adding a tool to the MCP host means adding a line
// here — the page has no other source of truth about what exists.
export const TOOLS = [
  {
    name: 'treegen',
    access: 'public',
    route: 'treegen',
    blurb:
      'Stylized low-poly trees. Deterministic — the same seed always gives the same tree — with triangle budgets from 1k to 7k. Exports GLB, OBJ, or the raw preset.',
    tools: ['generate_tree', 'random_tree', 'list_presets'],
    repo: 'https://github.com/andreglegg/treegen',
  },
  {
    name: 'assetcut',
    access: 'private',
    route: 'assetcut',
    blurb:
      'Cuts backgrounds off game sprites and exports real transparent PNGs, with slicing and atlas support. Private: it takes arbitrary image uploads, so it stays behind an auth gate rather than running strangers’ files on my hardware.',
    tools: ['pending'],
    repo: 'https://github.com/andreglegg/assetcut',
  },
];

export function renderCatalog(mount) {
  mount.replaceChildren(
    ...TOOLS.map((tool) => {
      const card = document.createElement('article');
      card.className = 'card';

      const head = document.createElement('div');
      head.className = 'card__head';

      const name = document.createElement('h3');
      name.className = 'card__name';
      name.textContent = tool.name;

      const tag = document.createElement('span');
      tag.className = 'card__tag';
      tag.dataset.tag = tool.access;
      tag.textContent = tool.access;

      head.append(name, tag);

      const blurb = document.createElement('p');
      blurb.textContent = tool.blurb;

      const tools = document.createElement('ul');
      tools.className = 'card__tools';
      for (const t of tool.tools) {
        const li = document.createElement('li');
        li.textContent = t;
        tools.append(li);
      }

      const link = document.createElement('p');
      const anchor = document.createElement('a');
      anchor.href = tool.repo;
      anchor.textContent = 'Source';
      link.append(anchor);

      card.append(head, blurb, tools, link);
      return card;
    })
  );
}
