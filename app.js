const raid = [
{ id:'nekzali',order:1,name:"Нек'зали, Заклинательница душ",en:"Nek'zali the Soulcoiler",summary:'Контроль аддов и центрального Колодца душ. Каждая ошибка повышает энергию босса и усиливает последующий рейдовый урон.',tags:['Адды','Позиционирование','Диспел','Рейдовый урон'],bl:'После перехода, в начале финальной фазы.',rl:'Адды важнее босса. Разрыв сущности — на край, затем диспел. На 50% все в Эхо. Голодный костёр — весь рейд в soak. После перехода BL.',heal:'Молитву восстановления держать заранее. Большой рейдовый КД — на Воспламенение Колодца или Голодный костёр. В финале не экономить Спасение/Апофеоз.',phases:[
['Фаза 1','Не кормим Колодец душ',[['Колодец душ','Soulcoil Well','Ни один адд не должен добраться до центра. Смерть игрока внутри также считается жертвой.','all','danger','Каждый прок усиливает следующий урон от Обряда Колодца душ.'],['Разрыв сущности','Essence Rend','Вынести на край. Хилам не снимать эффект, пока игрок не занял безопасную позицию.','healer,dps','warning'],['Восставшие амани','Raised Amani','Мгновенный свитч. Замедления, станы и отбрасывания приветствуются.','dps','danger'],['Обстрел одержимости','Possession Barrage','Танк направляет механику вдоль максимально длинной части комнаты.','tank','danger'],['Воспламенение Колодца','Soulcoil Ignition','Серия волн урона по рейду одновременно с движением. Заранее назначить хил-КД.','healer,all','danger']]],
['Переход — 50%','Уничтожить Эхо',[['Эхо Джавэ','Echo of Jawae','Все ДД переключаются в Эхо, чтобы вернуть босса в бой.','all','danger'],['Голодный костёр','Hungering Pyre','Общий групповой soak: весь рейд собирается вместе.','all','danger']]],
['Финальная фаза','Героизм и дожим',[['Раскручивание','Uncoiling','Постоянный растущий урон по рейду. Используем оставшиеся защитные и хилерские КД.','all,healer','danger']]]],timeline:[['0:00','Пулл','burst'],['0:25','Адды','adds'],['0:40','Разрыв сущности','move'],['1:05','Воспламенение Колодца','raid'],['~50%','Переход','adds'],['P2','Героизм','burst']],spells:[['Колодец душ','Soulcoil Well'],['Обряд Колодца душ','Soulcoil Rite'],['Ритуальный ожог','Ritual Burn'],['Разрыв сущности','Essence Rend'],['Обстрел одержимости','Possession Barrage'],['Голодный костёр','Hungering Pyre']]},
{ id:'sentinels',order:2,name:'Погребённые часовые',en:'Entombed Sentinels',summary:'Два босса, две команды и синхронное управление здоровьем. Ключ — не сближать боссов.',tags:['2 группы','Стаки','Адды'],bl:'Чаще на старте или в поздний цикл.',rl:'Две группы. Боссов держать далеко. Слизень — свитч. Токсины решаем заранее назначенными мини-группами.',heal:'По одному хилу на сторону. Не снимать все дебаффы одновременно. Сохранять массовый КД на ошибки со Спиральными токсинами.',phases:[['Основная фаза','',[['Разделение рейда','Split Teams','Рейд делится на две стабильные группы, по танку и хилу в каждой.','all','warning'],['Власть Ула’тек',"Ula'tek's Dominance",'Не сближать боссов: рядом они резко уменьшают входящий урон.','tank','danger'],['Сгущение яда','Venom Coagulation','Слизень — абсолютный приоритет ДД.','dps','danger'],['Спиральные токсины','Helical Toxins','Свести игроков так, чтобы получить правильное суммарное число стаков и очиститься.','all','danger']]],['Интермиссия — 100 энергии','',[['Ядовитый стазис','Vitriolic Stasis','Держим здоровье целей близким.','all','warning']]]],timeline:[['0:00','Разделиться','move'],['0:35','Слизень','adds'],['1:10','Спиральные токсины','raid'],['100 энергии','Интермиссия','raid']],spells:[['Власть Ула’тек',"Ula'tek's Dominance"],['Сгущение яда','Venom Coagulation'],['Спиральные токсины','Helical Toxins'],['Ядовитый стазис','Vitriolic Stasis']]},
{ id:'explorers',order:4,name:'Потерянные исследователи',en:'The Lost Explorers',summary:'Совет из трёх целей. Ровняем здоровье, выполняем персональные механики и правильно используем рыбу.',tags:['Совет','Клив','Soak'],bl:'На старте или под финальное выравнивание целей.',rl:'Держим трёх примерно ровно. Soak — вместе. Рыбы назначить до пула: A → B → C.',heal:'Поднимать рейд перед групповым ударом. Не тратить крупные КД на одиночные просадки.',phases:[['Весь бой','',[['Равное здоровье','Even Health','Не перекашивать HP трёх целей — контролируем клив.','dps','warning'],['Последнее вознесение','Final Ascension','Останавливается назначенной Отвратительной рыбой. Порядок носителей назначает РЛ.','all','danger'],['Могучий удар','Mighty Thud','Групповой soak — собираемся.','all','danger'],['Огненно-ледяные эффекты','Frostfire','Не разносить хаотично: использовать взаимодействие огня и льда.','all','warning']]]],timeline:[['0:00','Пулл и клив','burst'],['0:45','Могучий удар','raid'],['Вознесение','Назначенная рыба','move']],spells:[['Последнее вознесение','Final Ascension'],['Отвратительная рыба','Disgusting Fish'],['Могучий удар','Mighty Thud']]},
{ id:'vashnik',order:3,name:'Вашник Злокачественный',en:'Vashnik the Malignant',summary:'Позиционирование босса относительно трёх источников определяет следующие механики.',tags:['Маршрут босса','Адды','Поглощение лечения'],bl:'На наиболее опасный поздний цикл или под нужную комбинацию источников.',rl:'Танк ведёт босса по заранее выбранному маршруту. Адды всегда выше босса. Хилы не тратят все КД в первом цикле.',heal:'КД распределять вокруг Поглощения + Сифонной инфекции. Поздние циклы тяжелее ранних.',phases:[['Циклы источников','',[['Поглощение','Imbibe','Босс получает силу двух ближайших источников. Маршрут задаёт танк.','tank','danger'],['Живые яды','Living Venoms','Убить до попадания в центральную полость.','dps','danger'],['Сифонная инфекция','Siphoning Infection','Сильный эффект поглощения лечения — заранее готовим хил.','healer','danger'],['Токсичные испарения','Toxic Vapor','Фоновый рейдовый урон растёт по ходу боя.','healer,all','warning']]]],timeline:[['Цикл 1','2 источника','move'],['После Поглощения','Адды','adds'],['Поздние циклы','Сильнее хилить','raid']],spells:[['Поглощение','Imbibe'],['Живые яды','Living Venoms'],['Сифонная инфекция','Siphoning Infection'],['Токсичные испарения','Toxic Vapor']]},
{ id:'sszorak',order:5,name:'Сззорак',en:'Sszorak',summary:'Ветер, отбрасывания и контроль свободного пространства. Есть сильное окно урона по боссу.',tags:['Ветер','Отбрасывание','Бурст'],bl:'В окно «Зарыться».',rl:'Не отдаём центр под опасные зоны. Перед ветром смотрим направление. Большие ДПС-КД — в Зарыться.',heal:'Не начинать длинный канал перед ветром. Большой рейдовый КД — на сочетание ветра и фонового урона.',phases:[['Весь бой','',[['Ядовитый выброс','Venomous Surge','Оставляет опасные объекты; не захламляем центр.','all','warning'],['Воющий вихрь','Howling Maelstrom','Заранее занять позицию, чтобы ветер не унёс в край или опасную область.','all','danger'],['Высший хищник','Apex Predator','Серия тяжёлых ударов — танкам сейв, хилам внимание.','tank,healer','danger'],['Зарыться','Dig In','Окно повышенного входящего урона — сохраняем бурст и часто героизм.','dps','danger']]]],timeline:[['~2:00','Зарыться — бурст','burst'],['По циклу','Воющий вихрь','move']],spells:[['Ядовитый выброс','Venomous Surge'],['Воющий вихрь','Howling Maelstrom'],['Высший хищник','Apex Predator'],['Зарыться','Dig In']]},
{ id:'fangs',order:6,name:'Двойные Клыки',en:'The Twin Fangs',summary:'Управление стаками Вечного яда. Ошибки накапливаются и ограничивают дальнейшие действия игрока.',tags:['Стаки','Soak','Адды'],bl:'Обычно в поздний цикл с безопасным пространством.',rl:'Стаки яда должны быть видны на фреймах. Высокие стаки → в Трапезу. Адды и опасные капли — приоритет.',heal:'Стаки Вечного яда должны быть крупно видны на фреймах. Игроки с высокими стаками — приоритет до очистки.',phases:[['Весь бой','',[['Вечный яд','Eternal Venom','Следим за количеством стаков. Не допускаем приближения к смертельному порогу.','all','danger'],['Ненасытная трапеза','Ravenous Feast','Групповой soak и основной способ снять несколько стаков яда.','all','danger'],['Едкие капли','Caustic Globules','Назначенные игроки забирают объекты, чтобы они не взорвались по рейду.','dps,healer','danger'],['Отродья Вексхул','Spawn of Vexhul','Быстрый свитч в аддов.','dps','danger']]]],timeline:[['По циклу','Капли','move'],['По циклу','Трапеза — очистка','raid'],['100 энергии','Большая механика','raid']],spells:[['Вечный яд','Eternal Venom'],['Ненасытная трапеза','Ravenous Feast'],['Едкие капли','Caustic Globules'],['Отродья Вексхул','Spawn of Vexhul']]},
{ id:'altar',order:7,name:'Спиральный алтарь',en:'The Coiled Altar',summary:'Многофазный бой. Танковые удары используются для уничтожения объектов и аддов.',tags:['3 фазы','Танк-механика','Рейдовый урон'],bl:'Фаза 3.',rl:'Танк-механика — инструмент, а не просто сейв. Сгустки чистим постепенно. На P3 — заранее расписанные рейд-КД.',heal:'Не перекрывать хил-КД на одиночные взрывы сгустков. Самые крупные КД оставить на финальную фазу.',phases:[['Фаза 1 — Зул’джан','',[['Сгустки яда','Coalesced Venom','Не уничтожать все одновременно — смерть каждого даёт рейдовый урон.','all','danger'],['Рассечение','Sever','Танк направляет удар через нужные сгустки.','tank','danger']]],['Фаза 2 — Малакрасс','',[['Рассечение души','Soul Sever','Танковский удар используется для уничтожения проявлений ужаса.','tank','danger'],['Вечный сумрак','Eternal Nightfall','Быстро пробить защитный эффект — абсолютный приоритет ДД.','dps','danger']]],['Фаза 3 — оба','',[['Финальное наложение механик','Final Overlap','Используем заранее расписанные рейдовые КД и бережём безопасное пространство.','all','danger']]]],timeline:[['P1','Сгустки по одному','raid'],['P2','Ужасы','adds'],['P3','Финальные КД','raid']],spells:[['Сгустки яда','Coalesced Venom'],['Рассечение','Sever'],['Рассечение души','Soul Sever'],['Вечный сумрак','Eternal Nightfall']]},
{ id:'ulatek',order:8,name:'Ула’тек',en:"Ula'tek",summary:'Финальный босс: яйца, волны яда, адды и постепенно исчезающее безопасное пространство.',tags:['Финал','Яйца','Пространство','Интермиссия'],bl:'Фаза 3, чтобы сократить разрушение арены.',rl:'Яд не должен касаться лишних яиц. Общие кольца — весь рейд внутрь. На P3 экономить КД уже нельзя.',heal:'Следить за накопившимися DoT от ошибочно активированных яиц. Рейдовые КД — на Кольца и позднюю P3.',phases:[['Фазы 1–2','',[['Едкие волны','Caustic Waves','Уворачиваемся и не позволяем волнам задевать лишние яйца.','all','danger'],['Материнский гнев',"Mother's Wrath",'После отбрасывания танк немедленно возвращается в ближний бой.','tank','danger'],['Спектральные кольца','Spectral Coils','Большой общий soak — практически весь рейд внутрь.','all','danger'],['Ядовитое сердце','Venomous Heart','Короткое окно повышенного урона — заранее готовим бурст.','dps','warning']]],['Интермиссия','',[['Стражи Роковой чешуи','Doomscale Wardens','Высокий приоритет: не дать активировать лишние яйца.','dps','danger']]],['Фаза 3','',[['Разрушение','Demolish','Безопасная арена уменьшается — героизм и дожим босса.','all','danger']]]],timeline:[['P1','Волны и яйца','move'],['Интермиссия','Стражи','adds'],['P3','BL + дожим','burst']],spells:[['Едкие волны','Caustic Waves'],['Материнский гнев',"Mother's Wrath"],['Спектральные кольца','Spectral Coils'],['Ядовитое сердце','Venomous Heart'],['Разрушение','Demolish']]}
];
const priest=[['Божественный гимн','Divine Hymn'],['Слово Света: Спасение','Holy Word: Salvation'],['Апофеоз','Apotheosis'],['Оберегающий дух','Guardian Spirit'],['Молитва восстановления','Prayer of Mending'],['Слово Света: Освящение','Holy Word: Sanctify']];
const roles={all:'Всем',tank:'Танки',healer:'Хилы',dps:'ДД'};
function mkToken(id,label,type,x,y){return [id,label,type,x,y]}
function bossPresetScenes(id){
  const base={
    nekzali:[
      {name:'Старт — Колодец душ',note:'Босс ниже центра. РДД и хилы полукругом. Адды перехватываются до Колодца.',tokens:[mkToken('well','КОЛОДЕЦ','marker',50,50),mkToken('boss','БОСС','boss',50,72),mkToken('t1','T1','tank',50,82),mkToken('t2','T2','tank',42,77),mkToken('h1','H1','healer',32,36),mkToken('h2','H2','healer',50,30),mkToken('h3','H3','healer',68,36),mkToken('m1','M1','melee',46,66),mkToken('m2','M2','melee',54,66),mkToken('r1','R1','ranged',25,50),mkToken('r2','R2','ranged',75,50),mkToken('star','★','marker',50,12),mkToken('dia','◆','marker',84,50),mkToken('circle','●','marker',16,50)]},
      {name:'Разрыв сущности',note:'Цели с дебаффом уходят к внешним меткам. Диспел только после выхода.',tokens:[mkToken('well','КОЛОДЕЦ','marker',50,50),mkToken('boss','БОСС','boss',50,70),mkToken('d1','ДЕБАФФ','ranged',15,22),mkToken('d2','ДЕБАФФ','ranged',85,22),mkToken('d3','ДЕБАФФ','ranged',85,78),mkToken('raid','РЕЙД','healer',50,34)]},
      {name:'Переход 50%',note:'Все в Эхо. На Голодный костёр — полный сбор.',tokens:[mkToken('echo','ЭХО','boss',50,50),mkToken('raid1','РЕЙД','healer',44,58),mkToken('raid2','РЕЙД','melee',56,58),mkToken('t1','T1','tank',50,66)]},
      {name:'Финал',note:'Героизм. Оставшиеся защитные и хилерские КД — в ход.',tokens:[mkToken('boss','БОСС','boss',50,48),mkToken('t1','T1','tank',50,35),mkToken('raid','РЕЙД','healer',50,66)]}
    ],
    sentinels:[
      {name:'Две команды',note:'Боссы далеко друг от друга. По танку и хилу на каждой стороне.',tokens:[mkToken('b1','БОСС A','boss',25,50),mkToken('b2','БОСС B','boss',75,50),mkToken('t1','T1','tank',20,50),mkToken('t2','T2','tank',80,50),mkToken('h1','H1','healer',25,70),mkToken('h2','H2','healer',75,70),mkToken('g1','ГР1','ranged',25,30),mkToken('g2','ГР2','ranged',75,30)]},
      {name:'Спиральные токсины',note:'Мини-группы заранее назначены и сходятся только по команде.',tokens:[mkToken('g1','1','marker',35,40),mkToken('g2','2','marker',45,40),mkToken('g3','3','marker',55,40),mkToken('g4','4','marker',65,40),mkToken('raid','СБОР','healer',50,62)]}
    ],
    explorers:[{name:'Совет — старт',note:'Три цели держим вместе и ровняем здоровье.',tokens:[mkToken('b1','A','boss',40,46),mkToken('b2','B','boss',50,42),mkToken('b3','C','boss',60,46),mkToken('t1','T1','tank',50,32),mkToken('raid','РЕЙД','healer',50,68)]}],
    vashnik:[{name:'Три источника',note:'Танк ведёт босса по заранее выбранному маршруту между источниками.',tokens:[mkToken('fire','ОГОНЬ','marker',50,15),mkToken('blood','КРОВЬ','marker',18,78),mkToken('shadow','ТЬМА','marker',82,78),mkToken('boss','БОСС','boss',50,52),mkToken('t1','T1','tank',50,42),mkToken('raid','РЕЙД','healer',50,68)]}],
    sszorak:[{name:'Безопасный центр',note:'Опасные зоны складываем по краям. Перед ветром занимаем позицию против направления сдувания.',tokens:[mkToken('boss','БОСС','boss',50,48),mkToken('t1','T1','tank',50,36),mkToken('raid','РЕЙД','healer',50,67),mkToken('danger1','X','marker',12,22),mkToken('danger2','X','marker',88,78)]}],
    fangs:[{name:'Двойные Клыки',note:'Следим за стаками. Игроки с высокими стаками идут в Трапезу.',tokens:[mkToken('b1','ВЕКС','boss',38,48),mkToken('b2','ИТР','boss',62,48),mkToken('t1','T1','tank',32,38),mkToken('t2','T2','tank',68,38),mkToken('raid','РЕЙД','healer',50,68),mkToken('soak','SOAK','marker',50,24)]}],
    altar:[{name:'Фаза 1 — сгустки',note:'Танк направляет Рассечение через нужные сгустки. Не чистить всё одновременно.',tokens:[mkToken('boss','БОСС','boss',50,46),mkToken('t1','T1','tank',50,34),mkToken('v1','ЯД','marker',28,52),mkToken('v2','ЯД','marker',38,62),mkToken('v3','ЯД','marker',72,52),mkToken('raid','РЕЙД','healer',50,72)]},{name:'Фаза 3 — финал',note:'Рейдовые КД по заранее согласованной очереди.',tokens:[mkToken('boss','БОСС','boss',50,45),mkToken('t1','T1','tank',50,32),mkToken('raid','РЕЙД','healer',50,68)]}],
    ulatek:[{name:'Яйца и волны',note:'Яд не должен касаться яиц. Сохраняем безопасный сектор.',tokens:[mkToken('boss','УЛА’ТЕК','boss',50,48),mkToken('t1','T1','tank',50,34),mkToken('egg1','ЯЙЦО','marker',20,22),mkToken('egg2','ЯЙЦО','marker',80,22),mkToken('egg3','ЯЙЦО','marker',20,78),mkToken('egg4','ЯЙЦО','marker',80,78),mkToken('raid','РЕЙД','healer',50,68)]},{name:'Фаза 3 — дожим',note:'Героизм. Играем в оставшемся безопасном секторе.',tokens:[mkToken('boss','УЛА’ТЕК','boss',50,45),mkToken('t1','T1','tank',50,32),mkToken('raid','РЕЙД','healer',50,65),mkToken('safe','SAFE','marker',78,52)]}]
  };
  return JSON.parse(JSON.stringify(base[id]||[defaultScene()]));
}

const state=JSON.parse(localStorage.getItem('raidru-standalone')||'{}');
const RAIDRU_SCHEMA='0.5.2-real-maps';
// Сцены из 0.4/0.5 были рассчитаны на схематичные подложки.
// Один раз сбрасываем только геометрические сцены, сохраняя прогресс, заметки,
// избранное, состав и пользовательский таймлайн.
if(state._schema!==RAIDRU_SCHEMA){
  for(const b of raid){
    if(state[b.id]){
      state[b.id].scenes=bossPresetScenes(b.id);
    }
  }
  state._schema=RAIDRU_SCHEMA;
  localStorage.setItem('raidru-standalone',JSON.stringify(state));
}
function orderedRaid(){return [...raid].sort((a,b)=>a.order-b.order)}
let current=state.current||'nekzali', role=state.role||'all', diff=state.diff||'heroic', view=state.view||'dashboard', priestMode=state.priestMode!==false, sceneIndex=0;
let rehearsalTimer=null, playbackTimer=null, playerSceneIndex=0, playerPlaying=false, playerSpeed=1, showPaths=state.showPaths!==false;
let routeEdit=false, routeTokenId=null;
const el=s=>document.querySelector(s); const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const effectLabels={zone:'Опасная зона',soak:'Soak',arrow:'Стрелка',cone:'Конус',line:'Линия'};
const arenaMaps={
  nekzali:'./assets/maps/nekzali.webp',
  sentinels:'./assets/maps/sentinels.webp',
  vashnik:'./assets/maps/vashnik.webp',
  explorers:'./assets/maps/explorers.webp',
  sszorak:'./assets/maps/sszorak.webp',
  fangs:'./assets/maps/fangs.webp',
  altar:'./assets/maps/altar.webp',
  ulatek:'./assets/maps/ulatek.webp'
};
const eventTypes={raid:'Урон по рейду',tank:'Танковская механика',move:'Перемещение',adds:'Адды',burst:'Бурст / героизм',heal:'Хил-КД'};
function uid(){return (crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(16).slice(2)))}
function deep(v){return JSON.parse(JSON.stringify(v))}
function normalizeScene(sc,id,i){
  if(!sc.effects) sc.effects=seedEffects(id,i,sc.name);
  if(!sc.duration) sc.duration=8;
  if(!sc.routes) sc.routes={};
  if(!sc.map) sc.map={zoom:100,x:0,y:0,dark:8};
  sc.map.zoom=Math.max(100,Math.min(180,Number(sc.map.zoom)||100));
  sc.map.x=Math.max(-30,Math.min(30,Number(sc.map.x)||0));
  sc.map.y=Math.max(-30,Math.min(30,Number(sc.map.y)||0));
  sc.map.dark=Math.max(0,Math.min(65,Number(sc.map.dark)||0));
  return sc;
}
function seedEffects(id,i,name=''){
  const e=[];
  if(id==='nekzali'){
    if(i===0)e.push({id:uid(),type:'zone',x:50,y:50,w:19,h:19,rot:0,label:'Колодец душ'});
    if(i===1){e.push({id:uid(),type:'arrow',x:50,y:48,w:64,h:8,rot:0,label:'Вынести на край'});}
    if(i===2)e.push({id:uid(),type:'soak',x:50,y:54,w:28,h:28,rot:0,label:'ВСЕ В SOAK'});
    if(i===3)e.push({id:uid(),type:'zone',x:50,y:49,w:42,h:42,rot:0,label:'Постоянный урон'});
  } else if(id==='sentinels'){
    if(i===0)e.push({id:uid(),type:'line',x:50,y:50,w:54,h:4,rot:0,label:'Держать далеко'});
    else e.push({id:uid(),type:'soak',x:50,y:53,w:30,h:30,rot:0,label:'Свести группу'});
  } else if(id==='vashnik'){
    e.push({id:uid(),type:'line',x:50,y:46,w:55,h:4,rot:-90,label:'Маршрут босса'});
  } else if(id==='sszorak'){
    e.push({id:uid(),type:'arrow',x:52,y:48,w:60,h:8,rot:0,label:'Направление ветра'});
  } else if(id==='fangs'){
    e.push({id:uid(),type:'soak',x:50,y:27,w:26,h:26,rot:0,label:'Трапеза'});
  } else if(id==='altar'){
    if(i===0)e.push({id:uid(),type:'line',x:50,y:43,w:48,h:5,rot:15,label:'Рассечение через сгустки'});
    else e.push({id:uid(),type:'zone',x:50,y:52,w:48,h:48,rot:0,label:'Финальное наложение'});
  } else if(id==='ulatek'){
    if(i===0)e.push({id:uid(),type:'arrow',x:50,y:46,w:68,h:7,rot:18,label:'Едкая волна'});
    else e.push({id:uid(),type:'zone',x:28,y:52,w:48,h:70,rot:0,label:'Разрушенная зона'});
  }
  return e;
}
function defaultScene(){return normalizeScene({name:'Стартовая расстановка',note:'Базовая позиция перед пулом.',tokens:[['boss','БОСС','boss',50,42],['t1','T1','tank',50,30],['t2','T2','tank',43,34],['h1','H1','healer',38,66],['h2','H2','healer',50,71],['h3','H3','healer',62,66],['m1','M1','melee',44,48],['m2','M2','melee',56,48],['r1','R1','ranged',30,58],['r2','R2','ranged',70,58],['star','★','marker',50,18],['dia','◆','marker',78,43],['circle','●','marker',22,43]]},current,0)}
function defaultTimeline(id){
  const b=raid.find(x=>x.id===id), scenes=bossStateRaw(id).scenes;
  const src=b.timeline||[];
  return scenes.map((sc,i)=>{
    const x=src[Math.min(i,src.length-1)]||[''+i*30,sc.name,'move'];
    const parsed=parseTime(x[0]);
    return {id:uid(),time:Number.isFinite(parsed)?parsed:i*35,label:x[1]||sc.name,type:x[2]||'move',scene:i,note:sc.note||''};
  });
}
function bossStateRaw(id){
  if(!state[id]) state[id]={favorite:false,progress:0,note:'',scenes:bossPresetScenes(id)};
  if(!state[id].scenes?.length) state[id].scenes=bossPresetScenes(id);
  state[id].scenes=state[id].scenes.map((s,i)=>normalizeScene(s,id,i));
  return state[id];
}
function bossState(id){
  const s=bossStateRaw(id);
  if(!s.timelineV3?.length) s.timelineV3=defaultTimeline(id);
  if(!s.cooldowns) s.cooldowns=[];
  return s;
}
function parseTime(v){
  if(typeof v==='number')return v;
  const s=String(v||'').trim();
  if(/^\d+:\d+$/.test(s)){const [m,sec]=s.split(':').map(Number);return m*60+sec}
  if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);
  return NaN;
}
function fmtTime(sec){sec=Math.max(0,Math.round(Number(sec)||0));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
function rosterState(){if(!state.roster)state.roster=[];return state.roster}
function toast(msg){const t=el('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),1800)}
function safeB64Encode(obj){return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))}
function safeB64Decode(str){return JSON.parse(decodeURIComponent(escape(atob(str))))}
function buildShareUrl(){const payload={v:5,boss:current,diff,role,data:bossState(current)};return location.origin+location.pathname+'#share='+safeB64Encode(payload)}
function restoreFromHash(){try{if(!location.hash.startsWith('#share='))return;const p=safeB64Decode(location.hash.slice(7));if(p?.boss&&p?.data){state[p.boss]=p.data;current=p.boss;diff=p.diff||diff;role=p.role||role;toast('Стратегия загружена из ссылки')}}catch(e){console.warn(e)}}
function save(){state.current=current;state.role=role;state.diff=diff;state.view=view;state.priestMode=priestMode;state.showPaths=showPaths;localStorage.setItem('raidru-standalone',JSON.stringify(state))}
function render(){
  save();const b=raid.find(x=>x.id===current),bs=bossState(current);
  el('#app').innerHTML=`<div class="shell"><aside><div class="brand"><div class="mark">R</div><div><b>RaidRU</b><small>рейдовые тактики по-русски</small></div></div><div class="season"><small>Midnight · Сезон 2</small><b>Ядовитая бездна</b></div><input class="search" placeholder="Найти босса…" oninput="filterBoss(this.value)"><div class="bosses">${orderedRaid().map(x=>`<button data-name="${esc((x.name+' '+x.en).toLowerCase())}" class="${x.id===current?'on':''}" onclick="chooseBoss('${x.id}')"><i>${x.order}</i><span><b>${x.name}</b><small>${x.en}</small></span><em>${bossState(x.id).favorite?'★':''}</em></button>`).join('')}</div><div class="version">RaidRU 0.5.2 · реальные арены</div></aside><main><header>${[['dashboard','Рейд'],['guide','Тактика'],['player','Проигрыватель'],['planner','Редактор'],['timeline','Таймлайн'],['roster','Состав'],['notes','Заметки'],['glossary','Словарь']].map(x=>`<button class="${view===x[0]?'on':''}" onclick="setView('${x[0]}')">${x[1]}</button>`).join('')}<span></span><button class="priest ${priestMode?'on':''}" onclick="togglePriest()">♥ Холи-прист</button><button onclick="sharePlan()">↗ Поделиться</button><button onclick="exportPlan()">⇩ Экспорт</button><label class="importBtn">⇧ Импорт<input type="file" accept="application/json,.json" onchange="importPlanFile(this.files[0])"></label></header>${view==='dashboard'?dashboardHero():`<section class="hero"><div><small>MIDNIGHT / ЯДОВИТАЯ БЕЗДНА / БОСС ${b.order}</small><div class="title"><h1>${b.name}</h1><button onclick="fav()">${bs.favorite?'★':'☆'}</button></div><div class="en">${b.en}</div><p>${b.summary}</p></div><div class="heroRight"><div class="diff">${[['normal','Обычный'],['heroic','Героический'],['mythic','Эпохальный']].map(x=>`<button class="${diff===x[0]?'on':''}" onclick="setDiff('${x[0]}')">${x[1]}</button>`).join('')}</div><label>Освоение <b>${bs.progress}%</b><input type="range" min="0" max="100" step="10" value="${bs.progress}" oninput="setProgress(this.value)"></label></div></section>`}${content(b,bs)}<footer class="siteCredit">Maps/raid planning resources: <a href="https://raidplan.io/" target="_blank" rel="noopener noreferrer">RaidPlan.io</a></footer></main></div>`;
  if(view==='planner') setupPlanner();
  if(view==='player') setupPlayer();
}
function content(b,bs){if(view==='dashboard')return dashboard();if(view==='guide')return guide(b);if(view==='player')return player(b,bs);if(view==='planner')return planner(b,bs);if(view==='timeline')return timeline(b,bs);if(view==='roster')return rosterView();if(view==='notes')return notes(b,bs);return glossary(b)}
function dashboardHero(){const avg=Math.round(raid.reduce((a,x)=>a+bossState(x.id).progress,0)/raid.length);return `<section class="hero dashboardHero"><div><small>MIDNIGHT / СЕЗОН 2</small><div class="title"><h1>Ядовитая бездна</h1></div><div class="en">The Venomous Abyss · 8 боссов</div><p>Русские тактики, реальные подложки арен, ключевые кадры, маршруты игроков, анимированные перемещения, таймлайн и заметки РЛ.</p></div><div class="heroRight"><div class="raidProgress"><b>${avg}%</b><span>средний прогресс рейда</span></div><button class="primary" onclick="continueRaid()">Продолжить освоение →</button></div></section>`}
function dashboard(){return `<section class="page"><div class="stats"><div><b>${raid.filter(x=>bossState(x.id).progress>=100).length}/8</b><span>убито</span></div><div><b>${raid.filter(x=>bossState(x.id).favorite).length}</b><span>в избранном</span></div><div><b>${rosterState().length}</b><span>в составе</span></div><div><b>${raid.reduce((a,x)=>a+bossState(x.id).scenes.length,0)}</b><span>сцен</span></div></div><div class="bossCards">${orderedRaid().map(x=>{const st=bossState(x.id);return `<article onclick="openBoss('${x.id}')"><div class="bossThumb"><img src="${arenaMaps[x.id]}" alt="" loading="lazy"><span>${x.order}</span></div><div><small>${x.en}</small><h3>${x.name}</h3><p>${x.summary}</p><div class="progressLine"><i style="width:${st.progress}%"></i></div><footer><span>${st.progress}% освоено</span><b>${st.scenes.length} сцен · ${st.timelineV3.length} событий</b></footer></div></article>`}).join('')}</div><div class="dashboardActions"><button onclick="backupAll()">Скачать резервную копию RaidRU</button><button onclick="resetAllConfirm()">Сбросить локальные данные</button><span>0.5.2 хранит планы локально; ссылки «Поделиться» включают сцены, эффекты, маршруты и таймлайн.</span></div></section>`}
function continueRaid(){const r=orderedRaid();const x=r.find(x=>bossState(x.id).progress<100)||r[0];openBoss(x.id)}
function openBoss(id){current=id;view='guide';sceneIndex=0;playerSceneIndex=0;render()}
function rolebar(){return `<div class="rolebar">${Object.entries(roles).map(([k,v])=>`<button class="${role===k?'on':''}" onclick="setRole('${k}')">${v}</button>`).join('')}</div>`}
function guide(b){return `<section class="page">${rolebar()}<div class="grid"><div class="guide">${b.phases.map((p,i)=>`<article class="phase"><div class="phaseHead"><i>0${i+1}</i><div><h2>${p[0]}</h2><small>${p[1]||''}</small></div></div>${p[2].filter(m=>role==='all'||m[3].split(',').includes(role)||m[3].includes('all')).map(m=>`<div class="mech ${m[4]}"><strong>!</strong><div><h3>${m[0]} <small>${m[1]}</small></h3><p>${m[2]}</p>${diff==='heroic'&&m[5]?`<em><b>Героический:</b> ${m[5]}</em>`:''}</div></div>`).join('')}</article>`).join('')}</div><div class="right"><div class="card"><h3>🎯 Главное на боссе</h3><p>${b.rl}</p><button onclick="copyText(${JSON.stringify(b.rl)})">Копировать</button></div>${priestMode?`<div class="card priestCard"><h3>♥ Холи-прист</h3><p>${b.heal}</p><div class="chips">${priest.slice(0,4).map(x=>`<span>${x[0]}</span>`).join('')}</div></div>`:''}<div class="card"><h3>🔥 Героизм</h3><b>${b.bl}</b></div><div class="card"><h3>🎬 Визуальная тактика</h3><p>Открой «Проигрыватель», чтобы посмотреть сцены как последовательность боя.</p><button onclick="setView('player')">Открыть проигрыватель</button></div></div></div></section>`}
function arenaMapHtml(id,sc){
  const src=arenaMaps[id]||arenaMaps.nekzali;
  const m=sc?.map||{zoom:100,x:0,y:0,dark:8};
  const scale=(Number(m.zoom)||100)/100;
  return `<div class="arenaMap arenaMap-${id}">
    <img class="arenaMapImage" src="${src}" alt="Карта арены ${esc(raid.find(x=>x.id===id)?.name||id)}"
      draggable="false"
      style="transform:translate(${Number(m.x)||0}%,${Number(m.y)||0}%) scale(${scale})">
  </div>`;
}
function sceneAttachedTime(bs,idx){const x=bs.timelineV3?.find(e=>+e.scene===+idx);return x?fmtTime(x.time):'—'}
function pathPreviewHtml(sc,next){
  if(!showPaths)return '';
  const m=next?new Map(next.tokens.map(t=>[t[0],t])):new Map();
  const shapes=sc.tokens.map(t=>{
    if(t[2]==='marker'||t[2]==='boss')return '';
    const pts=[{x:t[3],y:t[4]},...((sc.routes&&sc.routes[t[0]])||[])];
    const n=m.get(t[0]); if(n)pts.push({x:n[3],y:n[4]});
    if(pts.length<2)return '';
    const points=pts.map(p=>`${p.x},${p.y}`).join(' ');
    return `<polyline points="${points}" marker-end="url(#arr)" />`;
  }).join('');
  return `<svg class="pathPreview" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>${shapes}</svg>`;
}
function routeWaypointsHtml(sc,editable){
  if(!editable)return '';
  const out=[];
  Object.entries(sc.routes||{}).forEach(([tid,pts])=>pts.forEach((p,i)=>out.push(`<button class="waypoint ${routeTokenId===tid?'active':''}" data-route-token="${tid}" data-route-index="${i}" style="left:${p.x}%;top:${p.y}%" title="Точка маршрута ${i+1}. Перетащить; ПКМ — удалить">${i+1}</button>`)));
  return `<div class="waypoints">${out.join('')}</div>`;
}
function togglePaths(){showPaths=!showPaths;save();render()}
function effectHtml(e,editable=false){const style=`left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%;--rot:${Number(e.rot)||0}deg`;return `<div class="effect ${e.type} ${editable?'editable':''}" data-effect="${e.id}" style="${style}" title="${esc(e.label||effectLabels[e.type])}"><span>${esc(e.label||'')}</span></div>`}
function arenaHtml(sc,{editable=false,player=false,next=null}={}){const dark=Math.max(0,Math.min(65,Number(sc?.map?.dark)||0))/100;return `<div id="${player?'playerArena':'arena'}" class="arena ${player?'playArena':''} arena-${current} ${routeEdit&&editable?'routeMode':''}">${arenaMapHtml(current,sc)}<div class="mapShade" style="background:rgba(0,0,0,${dark})"></div>${pathPreviewHtml(sc,next)}${routeWaypointsHtml(sc,editable)}<div class="arenaLabel">${esc(sc.name)}</div><div class="effects">${(sc.effects||[]).map(e=>effectHtml(e,editable)).join('')}</div><div class="tokens">${sc.tokens.map(t=>`<div class="token ${t[2]} ${routeTokenId===t[0]&&routeEdit?'routeSelected':''}" data-id="${t[0]}" title="${editable?'Двойной клик — переименовать':''}" style="left:${t[3]}%;top:${t[4]}%">${esc(t[1])}</div>`).join('')}</div></div>`}
function player(b,bs){const sc=bs.scenes[Math.min(playerSceneIndex,bs.scenes.length-1)],next=bs.scenes[playerSceneIndex+1]||null;const events=bs.timelineV3;return `<section class="page playerPage"><div class="playerTop"><div><button onclick="playerPrev()">‹</button><b>${esc(sc.name)}</b><span class="keyBadge">Кадр ${playerSceneIndex+1}/${bs.scenes.length} · ${sceneAttachedTime(bs,playerSceneIndex)}</span><button onclick="playerNext()">›</button></div><div><button class="${showPaths?'on':''}" onclick="togglePaths()">⇢ Траектории</button><select onchange="setPlayerSpeed(this.value)"><option value="0.5" ${playerSpeed===.5?'selected':''}>0.5×</option><option value="1" ${playerSpeed===1?'selected':''}>1×</option><option value="1.5" ${playerSpeed===1.5?'selected':''}>1.5×</option><option value="2" ${playerSpeed===2?'selected':''}>2×</option></select><button class="rehearse" onclick="togglePlayback()">${playerPlaying?'■ Стоп':'▶ Проиграть бой'}</button></div></div><div class="playerLayout"><div>${arenaHtml(sc,{player:true,next})}<div class="sceneCaption"><b>${esc(sc.name)}</b><p>${esc(sc.note)}</p><small>Следующий ключевой кадр: ${next?esc(next.name):'финал'}</small></div></div><aside class="eventRail"><h3>Таймлайн</h3>${events.map((e,i)=>`<button class="${e.scene===playerSceneIndex?'on':''}" onclick="jumpEvent(${i})"><time>${fmtTime(e.time)}</time><span><b>${esc(e.label)}</b><small>${eventTypes[e.type]||e.type} · кадр ${e.scene+1}</small></span></button>`).join('')}</aside></div><div class="playScrubber">${events.map((e,i)=>`<button class="${e.scene===playerSceneIndex?'on':''}" style="left:${timelinePct(e.time,events)}%" onclick="jumpEvent(${i})" title="${fmtTime(e.time)} · ${esc(e.label)}"></button>`).join('')}</div><div class="playerLegend"><span><i class="lg tank"></i>Танк</span><span><i class="lg healer"></i>Хил</span><span><i class="lg dps"></i>ДД</span><span><i class="lg danger"></i>Опасность</span><span><i class="lg path"></i>Траектория к следующему кадру</span></div></section>`}
function timelinePct(t,events){const max=Math.max(1,...events.map(e=>Number(e.time)||0));return Math.min(100,(Number(t)||0)/max*100)}
function planner(b,bs){const sc=bs.scenes[Math.min(sceneIndex,bs.scenes.length-1)];const movable=sc.tokens.filter(t=>!['marker','boss'].includes(t[2]));if(!routeTokenId||!movable.some(t=>t[0]===routeTokenId))routeTokenId=movable[0]?.[0]||null;return `<section class="page"><div class="plannerTop"><div><button onclick="prevScene()">‹</button><input id="sceneName" value="${esc(sc.name)}"><small>${sceneIndex+1}/${bs.scenes.length}</small><button onclick="nextScene()">›</button></div><div><button onclick="setView('player')">▶ Просмотр</button><button onclick="loadBossPreset()">Шаблон босса</button><button onclick="addScene()">＋ Сцена</button><button onclick="resetScene()">↻ Сброс</button><button class="red" onclick="delScene()">Удалить</button></div></div><div class="sceneStrip">${bs.scenes.map((x,i)=>`<button class="${i===sceneIndex?'on':''}" onclick="goScene(${i})"><b>${i+1}</b><span>${esc(x.name)}</span></button>`).join('')}</div><div class="planGrid"><div>${arenaHtml(sc,{editable:true,next:bs.scenes[sceneIndex+1]||null})}<div class="sceneMeta"><button class="${showPaths?'on':''}" onclick="togglePaths()">⇢ Траектории к следующему кадру</button><span class="keyBadge">Ключевой кадр · ${sceneAttachedTime(bs,sceneIndex)}</span><label>Длительность сцены <input id="sceneDuration" type="number" min="1" max="120" value="${sc.duration||8}"> сек.</label></div><textarea id="sceneNote" placeholder="Описание сцены…">${esc(sc.note)}</textarea></div><div class="toolbox"><h3>Игроки и метки</h3>${[['tank','Танк'],['healer','Хил'],['melee','Мили'],['ranged','РДД'],['marker','Метка'],['boss','Босс']].map(x=>`<button onclick="addToken('${x[0]}')">＋ ${x[1]}</button>`).join('')}<hr><h3>Маршрут внутри сцены</h3><small>Выбери игрока, включи редактор и кликай по карте — точки задают путь до следующего ключевого кадра.</small><select class="routeSelect" onchange="selectRouteToken(this.value)">${movable.map(t=>`<option value="${t[0]}" ${routeTokenId===t[0]?'selected':''}>${esc(t[1])}</option>`).join('')}</select><button class="${routeEdit?'on':''}" onclick="toggleRouteEdit()">${routeEdit?'✓ Редактор маршрута включён':'✦ Редактировать маршрут'}</button><button onclick="clearRoute()">Очистить маршрут игрока</button><p class="routeHelp">В режиме маршрута: клик по свободной области добавляет точку. Точки можно перетаскивать. ПКМ по точке удаляет её.</p><hr><h3>Карта арены</h3>
<small>Подложка экспортирована через RaidPlan. Масштаб и смещение сохраняются отдельно для каждого кадра.</small>
<label class="mapControl">Масштаб <b>${Math.round(sc.map?.zoom||100)}%</b><input type="range" min="100" max="180" step="1" value="${sc.map?.zoom||100}" oninput="setMapSetting('zoom',this.value)"></label>
<label class="mapControl">Сдвиг X <b>${Math.round(sc.map?.x||0)}</b><input type="range" min="-30" max="30" step="1" value="${sc.map?.x||0}" oninput="setMapSetting('x',this.value)"></label>
<label class="mapControl">Сдвиг Y <b>${Math.round(sc.map?.y||0)}</b><input type="range" min="-30" max="30" step="1" value="${sc.map?.y||0}" oninput="setMapSetting('y',this.value)"></label>
<label class="mapControl">Затемнение <b>${Math.round(sc.map?.dark||0)}%</b><input type="range" min="0" max="65" step="1" value="${sc.map?.dark||0}" oninput="setMapSetting('dark',this.value)"></label>
<button onclick="resetMapSettings()">↻ Сбросить карту</button>
<hr><h3>Механики на карте</h3><small>Поверх реальной арены можно размещать зоны, soak, стрелки, конусы и линии.</small>${[['zone','Опасная зона'],['soak','Soak-зона'],['arrow','Стрелка'],['cone','Конус'],['line','Линия']].map(x=>`<button onclick="addEffect('${x[0]}')">＋ ${x[1]}</button>`).join('')}<p>Объекты и эффекты можно перетаскивать. Двойной клик — переименовать. ПКМ — удалить. Колесо мыши над эффектом меняет размер, Shift+колесо — поворот.</p><hr><b>Состав</b><small>${rosterState().length?`Загружено игроков: ${rosterState().length}.`:'Добавь игроков во вкладке «Состав».'}</small></div></div></section>`}
function rosterView(){const roster=rosterState();return `<section class="page rosterPage"><div class="rosterGrid"><div class="card"><h3>Быстрый импорт состава</h3><p>Вставь список из Discord/рейд-заметки. Поддерживается формат <code>Ник - роль</code>, <code>Ник роль</code> или просто ники по строкам.</p><textarea id="rosterInput" placeholder="TankOne - танк\nPriestka - хил\nHunter - дд"></textarea><div class="rowButtons"><button onclick="parseRoster()">Разобрать список</button><button onclick="clearRoster()">Очистить</button></div></div><div class="card"><h3>Сводка</h3><div class="roleCounts"><span>🛡 ${roster.filter(x=>x.role==='tank').length} танков</span><span>♥ ${roster.filter(x=>x.role==='healer').length} хилов</span><span>⚔ ${roster.filter(x=>x.role==='dps').length} ДД</span></div><p>Состав сохраняется локально и автоматически попадает в заметку для РЛ.</p></div></div><div class="rosterList">${roster.length?roster.map((x,i)=>`<div><b>${esc(x.name)}</b><select onchange="setRosterRole(${i},this.value)"><option value="tank" ${x.role==='tank'?'selected':''}>Танк</option><option value="healer" ${x.role==='healer'?'selected':''}>Хил</option><option value="dps" ${x.role==='dps'?'selected':''}>ДД</option></select><button onclick="removeRoster(${i})">×</button></div>`).join(''):'<div class="empty">Состав пока пуст.</div>'}</div></section>`}
function parseRoster(){const txt=el('#rosterInput')?.value||'';const lines=txt.split(/\n+/).map(x=>x.trim()).filter(Boolean);state.roster=lines.map(line=>{const low=line.toLowerCase();let role=low.includes('танк')||/\btank\b/.test(low)?'tank':low.includes('хил')||low.includes('heal')?'healer':'dps';let name=line.replace(/[-–—|:,]?\s*(танк|tank|хил(?:ер)?|heal(?:er)?|дд|dps)\s*$/i,'').trim();return {name:name||line,role}});save();toast(`Состав: ${state.roster.length} игроков`);render()}
function clearRoster(){state.roster=[];save();render()} function setRosterRole(i,r){rosterState()[i].role=r;save();render()} function removeRoster(i){rosterState().splice(i,1);save();render()}
function rosterNote(){const r=rosterState();if(!r.length)return '';const f=x=>r.filter(a=>a.role===x).map(a=>a.name).join(', ');return `\nСостав:\nТанки: ${f('tank')||'—'}\nХилы: ${f('healer')||'—'}\nДД: ${f('dps')||'—'}`}
function timeline(b,bs){return `<section class="page timelineEditor">${rolebar()}<div class="timelineActions"><button onclick="addTimelineEvent()">＋ Событие</button><button onclick="resetTimeline()">↻ Из шаблона</button><button onclick="setView('player')">▶ Проигрыватель</button><span>Время вводится в секундах или формате м:с. Каждое событие привязывается к сцене.</span></div><div class="timeline">${bs.timelineV3.map((e,i)=>`<article class="event editEvent ${e.type}"><input value="${fmtTime(e.time)}" onchange="editTimeline(${i},'time',this.value)" aria-label="Время"><input value="${esc(e.label)}" onchange="editTimeline(${i},'label',this.value)" aria-label="Событие"><select onchange="editTimeline(${i},'type',this.value)">${Object.keys(eventTypes).map(t=>`<option value="${t}" ${e.type===t?'selected':''}>${eventTypes[t]}</option>`).join('')}</select><select onchange="editTimeline(${i},'scene',this.value)">${bs.scenes.map((s,j)=>`<option value="${j}" ${e.scene===j?'selected':''}>${j+1}. ${esc(s.name)}</option>`).join('')}</select><button onclick="moveTimeline(${i},-1)">↑</button><button onclick="moveTimeline(${i},1)">↓</button><button class="red" onclick="removeTimeline(${i})">×</button></article>`).join('')}</div></section>`}
function notes(b,bs){const ns=`[RaidRU] ${b.name}\n${b.rl}\n${priestMode?'Холи-прист: '+b.heal+'\n':''}BL: ${b.bl}${rosterNote()}\n\nТаймлайн:\n${bs.timelineV3.map(e=>`${fmtTime(e.time)} ${e.label}`).join('\n')}`;return `<section class="page notes"><div class="card wide"><h3>Личная / гильдейская заметка</h3><textarea id="customNote" oninput="saveNote(this.value)" placeholder="Назначения, хил-КД, метки…">${esc(bs.note)}</textarea></div><div class="card wide"><h3>Готовая заметка для NSRT / чата</h3><pre>${esc(ns)}</pre><button onclick="copyText(${JSON.stringify(ns)})">Копировать</button></div><div class="card checklist"><h3>Чеклист перед пулом</h3>${['Метки расставлены','Танки знают позиции','Хил-КД распределены','Soak/мини-группы назначены','Героизм согласован','Дебаффы видны на фреймах'].map(x=>`<label><input type="checkbox"> ${x}</label>`).join('')}</div></section>`}
function glossary(b){const arr=[...b.spells,...priest];return `<section class="page"><div class="table"><div class="thead"><b>Русский клиент</b><b>Английское название</b><b>Источник</b></div>${arr.map((x,i)=>`<div><b>${x[0]}</b><code>${x[1]}</code><span>${i<b.spells.length?'Босс':'Холи-прист'}</span></div>`).join('')}</div></section>`}
function chooseBoss(id){stopPlayback();current=id;sceneIndex=0;playerSceneIndex=0;render()} function setView(v){stopPlayback();view=v;render()} function setRole(v){role=v;render()} function setDiff(v){diff=v;render()} function togglePriest(){priestMode=!priestMode;render()} function fav(){const bs=bossState(current);bs.favorite=!bs.favorite;render()} function setProgress(v){bossState(current).progress=+v;save();render()} function saveNote(v){bossState(current).note=v;save()} function copyText(t){navigator.clipboard?.writeText(t);toast('Скопировано')}
function filterBoss(q){document.querySelectorAll('.bosses button').forEach(x=>x.style.display=x.dataset.name.includes(q.toLowerCase())?'grid':'none')}
function exportPlan(){const blob=new Blob([JSON.stringify({version:'0.5.0',boss:current,diff,role,data:bossState(current)},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`raidru-${current}-v05.json`;a.click();URL.revokeObjectURL(a.href);toast('Стратегия экспортирована')}
function importPlanFile(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);if(!p.boss||!p.data)throw new Error();state[p.boss]=p.data;current=p.boss;diff=p.diff||diff;role=p.role||role;bossState(current);save();toast('Стратегия импортирована');render()}catch(e){toast('Не удалось импортировать JSON')}};r.readAsText(file)}
function sharePlan(){const u=buildShareUrl();navigator.clipboard?.writeText(u);history.replaceState(null,'',u);toast('Ссылка на стратегию скопирована')}
function backupAll(){const blob=new Blob([JSON.stringify({version:'0.5.0',savedAt:new Date().toISOString(),state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='raidru-backup-v05.json';a.click();URL.revokeObjectURL(a.href);toast('Резервная копия скачана')}
function resetAllConfirm(){if(!confirm('Удалить локальные прогресс, планы, заметки и состав?'))return;localStorage.removeItem('raidru-standalone');location.hash='';location.reload()}
function prevScene(){sceneIndex=Math.max(0,sceneIndex-1);render()} function nextScene(){sceneIndex=Math.min(bossState(current).scenes.length-1,sceneIndex+1);render()} function goScene(i){sceneIndex=i;render()}
function loadBossPreset(){if(!confirm('Заменить текущие сцены готовым шаблоном босса?'))return;const bs=bossState(current);bs.scenes=bossPresetScenes(current).map((s,i)=>normalizeScene(s,current,i));bs.timelineV3=null;bossState(current);sceneIndex=0;save();toast('Шаблон босса загружен');render()}
function addScene(){const bs=bossState(current),src=bs.scenes[sceneIndex];bs.scenes.push(normalizeScene(deep({...src,name:`Сцена ${bs.scenes.length+1}`}),current,bs.scenes.length));sceneIndex=bs.scenes.length-1;save();render()}
function delScene(){const bs=bossState(current);if(bs.scenes.length<2)return;if(!confirm('Удалить сцену?'))return;bs.scenes.splice(sceneIndex,1);bs.timelineV3.forEach(e=>e.scene=Math.min(e.scene,bs.scenes.length-1));sceneIndex=Math.max(0,sceneIndex-1);save();render()}
function resetScene(){bossState(current).scenes[sceneIndex]=defaultScene();save();render()}
function addToken(type){const sc=bossState(current).scenes[sceneIndex],labels={tank:'T',healer:'H',melee:'M',ranged:'R',marker:'★',boss:'БОСС'};sc.tokens.push([uid(),labels[type],type,50,50]);save();render()}
function addEffect(type){const sc=bossState(current).scenes[sceneIndex];sc.effects.push({id:uid(),type,x:50,y:50,w:type==='line'||type==='arrow'?40:24,h:type==='line'||type==='arrow'?6:24,rot:0,label:effectLabels[type]});save();render()}
function setMapSetting(k,v){
  const sc=bossState(current).scenes[sceneIndex];
  if(!sc.map)sc.map={zoom:100,x:0,y:0,dark:8};
  const n=Number(v);
  if(k==='zoom')sc.map.zoom=Math.max(100,Math.min(180,n||100));
  else if(k==='x'||k==='y')sc.map[k]=Math.max(-30,Math.min(30,n||0));
  else if(k==='dark')sc.map.dark=Math.max(0,Math.min(65,n||0));
  save();render();
}
function resetMapSettings(){
  const sc=bossState(current).scenes[sceneIndex];
  sc.map={zoom:100,x:0,y:0,dark:18};
  save();render();
}
function setupPlanner(){
  const arena=el('#arena'),bs=bossState(current),sc=bs.scenes[sceneIndex],name=el('#sceneName'),note=el('#sceneNote'),dur=el('#sceneDuration');
  if(name)name.oninput=e=>{sc.name=e.target.value;save()}; if(note)note.oninput=e=>{sc.note=e.target.value;save()}; if(dur)dur.oninput=e=>{sc.duration=Math.max(1,+e.target.value||8);save()};
  arena?.querySelectorAll('.token').forEach(node=>bindDrag(node,sc.tokens,'token'));
  arena?.querySelectorAll('.effect').forEach(node=>{bindDrag(node,sc.effects,'effect');node.onwheel=e=>{e.preventDefault();const fx=sc.effects.find(x=>x.id===node.dataset.effect);if(!fx)return;if(e.shiftKey)fx.rot=(Number(fx.rot)||0)+(e.deltaY>0?10:-10);else{const d=e.deltaY>0?-2:2;fx.w=Math.max(6,Math.min(90,fx.w+d));fx.h=Math.max(4,Math.min(90,fx.h+(fx.type==='line'||fx.type==='arrow'?0:d)));}save();render()}})
  arena?.querySelectorAll('.waypoint').forEach(node=>bindWaypoint(node,sc));
  if(arena) arena.onclick=e=>{if(!routeEdit||!routeTokenId)return;if(e.target.closest('.token,.effect,.waypoint,.mapDoor'))return;const r=arena.getBoundingClientRect();const x=Math.max(2,Math.min(98,(e.clientX-r.left)/r.width*100)),y=Math.max(2,Math.min(98,(e.clientY-r.top)/r.height*100));(sc.routes[routeTokenId]||(sc.routes[routeTokenId]=[])).push({x,y});save();render()};
}
function selectRouteToken(id){routeTokenId=id;render()}
function toggleRouteEdit(){routeEdit=!routeEdit;render()}
function clearRoute(){const sc=bossState(current).scenes[sceneIndex];if(!routeTokenId)return;sc.routes[routeTokenId]=[];save();render()}
function bindWaypoint(node,sc){
  const tid=node.dataset.routeToken,idx=+node.dataset.routeIndex;
  node.onpointerdown=e=>{e.preventDefault();e.stopPropagation();node.setPointerCapture(e.pointerId);node.onpointermove=ev=>{const arena=el('#arena'),r=arena.getBoundingClientRect(),p=sc.routes?.[tid]?.[idx];if(!p)return;p.x=Math.max(2,Math.min(98,(ev.clientX-r.left)/r.width*100));p.y=Math.max(2,Math.min(98,(ev.clientY-r.top)/r.height*100));node.style.left=p.x+'%';node.style.top=p.y+'%';save()};node.onpointerup=()=>node.onpointermove=null};
  node.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();if(sc.routes?.[tid]){sc.routes[tid].splice(idx,1);save();render()}};
}
function bindDrag(node,list,kind){
  const attr=kind==='token'?'id':'effect'; const key=node.dataset[attr];
  node.onpointerdown=e=>{e.preventDefault();node.setPointerCapture(e.pointerId);const item=list.find(x=>(kind==='token'?x[0]:x.id)===key);node.onpointermove=ev=>{if(!item)return;const arena=el('#arena');const r=arena.getBoundingClientRect();const x=Math.max(3,Math.min(97,(ev.clientX-r.left)/r.width*100)),y=Math.max(3,Math.min(97,(ev.clientY-r.top)/r.height*100));if(kind==='token'){item[3]=x;item[4]=y}else{item.x=x;item.y=y}node.style.left=x+'%';node.style.top=y+'%';save()};node.onpointerup=()=>{node.onpointermove=null}};
  node.ondblclick=()=>{const item=list.find(x=>(kind==='token'?x[0]:x.id)===key);const cur=kind==='token'?item?.[1]:item?.label;const v=prompt('Подпись',cur||'');if(v&&item){if(kind==='token')item[1]=v.slice(0,22);else item.label=v.slice(0,36);save();render()}};
  node.oncontextmenu=e=>{e.preventDefault();const i=list.findIndex(x=>(kind==='token'?x[0]:x.id)===key);if(i>=0&&confirm('Удалить объект?')){list.splice(i,1);save();render()}}
}
function addTimelineEvent(){const bs=bossState(current);const prev=bs.timelineV3.at(-1);bs.timelineV3.push({id:uid(),time:(prev?.time||0)+30,label:'Новая механика',type:'move',scene:Math.min(sceneIndex,bs.scenes.length-1),note:''});save();render()}
function editTimeline(i,k,v){const e=bossState(current).timelineV3[i];if(!e)return;if(k==='time'){const p=parseTime(v);if(Number.isFinite(p))e.time=p}else if(k==='scene')e.scene=+v;else e[k]=v;save();render()}
function removeTimeline(i){bossState(current).timelineV3.splice(i,1);save();render()} function moveTimeline(i,d){const a=bossState(current).timelineV3,j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];save();render()}
function resetTimeline(){if(!confirm('Пересоздать таймлайн из сцен?'))return;bossState(current).timelineV3=null;bossState(current);save();render()}
function setupPlayer(){requestAnimationFrame(()=>{const arena=el('#playerArena');arena?.querySelectorAll('.token,.effect').forEach(n=>n.classList.add('settled'))})}
function playerPrev(){playerSceneIndex=Math.max(0,playerSceneIndex-1);render()} function playerNext(){playerSceneIndex=Math.min(bossState(current).scenes.length-1,playerSceneIndex+1);render()}
function jumpEvent(i){const e=bossState(current).timelineV3[i];if(!e)return;animatePlayerTo(e.scene)}
function setPlayerSpeed(v){playerSpeed=+v||1}
function animatePlayerTo(target){
  const bs=bossState(current),arena=el('#playerArena');target=Math.max(0,Math.min(bs.scenes.length-1,+target||0));if(!arena){playerSceneIndex=target;render();return}
  const sourceIndex=playerSceneIndex,source=bs.scenes[sourceIndex]||bs.scenes[0],sc=bs.scenes[target];
  const oldNodes=[...arena.querySelectorAll('.token')],newMap=new Map(sc.tokens.map(t=>[t[0],t]));
  let longest=0;
  oldNodes.forEach(n=>{
    const t=newMap.get(n.dataset.id);
    if(!t){n.classList.add('vanish');return}
    const route=(source.routes?.[n.dataset.id]||[]).map(p=>({x:p.x,y:p.y}));
    const path=[...route,{x:t[3],y:t[4]}];
    const total=Math.max(.5,Math.min(5,(source.duration||8)/playerSpeed)),seg=Math.max(.2,total/Math.max(1,path.length));
    n.textContent=t[1];n.className='token '+t[2]+' moving';n.style.setProperty('--moveDur',seg+'s');
    path.forEach((p,i)=>setTimeout(()=>{n.style.left=p.x+'%';n.style.top=p.y+'%'},i*seg*1000+20));
    longest=Math.max(longest,total);newMap.delete(n.dataset.id);
  });
  newMap.forEach(t=>{const n=document.createElement('div');n.className='token '+t[2]+' appear';n.style.setProperty('--moveDur','.45s');n.dataset.id=t[0];n.style.left=t[3]+'%';n.style.top=t[4]+'%';n.textContent=t[1];arena.querySelector('.tokens').appendChild(n);requestAnimationFrame(()=>n.classList.remove('appear'))});
  const effects=arena.querySelector('.effects');effects.innerHTML=sc.effects.map(e=>effectHtml(e,false)).join('');effects.querySelectorAll('.effect').forEach(n=>n.classList.add('fxIn'));
  const lab=arena.querySelector('.arenaLabel');if(lab)lab.textContent=sc.name;
  playerSceneIndex=target;setTimeout(()=>{if(view==='player')render()},(longest*1000)+250);
}
function togglePlayback(){
  if(playerPlaying){stopPlayback();render();return}
  const bs=bossState(current),events=[...bs.timelineV3].sort((a,b)=>a.time-b.time);if(!events.length){toast('Таймлайн пуст');return}
  playerPlaying=true;playerSceneIndex=events[0].scene;render();
  const base=events[0].time; events.forEach((e,i)=>{const delay=((e.time-base)*1000)/playerSpeed;const id=setTimeout(()=>{if(!playerPlaying)return;animatePlayerTo(e.scene);toast(`${fmtTime(e.time)} · ${e.label}`);if(i===events.length-1){playbackTimer=setTimeout(()=>{playerPlaying=false;if(view==='player')render()},Math.max(1200,(bossState(current).scenes[e.scene]?.duration||5)*600/playerSpeed))}},delay);(state._playTimers||(state._playTimers=[])).push(id)})
}
function stopPlayback(){playerPlaying=false;(state._playTimers||[]).forEach(clearTimeout);state._playTimers=[];if(playbackTimer)clearTimeout(playbackTimer);playbackTimer=null}
restoreFromHash();
render();
