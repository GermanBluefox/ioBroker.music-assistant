import{createRoot as e,useEffect as t,useLayoutEffect as n,useRef as r,useState as i,Fragment as a,jsx as o,jsxs as s}from"../../../lib/esm/react-19.js";var c=`iob-dialog-close`;function l(e){return!!e.form}var u=[`header`,`staticText`,`divider`];function d(e,t){return e==null?``:typeof e==`object`?e[t]||e.en||Object.values(e).find(e=>!!e)||``:String(e)}function f(e){let t={};for(let[n,r]of Object.entries(e.items||{}))r&&!u.includes(r.type)&&(t[n]=r.type);return t}function p(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?e.toString():JSON.stringify(e)}function m(e,t){if(t!=null)switch(e){case`number`:case`slider`:{if(typeof t==`number`)return Number.isFinite(t)?t:void 0;let e=p(t).trim().replace(`,`,`.`);if(!e)return;let n=Number(e);return Number.isFinite(n)?n:void 0}case`checkbox`:return t===!0||t===`true`||t===1||t===`1`;default:return p(t)}}function h(e,t){let n={};for(let[r,i]of Object.entries(e)){let e=m(i,t[r]);e!==void 0&&(n[r]=e)}return n}var g={ok:{en:`OK`,"zh-cn":`确定`},cancel:{en:`Cancel`,de:`Abbrechen`,ru:`Отмена`,pt:`Cancelar`,nl:`Annuleren`,fr:`Annuler`,it:`Annulla`,es:`Cancelar`,pl:`Anuluj`,uk:`Скасувати`,"zh-cn":`取消`},close:{en:`Close`,de:`Schließen`,ru:`Закрыть`,pt:`Fechar`,nl:`Sluiten`,fr:`Fermer`,it:`Chiudi`,es:`Cerrar`,pl:`Zamknij`,uk:`Закрити`,"zh-cn":`关闭`}},_=`
dialog {
    color-scheme: light;
    --primary: #1976d2;
    --primary-text: #fff;
    box-sizing: border-box;
    width: 480px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: Canvas;
    color: CanvasText;
    font: inherit;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
dialog.dark {
    color-scheme: dark;
    --primary: #90caf9;
    --primary-text: #000;
}
dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
dialog:focus { outline: none; }
form { display: flex; flex-direction: column; height: 100%; max-height: inherit; margin: 0; }
header { display: flex; align-items: center; gap: 8px; padding: 12px 8px 12px 16px; font-size: 1.15em; font-weight: 500; }
header span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.body { flex: 1; min-height: 0; padding: 0 16px 16px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 16px 16px; }
button { font: inherit; padding: 6px 16px; border-radius: 4px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
button.primary { background: var(--primary); border-color: var(--primary); color: var(--primary-text); }
button.close { border: 0; padding: 2px 8px; font-size: 1.4em; line-height: 1; opacity: 0.7; }
label { display: flex; flex-direction: column; gap: 4px; }
label.check { flex-direction: row; align-items: center; gap: 8px; }
input, select, textarea { font: inherit; }
input[type='range'] { accent-color: var(--primary); }
.help { opacity: 0.7; font-size: 0.85em; }
h3 { margin: 4px 0 0; font-size: 1em; }
p { margin: 0; }
hr { width: 100%; border: 0; border-top: 1px solid currentColor; opacity: 0.3; margin: 0; }
[hidden] { display: none !important; }
`;function v(e){if(!e)return null;try{let t=Function(`data`,`return (${e});`);return e=>{try{return!!t(e)}catch{return!1}}}catch{return null}}function y(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?String(e):``}function b(e){let{input:t,setting:n}=e;if(t)return t instanceof HTMLInputElement&&t.type===`checkbox`?t.checked:t instanceof HTMLSelectElement?n.options?.[t.selectedIndex]?.value:t.value}function x(e,t,n,r,i){let a={name:t,setting:n,box:e.createElement(`div`),hidden:v(n.hidden),disabled:v(n.disabled)},o=d(n.label,i);switch(n.type){case`header`:return a.box=e.createElement(`h3`),a.box.textContent=d(n.text,i)||o,a;case`staticText`:return a.box=e.createElement(`p`),a.box.textContent=d(n.text,i)||o,a;case`divider`:return a.box=e.createElement(`hr`),a}let s=e.createElement(`label`);a.box=s;let c=e.createElement(`span`);if(c.textContent=o||t,n.type===`checkbox`){let t=e.createElement(`input`);t.type=`checkbox`,t.checked=r===!0||r===`true`,s.className=`check`,s.append(t,c),a.input=t}else if(n.type===`select`){let t=e.createElement(`select`);for(let r of n.options||[]){let n=e.createElement(`option`);n.textContent=d(r.label,i),t.append(n)}let o=(n.options||[]).findIndex(e=>String(e.value)===y(r));t.selectedIndex=o===-1?0:o,s.append(c,t),a.input=t}else if(n.type===`text`&&(n.minRows||1)>1){let t=e.createElement(`textarea`);t.rows=n.minRows||2,t.value=y(r),s.append(c,t),a.input=t}else{let t=e.createElement(`input`),i=y(r);switch(n.type){case`number`:case`slider`:t.type=n.type===`slider`?`range`:`number`,n.min!==void 0&&(t.min=String(n.min)),n.max!==void 0&&(t.max=String(n.max)),t.step=n.step===void 0?`any`:String(n.step);break;case`password`:t.type=`password`;break;case`color`:t.type=!i||/^#[0-9a-f]{6}$/i.test(i)?`color`:`text`;break;default:t.type=`text`}if(t.value=i,t.type===`range`){let n=e.createElement(`output`);n.textContent=t.value,t.addEventListener(`input`,()=>n.textContent=t.value),c.append(`: `,n)}s.append(c,t),a.input=t}if(n.help){let t=e.createElement(`span`);t.className=`help`,t.textContent=d(n.help,i),s.append(t)}return a}function S(e,t={}){let n=t.lang||`en`,r=document,i=e=>g[e][n]||g[e].en||e,a=r.createElement(`div`);a.setAttribute(`data-iob-dialog`,``);let o=a.attachShadow({mode:`open`}),s=r.createElement(`style`);s.textContent=_;let u=r.createElement(`dialog`);u.className=t.theme===`dark`?`dark`:``,e.width&&(u.style.width=`${e.width}px`),e.height&&(u.style.height=`${e.height}px`);let p=r.createElement(`form`),m=r.createElement(`header`),v=r.createElement(`span`);v.textContent=d(e.title,n);let y=r.createElement(`button`);y.type=`button`,y.className=`close`,y.title=i(`close`),y.setAttribute(`aria-label`,i(`close`)),y.textContent=`×`,m.append(v,y);let S=r.createElement(`div`);return S.className=`body`,p.append(m,S),u.append(p),o.append(s,u),new Promise(t=>{let s=!1,m=e=>{s||(s=!0,u.open&&u.close(),a.remove(),t(e))};if(y.addEventListener(`click`,()=>m(null)),u.addEventListener(`close`,()=>m(null)),p.addEventListener(`submit`,e=>e.preventDefault()),l(e)){let t={},a=[];for(let[t,i]of Object.entries(e.form.items||{})){let o=e.data?.[t]??i.default,s=x(r,t,i,o,n);a.push(s),S.append(s.box)}let o=()=>{for(let e of a)e.input&&(t[e.name]=b(e));return t},s=()=>{let e=o();for(let t of a)t.box.hidden=t.hidden?t.hidden(e):!1,t.input&&(t.input.disabled=t.disabled?t.disabled(e):!1)};p.addEventListener(`input`,s),p.addEventListener(`change`,s),s();let c=a.find(e=>e.input&&!e.box.hidden&&!e.input.disabled);c?.input&&(c.input.autofocus=!0);let l=r.createElement(`footer`),u=r.createElement(`button`);u.type=`button`,u.textContent=d(e.cancel,n)||i(`cancel`),u.addEventListener(`click`,()=>m(null));let g=r.createElement(`button`);g.type=`submit`,g.className=`primary`,g.textContent=d(e.ok,n)||i(`ok`),l.append(u,g),p.append(l),p.addEventListener(`submit`,()=>m(h(f(e.form),o())))}else S.append(e.element),u.addEventListener(c,e=>m(e.detail??null));r.body.append(a),u.showModal(),o.activeElement&&o.activeElement!==y||(u.tabIndex=-1,u.focus())})}function C(e){return[...new Set(e.filter(e=>typeof e==`string`&&!!e))]}var w=[`socket`,`dialogs`,`theme`,`editMode`,`settings`],T=class extends HTMLElement{states={};objects={};#e=null;#t={};#n=`light`;#r=!1;#i=null;#a=null;#o=!1;#s=(e,t)=>{this.#a?.states.includes(e)&&(this.states[e]=t||null,this.#h())};#c=(e,t)=>{this.#a?.objects.includes(e)&&(this.objects[e]=t||null,this.#l())};get socket(){return this.#e}set socket(e){this.#e=e||null,this.#l()}get settings(){return this.#t}set settings(e){this.#t=e||{},this.#l()}get theme(){return this.#n}set theme(e){let t=e===`dark`?`dark`:`light`;t!==this.#n&&(this.#n=t,this.#h())}get editMode(){return this.#r}set editMode(e){let t=!!e;t!==this.#r&&(this.#r=t,this.#h())}get dialogs(){return this.#i}set dialogs(e){this.#i=e||null}connectedCallback(){for(let e of w)if(Object.prototype.hasOwnProperty.call(this,e)){let t=this[e];delete this[e],this[e]=t}this.#l()}disconnectedCallback(){this.#m()}getStateIds(e){return[]}getObjectIds(e){return[]}get systemLang(){return this.#e?.systemLang||`en`}text(e){return d(e,this.systemLang)}setState(e,t){return this.#e&&!this.#r?this.#e.setState(e,t):Promise.resolve()}emit(e,t){return this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0,cancelable:!0}))}async openDialog(e){if(this.#r)return null;let t=this.#i?await this.#i.open(e):await S(e,{lang:this.systemLang,theme:this.#n});return l(e)?t&&typeof t==`object`?h(f(e.form),t):null:t??null}#l(){if(!this.isConnected)return;let e=this.#e,t=e?C(this.getStateIds(this.#t)):[],n=e?C(this.getObjectIds(this.#t)):[];this.#a&&this.#a.socket!==e&&this.#m();let r=this.#a?.states||[],i=this.#a?.objects||[],a=r.filter(e=>!t.includes(e)),o=i.filter(e=>!n.includes(e)),s=t.filter(e=>!r.includes(e)),c=n.filter(e=>!i.includes(e));e&&a.length&&e.unsubscribeState(a,this.#s),e&&o.length&&this.#p(e,o);for(let e of a)delete this.states[e];for(let e of[...a,...o])!t.includes(e)&&!n.includes(e)&&delete this.objects[e];this.#a=e&&(t.length||n.length)?{socket:e,states:t,objects:n}:null,e&&s.length&&this.#d(e,s),e&&c.length&&this.#f(e,c),this.#h()}#u(e,t,n){return this.#a?.socket===e&&this.#a[t].includes(n)}#d(e,t){e.subscribeState(t,this.#s).catch(e=>console.warn(`<${this.localName}>: cannot subscribe ${t.join(`, `)}: ${e}`));for(let n of t)e.getState(n).then(t=>{this.#u(e,`states`,n)&&this.states[n]===void 0&&(this.states[n]=t||null,this.#h())}).catch(()=>{}),e.getObject(n).then(t=>{this.#u(e,`states`,n)&&!this.#u(e,`objects`,n)&&(this.objects[n]=t||null,this.#h())}).catch(()=>{})}#f(e,t){e.subscribeObject(t,this.#c).catch(e=>console.warn(`<${this.localName}>: cannot subscribe the objects ${t.join(`, `)}: ${e}`));for(let n of t)e.getObject(n).then(t=>{this.#u(e,`objects`,n)&&(this.objects[n]=t||null,this.#l())}).catch(()=>{})}#p(e,t){e.unsubscribeObject(t,this.#c).catch(()=>{})}#m(){if(this.#a){let{socket:e,states:t,objects:n}=this.#a;t.length&&e.unsubscribeState(t,this.#s),n.length&&this.#p(e,n),this.#a=null}this.states={},this.objects={}}#h(){this.#o||(this.#o=!0,queueMicrotask(()=>{this.#o=!1,this.isConnected&&this.render()}))}};function E(e,t){let n=typeof e==`string`?e:e.tag;customElements.get(n)||customElements.define(n,t)}var D=`iob-ma-player`,O=[`name`,`available`,`powered`,`state`,`volume`,`muted`,`shuffle`,`repeat`,`elapsedTime`,`duration`,`mediaTitle`,`mediaArtist`,`mediaAlbum`,`mediaImage`,`source`];function k(e){let t=e?.match(/^(music-assistant\.\d+\.players\.[^.]+)(\.|$)/);return t?t[1]:null}function A(e){let t=Math.max(0,Math.floor(e||0)),n=Math.floor(t/3600),r=Math.floor(t%3600/60),i=String(t%60).padStart(2,`0`);return n?`${n}:${String(r).padStart(2,`0`)}:${i}`:`${r}:${i}`}var j={choosePlayer:`Choose a player in the settings`,notPlayer:`Not a player of Music Assistant`,notAvailable:`Not available`,nothingPlaying:`Nothing playing`,powerOn:`Switch on`,play:`Play`,pause:`Pause`,next:`Next`,previous:`Previous`,shuffle:`Shuffle`,repeatOff:`Repeat: off`,repeatAll:`Repeat: all`,repeatOne:`Repeat: one`,mute:`Mute`,unmute:`Unmute`,volume:`Volume`,position:`Position`,source:`Source`,library:`Library`,favorites:`Favorites`,playlists:`Playlists`,radio:`Radio`,search:`Search`,loading:`Loading…`,nothingFound:`Nothing found`,libraryError:`The library cannot be read`,artists:`Artists`,albums:`Albums`,tracks:`Tracks`,podcasts:`Podcasts`,audiobooks:`Audiobooks`,loadMore:`Load more`},ee={en:j,de:{choosePlayer:`Player in den Einstellungen wählen`,notPlayer:`Kein Player von Music Assistant`,notAvailable:`Nicht verfügbar`,nothingPlaying:`Keine Wiedergabe`,powerOn:`Einschalten`,play:`Wiedergabe`,pause:`Pause`,next:`Weiter`,previous:`Zurück`,shuffle:`Zufallswiedergabe`,repeatOff:`Wiederholen: aus`,repeatAll:`Wiederholen: alle`,repeatOne:`Wiederholen: einen`,mute:`Stumm`,unmute:`Ton an`,volume:`Lautstärke`,position:`Position`,source:`Quelle`,library:`Bibliothek`,favorites:`Favoriten`,playlists:`Playlists`,radio:`Radio`,search:`Suchen`,loading:`Wird geladen…`,nothingFound:`Nichts gefunden`,libraryError:`Die Bibliothek kann nicht gelesen werden`,artists:`Künstler`,albums:`Alben`,tracks:`Titel`,podcasts:`Podcasts`,audiobooks:`Hörbücher`,loadMore:`Mehr laden`},ru:{choosePlayer:`Выберите плеер в настройках`,notPlayer:`Это не плеер Music Assistant`,notAvailable:`Недоступен`,nothingPlaying:`Ничего не воспроизводится`,powerOn:`Включить`,play:`Воспроизвести`,pause:`Пауза`,next:`Следующий`,previous:`Предыдущий`,shuffle:`Перемешать`,repeatOff:`Повтор: выкл.`,repeatAll:`Повтор: все`,repeatOne:`Повтор: один`,mute:`Без звука`,unmute:`Включить звук`,volume:`Громкость`,position:`Позиция`,source:`Источник`,library:`Библиотека`,favorites:`Избранное`,playlists:`Плейлисты`,radio:`Радио`,search:`Поиск`,loading:`Загрузка…`,nothingFound:`Ничего не найдено`,libraryError:`Не удаётся прочитать библиотеку`,artists:`Исполнители`,albums:`Альбомы`,tracks:`Треки`,podcasts:`Подкасты`,audiobooks:`Аудиокниги`,loadMore:`Загрузить ещё`},pt:{choosePlayer:`Escolha um leitor nas configurações`,notPlayer:`Não é um leitor do Music Assistant`,notAvailable:`Indisponível`,nothingPlaying:`Nada a tocar`,powerOn:`Ligar`,play:`Reproduzir`,pause:`Pausa`,next:`Seguinte`,previous:`Anterior`,shuffle:`Aleatório`,repeatOff:`Repetir: desligado`,repeatAll:`Repetir: tudo`,repeatOne:`Repetir: uma`,mute:`Silenciar`,unmute:`Ativar som`,volume:`Volume`,position:`Posição`,source:`Fonte`,library:`Biblioteca`,favorites:`Favoritos`,playlists:`Playlists`,radio:`Rádio`,search:`Pesquisar`,loading:`A carregar…`,nothingFound:`Nada encontrado`,libraryError:`Não é possível ler a biblioteca`,artists:`Artistas`,albums:`Álbuns`,tracks:`Faixas`,podcasts:`Podcasts`,audiobooks:`Audiolivros`,loadMore:`Carregar mais`},nl:{choosePlayer:`Kies een speler in de instellingen`,notPlayer:`Geen speler van Music Assistant`,notAvailable:`Niet beschikbaar`,nothingPlaying:`Er speelt niets`,powerOn:`Inschakelen`,play:`Afspelen`,pause:`Pauze`,next:`Volgende`,previous:`Vorige`,shuffle:`Willekeurig`,repeatOff:`Herhalen: uit`,repeatAll:`Herhalen: alles`,repeatOne:`Herhalen: één`,mute:`Dempen`,unmute:`Dempen opheffen`,volume:`Volume`,position:`Positie`,source:`Bron`,library:`Bibliotheek`,favorites:`Favorieten`,playlists:`Afspeellijsten`,radio:`Radio`,search:`Zoeken`,loading:`Laden…`,nothingFound:`Niets gevonden`,libraryError:`De bibliotheek kan niet worden gelezen`,artists:`Artiesten`,albums:`Albums`,tracks:`Nummers`,podcasts:`Podcasts`,audiobooks:`Luisterboeken`,loadMore:`Meer laden`},fr:{choosePlayer:`Choisissez un lecteur dans les paramètres`,notPlayer:`Pas un lecteur de Music Assistant`,notAvailable:`Non disponible`,nothingPlaying:`Aucune lecture`,powerOn:`Allumer`,play:`Lecture`,pause:`Pause`,next:`Suivant`,previous:`Précédent`,shuffle:`Aléatoire`,repeatOff:`Répétition : désactivée`,repeatAll:`Répétition : tout`,repeatOne:`Répétition : un titre`,mute:`Couper le son`,unmute:`Rétablir le son`,volume:`Volume`,position:`Position`,source:`Source`,library:`Bibliothèque`,favorites:`Favoris`,playlists:`Playlists`,radio:`Radio`,search:`Rechercher`,loading:`Chargement…`,nothingFound:`Aucun résultat`,libraryError:`Impossible de lire la bibliothèque`,artists:`Artistes`,albums:`Albums`,tracks:`Titres`,podcasts:`Podcasts`,audiobooks:`Livres audio`,loadMore:`Charger plus`},it:{choosePlayer:`Scegli un lettore nelle impostazioni`,notPlayer:`Non è un lettore di Music Assistant`,notAvailable:`Non disponibile`,nothingPlaying:`Nessuna riproduzione`,powerOn:`Accendi`,play:`Riproduci`,pause:`Pausa`,next:`Successivo`,previous:`Precedente`,shuffle:`Casuale`,repeatOff:`Ripeti: disattivato`,repeatAll:`Ripeti: tutto`,repeatOne:`Ripeti: uno`,mute:`Muto`,unmute:`Riattiva audio`,volume:`Volume`,position:`Posizione`,source:`Sorgente`,library:`Libreria`,favorites:`Preferiti`,playlists:`Playlist`,radio:`Radio`,search:`Cerca`,loading:`Caricamento…`,nothingFound:`Nessun risultato`,libraryError:`Impossibile leggere la libreria`,artists:`Artisti`,albums:`Album`,tracks:`Brani`,podcasts:`Podcast`,audiobooks:`Audiolibri`,loadMore:`Carica altro`},es:{choosePlayer:`Elija un reproductor en la configuración`,notPlayer:`No es un reproductor de Music Assistant`,notAvailable:`No disponible`,nothingPlaying:`No se reproduce nada`,powerOn:`Encender`,play:`Reproducir`,pause:`Pausa`,next:`Siguiente`,previous:`Anterior`,shuffle:`Aleatorio`,repeatOff:`Repetir: desactivado`,repeatAll:`Repetir: todo`,repeatOne:`Repetir: una`,mute:`Silenciar`,unmute:`Activar sonido`,volume:`Volumen`,position:`Posición`,source:`Fuente`,library:`Biblioteca`,favorites:`Favoritos`,playlists:`Listas`,radio:`Radio`,search:`Buscar`,loading:`Cargando…`,nothingFound:`No se encontró nada`,libraryError:`No se puede leer la biblioteca`,artists:`Artistas`,albums:`Álbumes`,tracks:`Canciones`,podcasts:`Podcasts`,audiobooks:`Audiolibros`,loadMore:`Cargar más`},pl:{choosePlayer:`Wybierz odtwarzacz w ustawieniach`,notPlayer:`To nie jest odtwarzacz Music Assistant`,notAvailable:`Niedostępny`,nothingPlaying:`Nic nie jest odtwarzane`,powerOn:`Włącz`,play:`Odtwórz`,pause:`Pauza`,next:`Następny`,previous:`Poprzedni`,shuffle:`Losowo`,repeatOff:`Powtarzanie: wył.`,repeatAll:`Powtarzanie: wszystko`,repeatOne:`Powtarzanie: jeden`,mute:`Wycisz`,unmute:`Wyłącz wyciszenie`,volume:`Głośność`,position:`Pozycja`,source:`Źródło`,library:`Biblioteka`,favorites:`Ulubione`,playlists:`Playlisty`,radio:`Radio`,search:`Szukaj`,loading:`Ładowanie…`,nothingFound:`Nic nie znaleziono`,libraryError:`Nie można odczytać biblioteki`,artists:`Wykonawcy`,albums:`Albumy`,tracks:`Utwory`,podcasts:`Podcasty`,audiobooks:`Audiobooki`,loadMore:`Wczytaj więcej`},uk:{choosePlayer:`Виберіть плеєр у налаштуваннях`,notPlayer:`Це не плеєр Music Assistant`,notAvailable:`Недоступний`,nothingPlaying:`Нічого не відтворюється`,powerOn:`Увімкнути`,play:`Відтворити`,pause:`Пауза`,next:`Наступний`,previous:`Попередній`,shuffle:`Перемішати`,repeatOff:`Повтор: вимк.`,repeatAll:`Повтор: усі`,repeatOne:`Повтор: один`,mute:`Вимкнути звук`,unmute:`Увімкнути звук`,volume:`Гучність`,position:`Позиція`,source:`Джерело`,library:`Бібліотека`,favorites:`Обране`,playlists:`Плейлисти`,radio:`Радіо`,search:`Пошук`,loading:`Завантаження…`,nothingFound:`Нічого не знайдено`,libraryError:`Не вдається прочитати бібліотеку`,artists:`Виконавці`,albums:`Альбоми`,tracks:`Треки`,podcasts:`Подкасти`,audiobooks:`Аудіокниги`,loadMore:`Завантажити ще`},"zh-cn":{choosePlayer:`请在设置中选择播放器`,notPlayer:`不是 Music Assistant 的播放器`,notAvailable:`不可用`,nothingPlaying:`未在播放`,powerOn:`开启`,play:`播放`,pause:`暂停`,next:`下一首`,previous:`上一首`,shuffle:`随机播放`,repeatOff:`重复：关`,repeatAll:`重复：全部`,repeatOne:`重复：单曲`,mute:`静音`,unmute:`取消静音`,volume:`音量`,position:`进度`,source:`音源`,library:`媒体库`,favorites:`收藏`,playlists:`播放列表`,radio:`电台`,search:`搜索`,loading:`加载中…`,nothingFound:`未找到内容`,libraryError:`无法读取媒体库`,artists:`艺术家`,albums:`专辑`,tracks:`曲目`,podcasts:`播客`,audiobooks:`有声书`,loadMore:`加载更多`}};function M(e,t){return ee[e]?.[t]||j[t]}var te={play:`M8 5v14l11-7z`,pause:`M6 19h4V5H6v14zm8-14v14h4V5h-4z`,next:`M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z`,previous:`M6 6h2v12H6zm3.5 6l8.5 6V6z`,shuffle:`M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z`,repeat:`M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z`,repeatOne:`M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z`,volume:`M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z`,volumeOff:`M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z`,power:`M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z`,dropDown:`M7 10l5 5 5-5z`,artist:`M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z`,album:`M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z`,podcast:`M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z`,audiobook:`M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z`,library:`M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z`,playlist:`M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z`,radio:`M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.11-.89-2-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z`,music:`M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z`};function N({name:e}){return/* @__PURE__ */ o(`svg`,{viewBox:`0 0 24 24`,"aria-hidden":`true`,focusable:`false`,children:/* @__PURE__ */ o(`path`,{d:te[e]})})}var ne=500,P=[{list:`favorites`,word:`favorites`},{list:`artists`,word:`artists`},{list:`albums`,word:`albums`},{list:`tracks`,word:`tracks`},{list:`playlists`,word:`playlists`},{list:`radios`,word:`radio`},{list:`podcasts`,word:`podcasts`},{list:`audiobooks`,word:`audiobooks`}],re={artist:`artist`,album:`album`,playlist:`playlist`,radio:`radio`,podcast:`podcast`,audiobook:`audiobook`};function ie({entry:e}){let[t,n]=i(!1);return/* @__PURE__ */ o(`span`,{className:e.type===`artist`?`thumb round`:`thumb`,children:e.image&&!t?/* @__PURE__ */ o(`img`,{src:e.image,alt:``,loading:`lazy`,referrerPolicy:`no-referrer`,onError:()=>n(!0)}):/* @__PURE__ */ o(N,{name:re[e.type]||`music`})})}function ae(e){if(!e)return null;try{let t=JSON.parse(window.localStorage.getItem(e)||`null`),n=P.find(e=>e.list===t?.list);return!t||!n?null:{list:n.list,search:typeof t.search==`string`?t.search:``,count:Math.max(0,Number(t.count)||0),scrollTop:Math.max(0,Number(t.scrollTop)||0)}}catch{return null}}function F(e,t){if(e)try{window.localStorage.setItem(e,JSON.stringify(t))}catch{}}function oe(e){let t=Math.ceil((e?.count||0)/100)||1;return Math.min(t*100,ne)}function I(e,t){return e?.items?{items:e.items,error:``}:{items:[],error:e?.error||t(`libraryError`)}}function L(e){return e instanceof Error?e.message:String(e)}function se({load:e,word:n,onPick:c,storageKey:l}){let[u]=i(()=>ae(l)),[d,f]=i(u?.list||`favorites`),[p,m]=i(u?.search||``),[h,g]=i(u?.search||``),[_,v]=i(null),[y,b]=i(!1),x=r(null),S=r(null),C=r(u),w=r(null),T=r(void 0),E=(e,t=!1)=>{w.current=e,clearTimeout(T.current),T.current=t?setTimeout(()=>F(l,e),250):void 0,t||F(l,e)};t(()=>()=>{T.current!==void 0&&w.current&&(clearTimeout(T.current),F(l,w.current))},[]),t(()=>{let e=setTimeout(()=>g(p.trim()),350);return()=>clearTimeout(e)},[p]);let D=`${d}\n${h}`;t(()=>{let t=!0,r=C.current?.list===d&&C.current.search===h?C.current:null;r||(C.current=null,S.current&&(S.current.scrollTop=0),E({list:d,search:h,count:0,scrollTop:0}));let i=oe(r);return e(d,h,0,i).then(e=>{if(t){let t=I(e,n);v({key:D,...t,more:t.items.length>=i})}}).catch(e=>{t&&v({key:D,items:[],error:L(e),more:!1})}),()=>{t=!1}},[D]);let O=_?.key===D?_:null;t(()=>{if(!O)return;let e=S.current,t=C.current;if(C.current=null,t&&e){e.scrollTop=t.scrollTop;let n=x.current,r=n?.querySelector(`.tab.active`);n&&r&&(n.scrollLeft=r.offsetLeft-(n.clientWidth-r.offsetWidth)/2)}let n=e?.clientHeight?e.scrollTop:t?.scrollTop||0;E({list:d,search:h,count:O.items.length,scrollTop:n})},[O]);let k=()=>{O&&!y&&(b(!0),e(d,h,O.items.length,100).then(e=>{let t=I(e,n);v(e=>e?.key===D?{key:D,items:[...e.items,...t.items],error:t.error,more:!t.error&&t.items.length>=100}:e)}).catch(e=>v(t=>t?.key===D?{...t,error:L(e),more:!1}:t)).finally(()=>b(!1)))},A=e=>{O&&S.current&&E({list:d,search:h,count:O.items.length,scrollTop:S.current.scrollTop}),c(e)},j;return j=O?O.error&&!O.items.length?/* @__PURE__ */ o(`div`,{className:`note error`,children:O.error}):O.items.length?/* @__PURE__ */ s(a,{children:[/* @__PURE__ */ o(`ul`,{className:`items`,children:O.items.map(e=>/* @__PURE__ */ o(`li`,{children:/* @__PURE__ */ s(`button`,{className:`item`,title:e.subtitle?`${e.name} · ${e.subtitle}`:e.name,onClick:()=>A(e.uri),children:[/* @__PURE__ */ o(ie,{entry:e}),/* @__PURE__ */ s(`span`,{className:`texts`,children:[/* @__PURE__ */ o(`span`,{className:`entry-name`,children:e.name}),e.subtitle?/* @__PURE__ */ o(`span`,{className:`entry-sub`,children:e.subtitle}):null]}),/* @__PURE__ */ o(N,{name:`play`})]})},e.uri))}),O.error?/* @__PURE__ */ o(`div`,{className:`note error`,children:O.error}):null,O.more?/* @__PURE__ */ o(`button`,{className:`more`,disabled:y,onClick:k,children:n(y?`loading`:`loadMore`)}):null]}):/* @__PURE__ */ o(`div`,{className:`note`,children:n(`nothingFound`)}):/* @__PURE__ */ o(`div`,{className:`note`,children:n(`loading`)}),/* @__PURE__ */ s(`div`,{className:`library`,children:[/* @__PURE__ */ o(`div`,{ref:x,className:`tabs`,role:`tablist`,children:P.map(e=>/* @__PURE__ */ o(`button`,{role:`tab`,"aria-selected":e.list===d,className:e.list===d?`tab active`:`tab`,onClick:t=>{f(e.list),t.currentTarget.scrollIntoView({block:`nearest`,inline:`nearest`})},children:n(e.word)},e.list))}),/* @__PURE__ */ o(`input`,{className:`search`,type:`search`,placeholder:n(`search`),"aria-label":n(`search`),value:p,onChange:e=>m(e.currentTarget.value)}),/* @__PURE__ */ o(`div`,{ref:S,className:`list`,onScroll:e=>{O&&!C.current&&E({list:d,search:h,count:O.items.length,scrollTop:e.currentTarget.scrollTop},!0)},children:j})]})}var ce=`
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
}
.mount.dark {
    color-scheme: dark;
}
.library {
    --hover: color-mix(in srgb, currentColor 10%, transparent);
    --line: color-mix(in srgb, currentColor 20%, transparent);
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 240px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
/* eight tabs do not fit a narrow dialog: they scroll */
.tabs {
    position: relative;
    flex: none;
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--line);
    overflow-x: auto;
    scrollbar-width: thin;
}
button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    margin: 0;
    cursor: pointer;
}
button:focus-visible,
.search:focus-visible {
    outline: 2px solid var(--accent, currentColor);
    outline-offset: 1px;
}
.tab {
    flex: 1 0 auto;
    padding: 8px 10px;
    border-bottom: 2px solid transparent;
    opacity: 0.7;
    white-space: nowrap;
}
.tab:hover {
    background: var(--hover);
}
.tab.active {
    opacity: 1;
    font-weight: 600;
    border-bottom-color: var(--accent, currentColor);
}
.search {
    font: inherit;
    color: inherit;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 10px;
}
.list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
}
.items {
    list-style: none;
    margin: 0;
    padding: 0;
}
.item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px;
    border-radius: 6px;
    text-align: left;
}
.item:hover {
    background: var(--hover);
}
.item > svg {
    flex: none;
    width: 20px;
    height: 20px;
    fill: currentColor;
    opacity: 0;
}
.item:hover > svg,
.item:focus-visible > svg {
    opacity: 0.7;
}
.thumb {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--hover);
}
.thumb.round {
    border-radius: 50%;
}
.thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.thumb svg {
    width: 55%;
    height: 55%;
    fill: currentColor;
    opacity: 0.4;
}
.texts {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.entry-name,
.entry-sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.entry-sub {
    font-size: 0.85em;
    opacity: 0.7;
}
.more {
    display: block;
    width: 100%;
    margin: 4px 0;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
}
.more:hover:not(:disabled) {
    background: var(--hover);
}
.more:disabled {
    cursor: default;
    opacity: 0.6;
}
.note {
    padding: 24px 8px;
    text-align: center;
    opacity: 0.7;
}
.note.error {
    opacity: 1;
}
`,R=16,z=1.4,B=1.65,V=1.2,H=18,U=90,le=1.4,W=1.3,ue=1.4;function G(e,t,n){return Math.min(n,Math.max(e,t))}function K(e){return Math.floor(e*10)/10}function q(e,t,n){return(t?e.name*le:0)+e.title*W+(n?e.artist*ue:0)}function J(e,t,n){if(!n.powered)return{icon:G(R,e/B,t),modes:!1,previous:!1};for(let[r,i,a,o]of[[6.85,5,!0,!0],[4.449999999999999,3,!1,!0],[3.05,2,!1,!1]]){if(a&&!n.modes)continue;let s=(e-(i-1)*4)/r;if(s>=R)return{icon:Math.min(s,t),modes:a,previous:o}}return{icon:R,modes:!1,previous:!1}}function Y(e,t,n,r){return B*e+(n?t+H:0)+(r?t+Math.max(H,V*e):0)}function X(e,t,n,r){let i=r.powered&&r.progress,a=r.powered&&r.volume,o=[[i,a],[!1,a],[!1,!1]];for(let[r,i]of o){let a=(r?t+H:0)+(i?t:0),o=B+(i?V:0),s=Math.min(n,(e-a)/o);if(s>=R)return{icon:s,progress:r,volume:i}}return null}function de(e,t){let{innerWidth:n,innerHeight:r,gap:i,fonts:a}=e,o=t.cover?Math.min(r,e.width*.42):0;o&&n-o-i<150&&(o=n-i-150),o<56&&(o=0);let s=J(n-(o?o+i:0),e.maxIcon,t),c=X(r-q(a,!0,!0)-i,i,s.icon,t);if(!c)return null;let l=r-q(a,!0,!0)-i-Y(c.icon,i,c.progress,c.volume);return{kind:`wide`,pad:e.pad,gap:i,cover:Math.floor(o),icon:K(c.icon),name:!0,artist:!0,titleLines:l>=a.title*W?2:1,progress:c.progress,volume:c.volume,modes:s.modes,previous:s.previous,fonts:a}}function fe(e,t){let{innerWidth:n,innerHeight:r,gap:i,fonts:a}=e,o=J(n,e.maxIcon,t),s=q(a,!0,!0),c=X(r-s-i,i,o.icon,t);if(!c)return null;let l=Y(c.icon,i,c.progress,c.volume)+i,u=t.cover?Math.min(r-l,n*.45,n-i-U):0;u<40&&(u=0);let d=(u||r-l)-s;return{kind:`card`,pad:e.pad,gap:i,cover:Math.floor(u),icon:K(c.icon),name:!0,artist:!0,titleLines:d>=a.title*W?2:1,progress:c.progress,volume:c.volume,modes:o.modes,previous:o.previous,fonts:a}}function pe(e,t){let{innerWidth:n,innerHeight:r,gap:i,fonts:a}=e,o=J(n,e.maxIcon,t),s=q(a,!0,!0),c=X(r-s-i,i,o.icon,t);if(!c)return null;let l=s+i+Y(c.icon,i,c.progress,c.volume),u=t.cover?Math.min(n,r-l-i):0;u<48&&(u=0);let d=r-l-(u?u+i:0);return{kind:`tall`,pad:e.pad,gap:i,cover:Math.floor(u),icon:K(c.icon),name:!0,artist:!0,titleLines:d>=a.title*W?2:1,progress:c.progress,volume:c.volume,modes:o.modes,previous:o.previous,fonts:a}}function me(e,t){let{height:n,innerWidth:r,innerHeight:i,gap:a}=e,o={name:G(10,n*.11,13),title:G(13,n*.17,18),artist:G(11,n*.13,14),time:e.fonts.time},s=G(R,i/B,28),c=t.cover&&r>=200?i:0,l=r-(c?c+a:0)-U-a,u=t.powered&&l>=4.449999999999999*s+8,d=t.powered?(u?2*z:z)+B:B;l<d*s&&c&&(c=0,l=r-U-a),l<d*s&&(s=Math.max(R,l/d)),t.powered||(u=!1);let f=i>=q(o,!0,!0);return{kind:`row`,pad:e.pad,gap:a,cover:Math.floor(c),icon:K(s),name:f,artist:i>=q(o,!1,!0),titleLines:1,progress:!1,volume:!1,modes:!1,previous:u,fonts:o}}function he(e,t,n){let r=Math.min(e,t),i=Math.round(G(6,r*.045,16)),a=Math.round(G(6,r*.04,16)),o={width:e,height:t,innerWidth:Math.max(0,e-2*i),innerHeight:Math.max(0,t-2*i),pad:i,gap:a,maxIcon:G(24,r*.1,36),fonts:{name:G(10,r*.04,13),title:G(13,r*.07,22),artist:G(11,r*.05,16),time:G(10,r*.036,13)}};if(t>=120){let r=e/t,i=r>=1.45?de(o,n):r>=.8?fe(o,n):pe(o,n);if(i)return i}return me(o,n)}var Z=[`repeatOff`,`repeatAll`,`repeatOne`];function ge(e){let[n,r]=i(()=>Date.now());return t(()=>{if(!e)return;let t=setInterval(()=>r(Date.now()),1e3);return()=>clearInterval(t)},[e]),n}function Q({value:e,max:n,label:a,disabled:s,onCommit:c}){let[l,u]=i(null),d=r(null),f=r(c),p=r(void 0);t(()=>{f.current=c}),t(()=>{let e=d.current;if(!e)return;let t=()=>{f.current(Number(e.value)),clearTimeout(p.current),p.current=setTimeout(()=>u(null),2500)};return e.addEventListener(`change`,t),()=>{e.removeEventListener(`change`,t),clearTimeout(p.current)}},[]);let m=Math.min(n,Math.max(0,l??e)),h=n>0?m/n*100:0;return/* @__PURE__ */ o(`input`,{ref:d,type:`range`,min:0,max:n,step:1,value:m,disabled:s,"aria-label":a,title:a,style:{"--fill":`${h}%`},onChange:e=>{clearTimeout(p.current),u(Number(e.currentTarget.value))}})}function $({value:e,sources:n,label:r,disabled:a,onSelect:c}){let[l,u]=i(null);t(()=>{if(!l)return;let e=setTimeout(()=>u(null),5e3);return()=>clearTimeout(e)},[l]);let d=l&&l.was===e?l.id:e,f=n.some(e=>e.id===d)?n:[...n,{id:d,name:d}];return/* @__PURE__ */ s(`span`,{className:`source`,children:[/* @__PURE__ */ o(`select`,{value:d,title:r,"aria-label":r,disabled:a,onChange:t=>{let n=t.currentTarget.value;u({id:n,was:e}),c(n)},children:f.map(e=>/* @__PURE__ */ o(`option`,{value:e.id,children:e.name},e.id))}),/* @__PURE__ */ o(N,{name:`dropDown`})]})}function _e({image:e}){let[t,n]=i(``);return/* @__PURE__ */ o(`div`,{className:`cover`,children:e&&t!==e?/* @__PURE__ */ o(`img`,{src:e,alt:``,referrerPolicy:`no-referrer`,onError:()=>n(e)}):/* @__PURE__ */ o(N,{name:`music`})})}function ve({text:e,editMode:t}){return/* @__PURE__ */ s(`div`,{className:`player hint${t?` edit`:``}`,children:[/* @__PURE__ */ o(N,{name:`music`}),/* @__PURE__ */ o(`span`,{children:e})]})}function ye(e){let[t,r]=i(null);return n(()=>{let t=e.current;if(!t)return;let n=()=>{let e=t.offsetWidth,n=t.offsetHeight;r(t=>t?.width===e&&t.height===n?t:{width:e,height:n})};n();let i=new ResizeObserver(n);return i.observe(t),()=>i.disconnect()},[e]),t}function be(e){let{values:t,word:n,onCommand:i,editMode:c}=e,l=r(null),u=ye(l),d=ge(t.playing&&!c),f=!t.available,p=t.powered||f,m=t.playing&&t.elapsedTs?Math.max(0,d-t.elapsedTs)/1e3:0,h=t.duration>0?Math.min(t.duration,t.elapsed+m):t.elapsed+m,g=t.repeat>=0&&t.repeat<=2?t.repeat:0,_=t.muted||t.volume<=0,v=[t.artist,t.album].filter(Boolean).join(` · `),y=u?he(u.width,u.height,{cover:e.showCover,powered:p,progress:t.duration>0,volume:e.showVolume,modes:e.showModes}):null,b=[`player`],x={"--accent":e.accent||`currentColor`};y&&(b.push(y.kind),x[`--pad`]=`${y.pad}px`,x[`--gap`]=`${y.gap}px`,x[`--icon`]=`${y.icon}px`,x[`--cover`]=`${y.cover}px`,x[`--fs-name`]=`${y.fonts.name}px`,x[`--fs-title`]=`${y.fonts.title}px`,x[`--fs-artist`]=`${y.fonts.artist}px`,x[`--fs-time`]=`${y.fonts.time}px`),e.theme===`dark`&&b.push(`dark`),c&&b.push(`edit`),f&&b.push(`unavailable`);let S=null;if(y){let r=y.cover?/* @__PURE__ */ o(_e,{image:t.image}):null,c=e.onLibrary?/* @__PURE__ */ o(`button`,{className:`library`,title:n(`library`),"aria-label":n(`library`),disabled:f,onClick:e.onLibrary,children:/* @__PURE__ */ o(N,{name:`library`})}):null,l=e.showSource&&t.sources.length>1?/* @__PURE__ */ o($,{value:t.source,sources:t.sources,label:n(`source`),disabled:f,onSelect:e=>i(`source`,e)}):null,u=/* @__PURE__ */ s(`div`,{className:`info`,children:[y.name?/* @__PURE__ */ s(`div`,{className:`name`,children:[/* @__PURE__ */ s(`span`,{className:`label`,children:[t.name,f?` · ${n(`notAvailable`)}`:``]}),l,c]}):null,/* @__PURE__ */ o(`div`,{className:`title${y.titleLines>1?` two`:``}`,children:t.title||n(`nothingPlaying`)}),v&&y.artist?/* @__PURE__ */ o(`div`,{className:`artist`,children:v}):null]}),d=y.progress?/* @__PURE__ */ s(`div`,{className:`progress`,children:[/* @__PURE__ */ o(`span`,{className:`time`,children:A(h)}),/* @__PURE__ */ o(Q,{value:Math.round(h),max:Math.round(t.duration),label:n(`position`),disabled:f,onCommit:e=>i(`seek`,e)}),/* @__PURE__ */ o(`span`,{className:`time`,children:A(t.duration)})]}):null,m=p?/* @__PURE__ */ s(`div`,{className:`controls`,children:[y.modes?/* @__PURE__ */ o(`button`,{className:`mode${t.shuffle?` active`:``}`,title:n(`shuffle`),"aria-label":n(`shuffle`),"aria-pressed":t.shuffle,disabled:f,onClick:()=>i(`shuffle`,!t.shuffle),children:/* @__PURE__ */ o(N,{name:`shuffle`})}):null,y.previous?/* @__PURE__ */ o(`button`,{title:n(`previous`),"aria-label":n(`previous`),disabled:f,onClick:()=>i(`previous`,!0),children:/* @__PURE__ */ o(N,{name:`previous`})}):null,/* @__PURE__ */ o(`button`,{className:`main-action`,title:n(t.playing?`pause`:`play`),"aria-label":n(t.playing?`pause`:`play`),disabled:f,onClick:()=>i(`playPause`,!0),children:/* @__PURE__ */ o(N,{name:t.playing?`pause`:`play`})}),/* @__PURE__ */ o(`button`,{title:n(`next`),"aria-label":n(`next`),disabled:f,onClick:()=>i(`next`,!0),children:/* @__PURE__ */ o(N,{name:`next`})}),y.modes?/* @__PURE__ */ o(`button`,{className:`mode${g?` active`:``}`,title:n(Z[g]),"aria-label":n(Z[g]),disabled:f,onClick:()=>i(`repeat`,(g+1)%3),children:/* @__PURE__ */ o(N,{name:g===2?`repeatOne`:`repeat`})}):null]}):/* @__PURE__ */ o(`div`,{className:`controls power`,children:/* @__PURE__ */ o(`button`,{className:`main-action`,title:n(`powerOn`),"aria-label":n(`powerOn`),onClick:()=>i(`powered`,!0),children:/* @__PURE__ */ o(N,{name:`power`})})}),b=y.volume?/* @__PURE__ */ s(`div`,{className:`volume`,children:[/* @__PURE__ */ o(`button`,{title:n(t.muted?`unmute`:`mute`),"aria-label":n(t.muted?`unmute`:`mute`),"aria-pressed":t.muted,disabled:f,onClick:()=>i(`muted`,!t.muted),children:/* @__PURE__ */ o(N,{name:_?`volumeOff`:`volume`})}),/* @__PURE__ */ o(Q,{value:t.volume,max:100,label:n(`volume`),disabled:f,onCommit:e=>i(`volume`,e)})]}):null;S=y.kind===`wide`?/* @__PURE__ */ s(a,{children:[r,/* @__PURE__ */ s(`div`,{className:`main`,children:[u,d,m,b]})]}):y.kind===`card`?/* @__PURE__ */ s(a,{children:[/* @__PURE__ */ s(`div`,{className:`head`,children:[r,u]}),d,m,b]}):y.kind===`tall`?/* @__PURE__ */ s(a,{children:[r,u,d,m,b]}):/* @__PURE__ */ s(a,{children:[r,u,m]})}return/* @__PURE__ */ o(`div`,{ref:l,className:b.join(` `),style:x,children:S})}var xe=`
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it - no loop between measuring and laying out */
    container-type: size;
}
.player {
    --track: color-mix(in srgb, currentColor 22%, transparent);
    --hover: color-mix(in srgb, currentColor 10%, transparent);
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--pad, 8px);
    display: flex;
    gap: var(--gap, 8px);
    overflow: hidden;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
.player.edit {
    pointer-events: none;
}
.player.wide,
.player.row {
    flex-direction: row;
    align-items: center;
}
.player.card,
.player.tall {
    flex-direction: column;
    justify-content: center;
}
.main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--gap);
}
.head {
    display: flex;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
}
.cover {
    flex: none;
    width: var(--cover);
    height: var(--cover);
    border-radius: clamp(4px, calc(var(--cover) * 0.06), 12px);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--hover);
}
.tall .cover {
    align-self: center;
}
.cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.cover svg {
    width: 45%;
    height: 45%;
    fill: currentColor;
    opacity: 0.35;
}
.info {
    min-width: 0;
}
.head .info,
.row .info {
    flex: 1;
}
.tall .info {
    text-align: center;
}
.name,
.title,
.artist {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.name {
    font-size: var(--fs-name);
    line-height: 1.4;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    display: flex;
    align-items: baseline;
    gap: 0.5em;
}
/* the name line holds the list of the sources and the button of the library, which may be a bit higher */
.player .name {
    overflow: visible;
}
.name .library {
    flex: none;
    margin: -0.25em 0 -0.25em auto;
    padding: 0.1em;
    border-radius: 4px;
    opacity: 0.75;
}
.name .library:hover:not(:disabled) {
    opacity: 1;
}
.name .library svg {
    width: 1.5em;
    height: 1.5em;
}
.tall .name .library {
    margin-left: 0;
}
.name .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.6;
}
.tall .name {
    justify-content: center;
}
/* the source after the name: a list box of the browser that looks like the text, with an arrow */
.source {
    position: relative;
    flex: 0 1 auto;
    min-width: 3em;
    max-width: 60%;
    display: inline-flex;
    align-items: center;
}
.source select {
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: var(--accent);
    background: transparent;
    border: none;
    border-radius: 4px;
    margin: 0;
    padding: 0 1.3em 0 0.3em;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
}
.source select:hover:not(:disabled) {
    background: var(--hover);
}
.source select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 0;
}
.source select:disabled {
    cursor: default;
    opacity: 0.6;
}
/* the list itself is drawn by the browser: in the colors of the theme, not in the inherited color */
.source option {
    color: CanvasText;
    background-color: Canvas;
    text-transform: none;
}
.player.dark {
    color-scheme: dark;
}
.source svg {
    position: absolute;
    right: 0;
    width: 1.3em;
    height: 1.3em;
    fill: var(--accent);
    pointer-events: none;
}
.title {
    font-size: var(--fs-title);
    line-height: 1.3;
    font-weight: 600;
}
.title.two {
    white-space: normal;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.artist {
    font-size: var(--fs-artist);
    line-height: 1.4;
    opacity: 0.75;
}
.unavailable .cover,
.unavailable .progress,
.unavailable .controls,
.unavailable .volume {
    opacity: 0.4;
}
.progress,
.volume {
    display: flex;
    align-items: center;
    gap: calc(var(--gap) * 0.6);
    min-width: 0;
}
.time {
    font-size: var(--fs-time);
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
    min-width: 3.2em;
}
.time:last-child {
    text-align: right;
}
.controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    width: 100%;
    max-width: calc(var(--icon) * 11);
}
.card .controls,
.tall .controls {
    align-self: center;
}
.row .controls {
    flex: none;
    width: auto;
}
.controls.power {
    justify-content: center;
}
.wide .controls.power {
    justify-content: flex-start;
}
button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    margin: 0;
    padding: calc(var(--icon) * 0.2);
    border-radius: 50%;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
}
button:hover:not(:disabled) {
    background: var(--hover);
}
button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
button:disabled {
    cursor: default;
}
button svg {
    width: var(--icon);
    height: var(--icon);
    fill: currentColor;
    display: block;
}
button.main-action {
    color: var(--accent);
    box-shadow: inset 0 0 0 2px var(--accent);
}
button.main-action svg {
    width: calc(var(--icon) * 1.25);
    height: calc(var(--icon) * 1.25);
}
button.mode {
    opacity: 0.45;
}
button.mode.active {
    opacity: 1;
    color: var(--accent);
}
button.mode svg,
.volume button svg {
    width: calc(var(--icon) * 0.8);
    height: calc(var(--icon) * 0.8);
}
input[type='range'] {
    --fill: 0%;
    /* a form control does not inherit the color; the thumb and the track are drawn in it */
    color: inherit;
    flex: 1;
    min-width: 0;
    height: 18px;
    margin: 0;
    background: transparent;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
}
input[type='range']:disabled {
    cursor: default;
}
input[type='range']:focus-visible {
    outline: none;
}
input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--track) var(--fill));
}
input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
}
input[type='range']:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px var(--track);
}
input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--track);
}
input[type='range']::-moz-range-progress {
    height: 4px;
    border-radius: 2px;
    background: var(--accent);
}
input[type='range']::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
}
.hint {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    opacity: 0.7;
    font-size: clamp(11px, 5cqmin, 15px);
}
.hint svg {
    width: clamp(18px, 10cqmin, 30px);
    height: clamp(18px, 10cqmin, 30px);
    fill: currentColor;
}
`,Se=15e3;function Ce(e){return e?typeof e==`string`?e.split(`;`).map(e=>e.split(`:`)).filter(([e])=>e).map(([e,...t])=>({id:e,name:t.join(`:`)||e})):Array.isArray(e)?e.map(e=>({id:String(e),name:String(e)})):Object.entries(e).map(([e,t])=>({id:e,name:String(t??e)})):[]}E(D,class extends T{#e;#t=!1;constructor(){super();let t=this.attachShadow({mode:`open`}),n=document.createElement(`style`);n.textContent=xe;let r=document.createElement(`div`);r.className=`mount`,t.append(n,r),this.#e=e(r)}getStateIds(e){let t=k(e.player);return t?O.map(e=>`${t}.${e}`):[]}getObjectIds(e){let t=k(e.player);return t&&e.showSource!==!1?[`${t}.source`]:[]}async#n(t){let n=this.socket;if(!n||this.#t)return;this.#t=!0;let r=t.split(`.`).slice(0,2).join(`.`),i=this.systemLang,a=e=>M(i,e),s=document.createElement(`div`);s.style.width=`100%`,s.style.height=`100%`;let c=s.attachShadow({mode:`open`}),l=document.createElement(`style`);l.textContent=ce;let u=document.createElement(`div`);u.className=this.theme===`dark`?`mount dark`:`mount`,this.settings.accent&&u.style.setProperty(`--accent`,this.settings.accent),c.append(l,u);let d=e(u);d.render(/* @__PURE__ */ o(se,{load:(e,t,i,o)=>{let s,c=new Promise((e,t)=>{s=setTimeout(()=>t(Error(a(`libraryError`))),Se)});return Promise.race([n.sendTo(r,`getMedia`,{list:e,search:t,offset:i,limit:o}),c]).finally(()=>clearTimeout(s))},word:a,storageKey:`${r}.library`,onPick:e=>s.dispatchEvent(new CustomEvent(`iob-dialog-close`,{bubbles:!0,composed:!0,detail:e}))}));try{let e=await this.openDialog({element:s,title:a(`library`),width:440,height:560});typeof e==`string`&&e&&await this.setState(`${t}.playMedia`,e)}finally{this.#t=!1,d.unmount()}}render(){let e=this.settings,t=this.systemLang,n=e=>M(t,e),r=k(e.player);if(!r){this.#e.render(/* @__PURE__ */ o(ve,{text:n(e.player?`notPlayer`:`choosePlayer`),editMode:this.editMode}));return}let i=e=>this.states[`${r}.${e}`]||null,a=e=>{let t=i(e)?.val;return t==null?``:String(t)},s=e=>Number(i(e)?.val)||0,c=i(`elapsedTime`),l=this.objects[`${r}.source`],u=l?.type===`state`?l.common.states:void 0,d={name:e.title||a(`name`)||r.split(`.`).pop()||``,available:!i(`available`)||!!i(`available`)?.val,powered:!i(`powered`)||!!i(`powered`)?.val,playing:s(`state`)===1,volume:s(`volume`),muted:!!i(`muted`)?.val,shuffle:!!i(`shuffle`)?.val,repeat:s(`repeat`),elapsed:Number(c?.val)||0,elapsedTs:c?.ts||0,duration:s(`duration`),title:a(`mediaTitle`),artist:a(`mediaArtist`),album:a(`mediaAlbum`),image:a(`mediaImage`),source:a(`source`),sources:Ce(u)};this.#e.render(/* @__PURE__ */ o(be,{values:d,showCover:e.showCover!==!1,showVolume:e.showVolume!==!1,showModes:e.showModes!==!1,showSource:e.showSource!==!1,onLibrary:e.showLibrary===!1?void 0:()=>void this.#n(r),accent:e.accent,theme:this.theme,editMode:this.editMode,word:n,onCommand:(e,t)=>void this.setState(`${r}.${e}`,t)}))}});