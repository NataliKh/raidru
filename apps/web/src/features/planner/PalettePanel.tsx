import { useMemo, useState, type DragEvent } from 'react';
import { paletteCategories, paletteItems, type PaletteCategory } from './palette';
import { publicAsset } from '../../shared/publicAsset';

export function PalettePanel({ onAdd }: { onAdd: (itemId: string) => void }) {
  const [category, setCategory] = useState<PaletteCategory>('roles');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => paletteItems.filter(item => item.category === category && (!query || item.label.toLowerCase().includes(query.toLowerCase()))), [category, query]);
  function startDrag(event: DragEvent<HTMLButtonElement>, itemId: string) {
    event.dataTransfer.setData('application/x-raidru-palette', itemId);
    event.dataTransfer.effectAllowed = 'copy';
  }
  return <section className="plannerPanel palettePanel">
    <header><div><small>ПАЛИТРА</small><strong>Объекты</strong></div><span>{visible.length}</span></header>
    <div className="paletteTabs">{paletteCategories.map(item => <button key={item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>
    <input className="paletteSearch" value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти объект..." />
    <div className="paletteGrid">{visible.map(item => <button key={item.id} draggable onDragStart={event => startDrag(event, item.id)} onClick={() => onAdd(item.id)} title="Перетащи на карту или нажми, чтобы добавить в центр">
      {'asset' in item && item.asset ? <img src={publicAsset(item.asset)} alt="" /> : <span className={`shapePreview ${item.kind === 'effect' ? item.effect.type : ''}`}>{item.kind === 'effect' && item.effect.type === 'arrow' ? '➜' : '◉'}</span>}
      <small>{item.label}</small>
    </button>)}</div>
  </section>;
}
