import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Search,
  ShieldCheck,
  Trophy,
  Store,
  Images,
  ListChecks,
  Rocket,
  TrendingUp,
  Sparkles,
  Bot,
  Plus,
  Pencil,
  BookOpen,
  Save,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { api } from './ui.jsx';
import { Avatar, Chip, Sheet } from './kit.jsx';
import { displayStations, PIPELINE_STEP_SKILLS } from './displayLine.mjs';
import { skillTitle, skillLine } from './skillShelf.mjs';

/** The saved Launch Checklists (GET /api/launch-checklists), provided once by App. */
export const ChecklistContext = createContext(null);
export const useChecklists = () => useContext(ChecklistContext);

export const DISPLAY_ICONS = { product: Search, verify: ShieldCheck, winners: Trophy, build: Store, creatives: Images, checklist: ListChecks, launch: Rocket, improve: TrendingUp };

const AGENT_LABELS = {
  manager: 'Manager',
  'deep-researcher': 'Deep Researcher',
  'buyer-researcher': 'Buyer Researcher',
  scout: 'Scout',
  checker: 'Checker',
  copywriter: 'Copywriter',
  'image-maker': 'Image Maker',
  'store-builder': 'Store Builder',
  'ad-manager': 'Ad Manager',
  'os-builder': 'OS Builder',
};

function PipelineSkillSheet({ skill, stepSpec, team, onClose, onEdit, onOpenAgent }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!skill?.name) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    api(`/api/team/skill?name=${encodeURIComponent(skill.name)}`)
      .then(res => {
        if (alive) setFull(res);
      })
      .catch(e => {
        if (alive) setError(e.message || 'Could not load SKILL.md');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [skill?.name]);

  const rawContent = String(full?.content || '');
  const body = rawContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const description = full?.description || skill?.description || '';
  const path = full?.path || skill?.path || `.claude/skills/${skill?.name}/SKILL.md`;
  const usedBy = useMemo(() => {
    const set = new Set([...(skill?.usedBy || []), ...(stepSpec?.agents || [])]);
    return [...set];
  }, [skill?.usedBy, stepSpec?.agents]);

  return (
    <Sheet
      wide
      title={`Step Skill · ${skillTitle(skill.name)}`}
      subtitle={`${path}${stepSpec?.label ? ` · Enforced in ${stepSpec.label}` : ''}`}
      onClose={onClose}
      actions={
        onEdit ? (
          <button type="button" className="mv-btn sm primary" onClick={() => onEdit({ ...skill, description, path, content: rawContent, usedBy })}>
            <Pencil size={13} />Edit Skill
          </button>
        ) : undefined
      }
    >
      <div className="mv-sa-skillsheet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {description && <p className="mv-sa-lead" style={{ margin: 0 }}>{description}</p>}
        {stepSpec?.rule && (
          <div className="mv-card" style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--accent)' }}>
            <div className="mv-small" style={{ fontWeight: 700, marginBottom: 3 }}>
              Enforced Hard Rule · {stepSpec.label}
            </div>
            <div className="mv-small">{stepSpec.rule}</div>
          </div>
        )}
        <div className="mv-sa-carried" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <small style={{ fontWeight: 600 }}>Enforced for subagents:</small>
          {usedBy.map(id => {
            const agent = (team?.agents || []).find(a => a.id === id);
            return id === 'manager' ? (
              <span key={id} className="mv-sa-person">
                <Avatar role="manager" size={20} />Manager
              </span>
            ) : (
              <button
                type="button"
                key={id}
                className="mv-sa-person"
                onClick={() => {
                  onClose();
                  onOpenAgent?.(id);
                }}
              >
                <Avatar role={agent?.role || 'validation'} size={20} />
                {agent?.name || AGENT_LABELS[id] || id}
              </button>
            );
          })}
        </div>
        <code className="mv-sa-path">{path}</code>
        {error && <div className="mv-error" role="alert">{error}</div>}
        <div className="mv-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <strong style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileCode2 size={15} />Full SKILL.md Instructions (Read Before Working)
            </strong>
            <Chip tone="ok">Active Step Skill</Chip>
          </div>
          {loading ? (
            <p className="mv-small">Loading SKILL.md instructions…</p>
          ) : body ? (
            <div className="mv-doc">
              <Markdown>{body}</Markdown>
            </div>
          ) : (
            <p className="mv-small">This skill has no instructions yet. Click Edit Skill to write them.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function PipelineSkillBuilderSheet({ initialSkill, stepSpec, team, onClose, onSaved }) {
  const isEdit = Boolean(initialSkill?.name);
  const [name, setName] = useState(initialSkill?.name || '');
  const [description, setDescription] = useState(initialSkill?.description || '');
  const [content, setContent] = useState(initialSkill?.content || '');
  const [assigned, setAssigned] = useState(() => new Set(initialSkill?.usedBy?.length ? initialSkill.usedBy : stepSpec?.agents || []));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!initialSkill?.name || initialSkill?.content) return undefined;
    let alive = true;
    setLoading(true);
    api(`/api/team/skill?name=${encodeURIComponent(initialSkill.name)}`)
      .then(res => {
        if (alive) {
          setContent(res.content || '');
          if (res.description) setDescription(res.description);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initialSkill?.name, initialSkill?.content]);

  const toggleAgent = agentId => {
    setAssigned(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  async function handleSave(e) {
    e.preventDefault();
    setErr('');
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!cleanName) {
      setErr('Provide a skill name.');
      return;
    }
    setSaving(true);
    try {
      const res = await api('/api/team/skill', {
        name: cleanName,
        description: description.trim() || `Enforced skill for ${stepSpec?.label || 'Launchroom pipeline'}.`,
        content,
        assignedAgents: [...assigned],
      });
      onSaved?.(res, cleanName);
      onClose();
    } catch (error) {
      setErr(error.message || 'Could not save skill.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      wide
      title={isEdit ? `Edit Step Skill · ${skillTitle(initialSkill.name)}` : `Build / Attach Skill · ${stepSpec?.label || 'Pipeline Step'}`}
      subtitle={isEdit ? initialSkill.path || `.claude/skills/${initialSkill.name}/SKILL.md` : 'Writes .claude/skills/<name>/SKILL.md and binds it to this step’s subagents'}
      onClose={onClose}
    >
      <form className="mv-stack" onSubmit={handleSave} style={{ gap: 14 }}>
        {err && <div className="mv-error" role="alert">{err}</div>}
        {!isEdit && (team?.skills || []).length > 0 && (
          <div className="mv-card" style={{ padding: '10px 12px' }}>
            <span className="mv-small" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Or load an existing skill to edit / attach to {stepSpec?.label || 'this step'}:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(team?.skills || []).filter(s => s.scope !== 'personal').map(s => (
                <button
                  type="button"
                  key={s.name}
                  className={`mv-btn sm ${name === s.name ? 'primary' : 'ghost'}`}
                  onClick={() => {
                    setName(s.name);
                    setDescription(s.description || '');
                    setAssigned(new Set([...(s.usedBy || []), ...(stepSpec?.agents || [])]));
                    api(`/api/team/skill?name=${encodeURIComponent(s.name)}`)
                      .then(res => setContent(res.content || ''))
                      .catch(() => {});
                  }}
                >
                  <Sparkles size={12} />{skillTitle(s.name)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mv-grid-2" style={{ gap: 12 }}>
          <label className="mv-field">
            <span>Skill Name (lowercase-hyphenated)</span>
            <input
              className="mv-input"
              value={name}
              disabled={isEdit}
              onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
              placeholder="e.g. kalodata-viral-video-reverse-engineering"
              required
            />
          </label>
          <label className="mv-field">
            <span>Description (when agents must run this method)</span>
            <input
              className="mv-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Exact rules and gates for this pipeline step..."
              required
            />
          </label>
        </div>
        <div>
          <span className="mv-small" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Enforce on Subagents ({assigned.size} selected — pre-checked for {stepSpec?.label || 'this step'})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className={`mv-btn sm ${assigned.has('manager') ? 'primary' : 'ghost'}`} onClick={() => toggleAgent('manager')}>
              Manager
            </button>
            {(team?.agents || []).map(a => (
              <button type="button" key={a.id} className={`mv-btn sm ${assigned.has(a.id) ? 'primary' : 'ghost'}`} onClick={() => toggleAgent(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <label className="mv-field">
          <span>SKILL.md Instructions {loading && '(Loading...)'}</span>
          <textarea
            className="mv-input"
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, lineHeight: 1.5 }}
            rows={16}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write the step skill method and hard gates in Markdown..."
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="mv-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="mv-btn primary" disabled={saving}>
            <Save size={14} />{saving ? 'Saving...' : isEdit ? 'Save Skill' : 'Save & Attach Skill'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function PipelineAgentSheet({ agentId, stepSpec, team, lessons = [], onClose, onOpenSkill, onSaved }) {
  const agent = (team?.agents || []).find(a => a.id === agentId) || {
    id: agentId,
    name: AGENT_LABELS[agentId] || agentId,
    role: agentId === 'manager' ? 'manager' : 'validation',
    summary: team?.manager?.summary || 'Launchroom specialist subagent.',
    skills: team?.manager?.skills || [],
    guides: team?.manager?.guides || [],
    goodFor: [],
    delivers: '',
    never: [],
  };
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [summary, setSummary] = useState(agent.summary || '');
  const [selectedSkills, setSelectedSkills] = useState(() => new Set(agent.skills || []));

  useEffect(() => {
    if (!agentId || agentId === 'manager') return undefined;
    let alive = true;
    setLoading(true);
    api(`/api/team/agent-prompt?id=${encodeURIComponent(agentId)}`)
      .then(res => {
        if (alive) setPrompt(res.content || '');
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [agentId]);

  const agentLessons = useMemo(
    () => lessons.filter(l => (l.scope === agentId || l.scope === 'everyone') && ['proven', 'trying'].includes(l.status)),
    [lessons, agentId]
  );

  const toggleSkill = skillName => {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillName)) next.delete(skillName);
      else next.add(skillName);
      return next;
    });
  };

  async function handleSaveAgent(e) {
    e.preventDefault();
    if (agentId === 'manager') return;
    setSaving(true);
    setErr('');
    try {
      const res = await api('/api/team/agent', {
        id: agent.id,
        name: agent.name,
        role: agent.role || 'validation',
        summary: summary.trim() || agent.summary,
        goodFor: agent.goodFor || [],
        delivers: agent.delivers || 'Verified workspace outputs.',
        never: agent.never || [],
        skills: [...selectedSkills],
        guides: agent.guides || [],
        prompt,
      });
      onSaved?.(res);
      setEditing(false);
    } catch (error) {
      setErr(error.message || 'Could not save subagent.');
    } finally {
      setSaving(false);
    }
  }

  const promptBody = String(prompt || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

  return (
    <Sheet
      wide
      title={`${agent.name} · ${stepSpec?.label || 'Pipeline Subagent'}`}
      subtitle={agentId === 'manager' ? 'AGENTS.md · Main Orchestrator' : `.claude/agents/${agent.id}.md · Enforced on ${stepSpec?.label || 'this step'}`}
      onClose={onClose}
      actions={
        agentId !== 'manager' ? (
          <button type="button" className="mv-btn sm primary" onClick={() => setEditing(v => !v)}>
            <Pencil size={13} />{editing ? 'View Subagent' : 'Edit Subagent'}
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <form className="mv-stack" onSubmit={handleSaveAgent} style={{ gap: 14 }}>
          {err && <div className="mv-error" role="alert">{err}</div>}
          <label className="mv-field">
            <span>One-Line Summary</span>
            <input className="mv-input" value={summary} onChange={e => setSummary(e.target.value)} />
          </label>
          <div>
            <span className="mv-small" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Assigned Skills ({selectedSkills.size} selected)
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(team?.skills || []).filter(s => s.scope !== 'personal').map(s => (
                <button
                  type="button"
                  key={s.name}
                  className={`mv-btn sm ${selectedSkills.has(s.name) ? 'primary' : 'ghost'}`}
                  onClick={() => toggleSkill(s.name)}
                >
                  <Sparkles size={12} />{skillTitle(s.name)}
                </button>
              ))}
            </div>
          </div>
          <label className="mv-field">
            <span>Executable System Prompt (`.claude/agents/{agent.id}.md`)</span>
            <textarea
              className="mv-input"
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, lineHeight: 1.5 }}
              rows={15}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="mv-btn" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="mv-btn primary" disabled={saving}>
              <Save size={14} />{saving ? 'Saving...' : 'Save Subagent'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mv-stack" style={{ gap: 14 }}>
          <p className="mv-sa-lead" style={{ margin: 0 }}>{agent.summary}</p>
          <div>
            <span className="mv-small" style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
              Mandatory Skills Carried by {agent.name}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(agent.skills || []).map(skillName => {
                const found = (team?.skills || []).find(s => s.name === skillName) || { name: skillName, path: `.claude/skills/${skillName}/SKILL.md` };
                return (
                  <button
                    type="button"
                    key={skillName}
                    className="mv-btn sm"
                    onClick={() => {
                      onClose();
                      onOpenSkill?.(found);
                    }}
                  >
                    <Sparkles size={12} />{skillTitle(skillName)}
                  </button>
                );
              })}
              {!(agent.skills || []).length && <span className="mv-small">No skills assigned yet.</span>}
            </div>
          </div>
          {agentLessons.length > 0 && (
            <div className="mv-card" style={{ padding: '12px 14px' }}>
              <strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                Active Lessons Read Before Working ({agentLessons.length})
              </strong>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.55 }}>
                {agentLessons.slice(0, 8).map(l => (
                  <li key={l.id} style={{ marginBottom: 4 }}>
                    <b>{l.id}</b> ({l.status}): {l.rule} — <span className="mv-small">{l.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {agentId !== 'manager' && (
            <div className="mv-card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>.claude/agents/{agent.id}.md Instructions</strong>
                <code className="mv-small">.claude/agents/{agent.id}.md</code>
              </div>
              {loading ? (
                <p className="mv-small">Loading subagent instructions…</p>
              ) : promptBody ? (
                <div className="mv-doc">
                  <Markdown>{promptBody}</Markdown>
                </div>
              ) : (
                <p className="mv-small">No custom prompt body found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function PipelineLessonsSheet({ stepSpec, lessons = [], onClose }) {
  const stepAgents = new Set(stepSpec?.agents || []);
  const relevant = lessons.filter(
    l => ['proven', 'trying'].includes(l.status) && (l.scope === 'everyone' || stepAgents.has(l.scope))
  );
  return (
    <Sheet
      wide
      title={`Step Lessons · ${stepSpec?.label || 'Pipeline Step'}`}
      subtitle={`Active proven & trying rules enforced on ${(stepSpec?.agents || []).join(', ')}`}
      onClose={onClose}
    >
      <div className="mv-stack" style={{ gap: 10 }}>
        {relevant.length === 0 ? (
          <p className="mv-small">No active lessons recorded for this step yet.</p>
        ) : (
          relevant.map(l => (
            <div key={l.id} className="mv-card" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <strong>{l.id} · {l.scope === 'everyone' ? 'All Agents' : AGENT_LABELS[l.scope] || l.scope}</strong>
                <Chip tone={l.status === 'proven' ? 'ok' : 'warn'}>{l.status}</Chip>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{l.rule}</div>
              <div className="mv-small">{l.why}</div>
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
}

/**
 * Interactive Step Skills & Subagents Bar rendered at the top of every Pipeline step
 * (Product, Verify, Winners, Store, Creatives, Checklist, Launch) and Manage (#/manage).
 */
export function PipelineSkillsBar({ stepId, go }) {
  const ctx = useChecklists() || {};
  const team = ctx.team || { agents: [], skills: [] };
  const refresh = ctx.refresh;
  const notify = ctx.notify;
  const stepSpec = PIPELINE_STEP_SKILLS[stepId];

  const [openSkill, setOpenSkill] = useState(null);
  const [editingSkill, setEditingSkill] = useState(null);
  const [openAgentId, setOpenAgentId] = useState(null);
  const [showLessons, setShowLessons] = useState(false);
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    let alive = true;
    api('/api/lessons')
      .then(res => {
        if (alive && Array.isArray(res?.lessons)) setLessons(res.lessons);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [stepId]);

  const stepAgents = stepSpec?.agents || [];
  const allSkills = team.skills || [];

  // Combine the canonical step skills + any custom project skills assigned to this step's subagents
  const stepSkills = useMemo(() => {
    if (!stepSpec) return [];
    const names = new Set(stepSpec.skills || []);
    return [...names].map(name => {
      const found = allSkills.find(s => s.name === name);
      return found || {
        name,
        path: `.claude/skills/${name}/SKILL.md`,
        description: stepSpec.rule,
        usedBy: stepSpec.agents,
      };
    });
  }, [stepSpec, allSkills]);

  const activeLessonCount = useMemo(() => {
    const set = new Set(stepAgents);
    return lessons.filter(l => ['proven', 'trying'].includes(l.status) && (l.scope === 'everyone' || set.has(l.scope))).length;
  }, [lessons, stepAgents]);

  if (!stepSpec) return null;

  return (
    <>
      <div
        className="mv-pipeline-skills-bar"
        role="region"
        aria-label={`Enforced Step Skills and Subagents for ${stepSpec.label}`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px 14px',
          padding: '8px 14px',
          marginBottom: 12,
          borderRadius: 10,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Left: Badge + Enforced Subagents */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span
            title={stepSpec.rule}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 6,
              background: 'var(--bg-subtle)',
              color: 'var(--accent)',
            }}
          >
            <CheckCircle2 size={12} />Enforced Step Skills &amp; Subagents
          </span>
          {stepAgents.map(agentId => {
            const member = (team.agents || []).find(a => a.id === agentId);
            const label = member?.name || AGENT_LABELS[agentId] || agentId;
            return (
              <button
                key={agentId}
                type="button"
                className="mv-btn sm ghost"
                onClick={() => setOpenAgentId(agentId)}
                title={`View or edit ${label} (.claude/agents/${agentId}.md)`}
                style={{ padding: '2px 8px', height: 26, fontSize: 12, fontWeight: 600 }}
              >
                <Bot size={12} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Center: Clickable Skill Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: 1 }}>
          {stepSkills.map(skill => (
            <button
              key={skill.name}
              type="button"
              className="mv-btn sm"
              onClick={() => setOpenSkill(skill)}
              title={`${skillTitle(skill.name)} (${skill.path}): ${skillLine(skill.description, 140)}`}
              style={{
                padding: '3px 9px',
                height: 26,
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Sparkles size={12} />
              <span>⚡ {skillTitle(skill.name)}</span>
            </button>
          ))}
        </div>

        {/* Right: Build / Attach Skill + Step Lessons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="mv-btn sm ghost"
            onClick={() => setShowLessons(true)}
            title="View active lessons enforced on this step's subagents"
            style={{ height: 26, padding: '2px 8px', fontSize: 12 }}
          >
            <BookOpen size={12} />
            Step Lessons ({activeLessonCount})
          </button>
          <button
            type="button"
            className="mv-btn sm primary"
            onClick={() => setEditingSkill({ usedBy: stepAgents })}
            title={`Create or attach a skill to ${stepSpec.label}`}
            style={{ height: 26, padding: '2px 9px', fontSize: 12 }}
          >
            <Plus size={12} />
            Build / Attach Skill
          </button>
        </div>
      </div>

      {openSkill && (
        <PipelineSkillSheet
          skill={openSkill}
          stepSpec={stepSpec}
          team={team}
          onClose={() => setOpenSkill(null)}
          onEdit={sk => {
            setOpenSkill(null);
            setEditingSkill(sk);
          }}
          onOpenAgent={id => setOpenAgentId(id)}
        />
      )}

      {editingSkill && (
        <PipelineSkillBuilderSheet
          initialSkill={editingSkill.name ? editingSkill : null}
          stepSpec={stepSpec}
          team={team}
          onClose={() => setEditingSkill(null)}
          onSaved={(_res, savedName) => {
            notify?.(`Saved skill ${savedName} for ${stepSpec.label}.`);
            refresh?.();
          }}
        />
      )}

      {openAgentId && (
        <PipelineAgentSheet
          agentId={openAgentId}
          stepSpec={stepSpec}
          team={team}
          lessons={lessons}
          onClose={() => setOpenAgentId(null)}
          onOpenSkill={sk => setOpenSkill(sk)}
          onSaved={() => {
            notify?.(`Updated subagent ${openAgentId}.`);
            refresh?.();
          }}
        />
      )}

      {showLessons && (
        <PipelineLessonsSheet
          stepSpec={stepSpec}
          lessons={lessons}
          onClose={() => setShowLessons(false)}
        />
      )}
    </>
  );
}

/** The seven pipeline steps as tabs at the top of each step page, plus the enforced Step Skills & Subagents bar. */
export function LineTabs({ active, pipeline, go, hideSkillsBar = false }) {
  const checklists = useChecklists();
  const stations = displayStations(pipeline, checklists);
  return (
    <>
      <nav className="mv-stage-tabs" aria-label="The six steps">
        {stations.map(station => {
          const here = station.count + station.ready;
          return (
            <button key={station.id} className={`mv-stage-tab ${station.owner ? 'is-current' : ''}`} aria-current={station.id === active ? 'page' : undefined} onClick={() => go(station.target)} title={`${station.short}: ${station.label}`}>
              <i>{station.number}</i>{station.short}{here > 0 && <b className="mv-pl-tab-count">{here}</b>}
            </button>
          );
        })}
      </nav>
      {!hideSkillsBar && active && <PipelineSkillsBar stepId={active} go={go} />}
    </>
  );
}
