import { useState, type ChangeEvent } from 'react';
import type { RosterMember } from '@raidru/shared-types';
import { appStore, useAppState } from '../app/store';

function parseRoster(text: string): RosterMember[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [nameRaw, classRaw = '', roleRaw = 'дд'] = line.split(/\s+-\s+/);
    const roleText = roleRaw.toLowerCase();
    const role = /танк|tank/.test(roleText) ? 'tank' : /хил|heal/.test(roleText) ? 'healer' : 'dps';
    return { id: crypto.randomUUID(), name: nameRaw || `Игрок ${index + 1}`, classKey: classRaw.toLowerCase().replace(/\s+/g,''), role, range: role === 'tank' ? 'melee' : 'ranged' };
  });
}

export function RosterPage() {
  const state = useAppState();
  const [text, setText] = useState('');
  return <section className="page rosterPage"><div className="rosterImport"><div><small>СОСТАВ</small><h2>Единый ростер рейда</h2><p>Формат: <code>Имя - Priest - хил</code>. В следующих alpha он будет напрямую связан с Planner и Replay.</p></div><textarea value={text} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value)} placeholder={'TankOne - Paladin - танк\nPriestka - Priest - хил\nHunterOne - Hunter - дд'} /><button onClick={() => { appStore.replaceRoster(parseRoster(text)); setText(''); }}>Разобрать список</button></div><div className="rosterList">{state.roster.length ? state.roster.map(member => <article key={member.id}><div className={`roleIcon ${member.role}`}>{member.role === 'tank' ? 'T' : member.role === 'healer' ? 'H' : 'D'}</div><div><strong>{member.name}</strong><small>{member.classKey || 'класс не указан'} · {member.role === 'tank' ? 'танк' : member.role === 'healer' ? 'хил' : member.range === 'melee' ? 'мили ДД' : 'рэнж ДД'}</small></div><button onClick={() => appStore.removeRoster(member.id)}>×</button></article>) : <div className="emptyState">Состав пока пуст.</div>}</div></section>;
}
