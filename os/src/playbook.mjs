import {headingAnchor} from './documentPaths.mjs';

export const PLAYBOOK_PATH = 'workflow/PLAYBOOK.md';
export const PLAYBOOK_STEPS = [
  '1. Find the exact product',
  '2. Validate demand and the market',
  '3. Verify sourcing and economics',
  '4. Prepare creative',
  '5. Build and verify Shopify',
  '6. Test, fulfill and improve',
];
export const playbookStep = index => `${PLAYBOOK_PATH}#${headingAnchor(PLAYBOOK_STEPS[index])}`;
export const stepReferences = sourceDoc => [...new Set([PLAYBOOK_PATH,sourceDoc].filter(Boolean))];
export const prioritizePlaybook = docs => [...docs].sort((a,b)=>Number(b.path===PLAYBOOK_PATH)-Number(a.path===PLAYBOOK_PATH));

// Read the procedure from the same Markdown agents use. The UI owns navigation,
// never a second copy of the business instructions or completion state.
export function parsePlaybook(content='') {
  const sections=[];
  let section, action, fence;
  for (const line of content.split(/\r?\n/)) {
    const marker=line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence=marker[1];
      else if (marker[1][0]===fence[0] && marker[1].length>=fence.length) fence=null;
    }
    const stage=!fence && line.match(/^## (\d+)\. (.+)$/);
    const step=!fence && line.match(/^### (\d+\.\d+) (.+)$/);
    if (stage) {
      section={number:Number(stage[1]),title:stage[2],path:`${PLAYBOOK_PATH}#${headingAnchor(line.slice(3))}`,intro:'',actions:[]};
      sections.push(section);action=null;
    } else if (!fence && /^## /.test(line)) { section=null;action=null; }
    else if (section && step && step[1].startsWith(section.number+'.')) {
      action={id:step[1],title:step[2],path:`${PLAYBOOK_PATH}#${headingAnchor(line.slice(4))}`,content:''};
      section.actions.push(action);
    } else if (section) {
      if (action) action.content+=line+'\n'; else section.intro+=line+'\n';
    }
  }
  return sections;
}
