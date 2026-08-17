import type { SceneEffect, SceneToken } from '@raidru/shared-types';

export type PaletteCategory = 'roles' | 'classes' | 'markers' | 'encounter' | 'shapes';
export type PaletteItem =
  | { id: string; category: PaletteCategory; kind: 'token'; label: string; asset?: string; token: Omit<SceneToken, 'id' | 'x' | 'y'> }
  | { id: string; category: PaletteCategory; kind: 'effect'; label: string; effect: Omit<SceneEffect, 'id' | 'x' | 'y'> };

const roleItems: PaletteItem[] = [
  ['tank', 'Танк'], ['healer', 'Хилер'], ['melee', 'Мили'], ['ranged', 'РДД']
].map(([key, label]) => ({ id: `role-${key}`, category: 'roles', kind: 'token', label, asset: `./assets/palette/roles/${key}.png`, token: { label, type: key, meta: { kind: 'role', asset: `./assets/palette/roles/${key}.png`, role: key === 'tank' || key === 'healer' ? key : 'dps', range: key === 'melee' ? 'melee' : 'ranged' } } })) as PaletteItem[];

const classes: Array<[string, string]> = [
  ['warrior','Воин'],['paladin','Паладин'],['hunter','Охотник'],['rogue','Разбойник'],['priest','Жрец'],['deathknight','Рыцарь смерти'],['shaman','Шаман'],['mage','Маг'],['warlock','Чернокнижник'],['monk','Монах'],['druid','Друид'],['demonhunter','Охотник на демонов'],['evoker','Пробудитель']
];
const classItems: PaletteItem[] = classes.map(([key,label]) => ({ id:`class-${key}`, category:'classes', kind:'token', label, asset:`./assets/palette/classes/${key}.png`, token:{ label, type:'class', meta:{ kind:'class', classKey:key, asset:`./assets/palette/classes/${key}.png` } } }));

const markers: Array<[string,string]> = [['star','Звезда'],['circle','Круг'],['diamond','Ромб'],['triangle','Треугольник'],['moon','Луна'],['square','Квадрат'],['cross','Крест'],['skull','Череп']];
const markerItems: PaletteItem[] = markers.map(([key,label]) => ({ id:`marker-${key}`, category:'markers', kind:'token', label, asset:`./assets/palette/markers/${key}.png`, token:{ label, type:'marker', meta:{ kind:'marker', asset:`./assets/palette/markers/${key}.png` } } }));

const mechanics: Array<[string,string]> = [['soak','Сок'],['debuff','Дебафф'],['burst','Бёрст'],['add','Адд'],['wave','Волна'],['venom','Яд'],['shadow','Тьма'],['blood','Кровь'],['shield','Щит'],['well','Лужа'],['flame','Огонь'],['wind','Ветер']];
const mechanicItems: PaletteItem[] = mechanics.map(([key,label]) => ({ id:`mechanic-${key}`, category:'encounter', kind:'token', label, asset:`./assets/palette/encounter/mechanics/${key}.png`, token:{ label, type:'mechanic', meta:{ kind:'mechanic', asset:`./assets/palette/encounter/mechanics/${key}.png` } } }));

const shapeItems: PaletteItem[] = [
  { id:'effect-danger-zone', category:'shapes', kind:'effect', label:'Опасная зона', effect:{ type:'danger', w:22, h:22, rot:0, label:'Опасная зона' } },
  { id:'effect-soak-zone', category:'shapes', kind:'effect', label:'Зона сбора', effect:{ type:'soak', w:18, h:18, rot:0, label:'Сок' } },
  { id:'effect-line', category:'shapes', kind:'effect', label:'Линия', effect:{ type:'line', w:28, h:4, rot:0, label:'Линия' } },
  { id:'effect-arrow', category:'shapes', kind:'effect', label:'Стрелка', effect:{ type:'arrow', w:30, h:4, rot:0, label:'Стрелка' } }
];

export const paletteItems: PaletteItem[] = [...roleItems, ...classItems, ...markerItems, ...mechanicItems, ...shapeItems];

export const paletteCategories: Array<{ id: PaletteCategory; label: string }> = [
  { id:'roles', label:'Роли' },
  { id:'classes', label:'Классы' },
  { id:'markers', label:'Метки' },
  { id:'encounter', label:'Механики' },
  { id:'shapes', label:'Зоны' }
];
