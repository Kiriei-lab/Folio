/* Folio — local-first EPUB reader starter */
const $ = id => document.getElementById(id);
const DB_NAME = "folio-reader-db";
const STORE = "books";
let db, books = [], currentBook = null, rendition = null, epubBook = null, toastTimer;

function openDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:"id"});
    request.onsuccess=()=>{db=request.result;resolve(db)};
    request.onerror=()=>reject(request.error);
  });
}
function dbRequest(mode, action){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode), store=tx.objectStore(STORE);
    const req=action(store);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
const getAll=()=>dbRequest("readonly",s=>s.getAll());
const saveBook=b=>dbRequest("readwrite",s=>s.put(b));
const deleteBook=id=>dbRequest("readwrite",s=>s.delete(id));
function toast(message){
  const el=$("toast");el.textContent=message;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
}
function escapeHTML(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function hashColor(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)%360;}
function coverStyle(title){const h=hashColor(title);return `background:linear-gradient(145deg,hsl(${h} 25% 35%),hsl(${(h+25)%360} 35% 17%))`;}
function pct(book){return Math.max(0,Math.min(100,Math.round((book.progress||0)*100)));}
function renderLibrary(){
  const query=$("librarySearch").value.trim().toLowerCase();
  const sort=$("sortSelect").value;
  let list=books.filter(b=>(b.title+" "+b.author).toLowerCase().includes(query));
  if(sort==="title")list.sort((a,b)=>a.title.localeCompare(b.title));
  else if(sort==="progress")list.sort((a,b)=>(b.progress||0)-(a.progress||0));
  else list.sort((a,b)=>(b.added||0)-(a.added||0));
  $("bookCount").textContent=books.length;
  $("emptyState").classList.toggle("hidden",books.length>0);
  $("bookGrid").innerHTML=list.map(b=>`
    <article class="book-card">
      <button class="cover-button" data-open="${b.id}" aria-label="Open ${escapeHTML(b.title)}">
        <div class="cover-art" style="${coverStyle(b.title)}">
          <span class="cover-author">${escapeHTML(b.author||"Unknown author")}</span>
          <span class="cover-title">${escapeHTML(b.title)}</span>
          <span class="cover-bottom">Folio edition</span>
        </div>
      </button>
      <button class="book-delete" data-delete="${b.id}" aria-label="Remove ${escapeHTML(b.title)}">×</button>
      <div class="book-title">${escapeHTML(b.title)}</div>
      <div class="book-meta"><span>${escapeHTML(b.author||"Unknown author")}</span><span>${pct(b)}%</span></div>
      <div class="mini-progress"><span style="width:${pct(b)}%"></span></div>
    </article>`).join("");
  $("emptyState").classList.toggle("hidden",books.length!==0 || query.length>0);
  if(!list.length && books.length && query) $("bookGrid").innerHTML='<p class="tiny-note">No books match that search.</p>';
}
async function importFiles(fileList){
  
function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "folio-" + Date.now() + "-" +
    Math.random().toString(36).slice(2);
}

async function readFileBuffer(file) {
  if (typeof file.arrayBuffer === "function") {
    return await file.arrayBuffer();
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(reader.error || new Error("Could not read the file"));
    reader.readAsArrayBuffer(file);
  });
}

async function importFiles(fileList) {
  const files = Array.from(fileList || []);

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".epub")) {
      toast("Please choose an EPUB file.");
      continue;
    }

    try {
      if (!db) {
        throw new Error("Local database is not ready. Refresh Folio.");
      }

      const buffer = await readFileBuffer(file);
      let title = file.name.replace(/\.epub$/i, "");
      let author = "Unknown author";
      let identifier = makeId();

      if (window.ePub) {
        let temp;
        try {
          temp = ePub(buffer);
          await temp.open(buffer);
          const meta = await temp.loaded.metadata;
          title = meta.title || title;
          author = meta.creator || author;
          identifier = meta.identifier || identifier;
        } catch (metadataError) {
          console.warn("EPUB metadata could not be read:", metadataError);
        } finally {
          if (temp) {
            try { temp.destroy(); } catch (_) {}
          }
        }
      }

      const book = {
        id: makeId(),
        title,
        author,
        identifier,
        buffer,
        added: Date.now(),
        progress: 0,
        cfi: null,
        bookmarks: [],
        highlights: [],
        notes: []
      };

      await saveBook(book);
      toast("Added: " + title);
    } catch (err) {
      console.error("Folio import failed:", err);
      const detail = (err && err.name ? err.name + ": " : "") +
        (err && err.message ? err.message : String(err));
      toast("Import failed — " + detail);
    }
  }

  try {
    books = await getAll();
    renderLibrary();
  } catch (err) {
    console.error("Could not refresh bookshelf:", err);
    toast("Book saved, but bookshelf refresh failed.");
  }

  $("epubInput").value = "";
}
async function openReader(id){
  const item=books.find(b=>b.id===id);if(!item)return;
  if(!window.ePub){toast("The EPUB engine did not load. Connect to the internet and refresh.");return;}
  currentBook=item;$("libraryView").classList.add("hidden");$("readerView").classList.remove("hidden");
  $("readerBookTitle").textContent=item.title;$("readerLoading").classList.remove("hidden");
  $("epubMount").innerHTML="";
  if(rendition){try{rendition.destroy()}catch(_){}rendition=null;}
  if(epubBook){try{epubBook.destroy()}catch(_){}epubBook=null;}
  try{
    epubBook=ePub(item.buffer);
    rendition=epubBook.renderTo("epubMount",{width:"100%",height:"100%",flow:"paginated",spread:"auto",allowScriptedContent:false});
    const theme=getComputedStyle(document.body);
    rendition.themes.default({
      "body":{"font-family":"Georgia, 'Times New Roman', serif !important","color":"#28251f","line-height":"1.7","padding":"1.2em !important"},
      "p":{"line-height":"inherit","max-width":"48em"},
      "img":{"max-width":"100% !important","height":"auto !important"}
    });
    applyReaderTheme();
    await epubBook.ready;
    const nav=await epubBook.loaded.navigation;
    renderTOC(nav.toc||[]);
    await rendition.display(item.cfi||undefined);
    rendition.on("relocated",async loc=>{
      if(!currentBook)return;
      currentBook.cfi=loc.start.cfi;
      currentBook.progress=loc.start.percentage||0;
      const total=loc.end.percentage||loc.start.percentage||0;
      $("progressSlider").value=Math.round((loc.start.percentage||0)*1000);
      $("percentLabel").textContent=`${Math.round((loc.start.percentage||0)*100)}%`;
      $("locationLabel").textContent=loc.start.displayed?`Chapter ${loc.start.displayed.page} · ${loc.start.displayed.total} pages`:"Reading";
      try{await saveBook(currentBook)}catch(_){}
      books=books.map(b=>b.id===currentBook.id?currentBook:b);
    });
    $("readerLoading").classList.add("hidden");
    renderBookmarks();applyFontSettings();
  }catch(err){
    console.error(err);$("readerLoading").textContent="This EPUB could not be opened. It may be damaged or DRM-protected.";toast("Unable to open this EPUB.");
  }
}
function renderTOC(items){
  $("tocList").innerHTML="";
  const flatten=(arr,depth=0)=>arr.forEach(item=>{
    const btn=document.createElement("button");btn.className="toc-link";btn.style.paddingLeft=`${6+depth*12}px`;btn.textContent=item.label||"Untitled section";
    btn.addEventListener("click",()=>{if(rendition&&item.href){rendition.display(item.href);$("tocPanel").classList.add("hidden");}});
    $("tocList").appendChild(btn);if(item.subitems?.length)flatten(item.subitems,depth+1);
  });
  flatten(items);
}
function renderBookmarks(){
  const list=currentBook?.bookmarks||[];
  $("bookmarkList").innerHTML=list.length?list.map((b,i)=>`<div class="bookmark-item"><button class="toc-link" data-goto="${i}">${escapeHTML(b.label||"Bookmark "+(i+1))}</button><button class="icon-button remove-bookmark" data-remove-bookmark="${i}" aria-label="Delete bookmark">×</button></div>`).join(""):'<p class="tiny-note">No bookmarks yet. Tap ♧ while reading.</p>';
}
async function addBookmark(){
  if(!currentBook||!rendition)return;
  const loc=rendition.currentLocation();if(!loc?.start?.cfi)return;
  currentBook.bookmarks=currentBook.bookmarks||[];
  currentBook.bookmarks.push({cfi:loc.start.cfi,label:`${Math.round((loc.start.percentage||0)*100)}% · ${new Date().toLocaleDateString()}`,created:Date.now()});
  await saveBook(currentBook);renderBookmarks();toast("Bookmark saved");
}
function applyReaderTheme(){
  if(!rendition)return;
  const themes={
    paper:{bg:"#fbf8f1",ink:"#28251f"},
    light:{bg:"#ffffff",ink:"#222222"},
    sepia:{bg:"#f6ead5",ink:"#463526"},
    dark:{bg:"#202321",ink:"#e7e2d8"}
  };
  const t=themes[document.body.dataset.theme||"paper"];
  rendition.themes.default({"body":{"background":`${t.bg} !important`,"color":`${t.ink} !important`},"p,div,span,li":{"color":`${t.ink} !important`}});
  applyFontSettings();
}
function applyFontSettings(){
  if(!rendition)return;
  const size=Number($("fontSize").value);
  const line=Number($("lineHeight").value)/10;
  const width=Number($("pageWidth").value);
  rendition.themes.fontSize(`${size}%`);
  rendition.themes.default({"body":{"line-height":String(line)+" !important","max-width":`${width}px`,"margin":"0 auto !important"}});
  $("fontSizeValue").textContent=`${size}%`;$("lineHeightValue").textContent=line.toFixed(1);$("widthValue").textContent=`${width} px`;
}
function setTheme(theme){
  document.body.dataset.theme=theme;
  document.querySelectorAll(".theme-chip").forEach(b=>b.classList.toggle("active",b.dataset.theme===theme));
  localStorage.setItem("folio-theme",theme);applyReaderTheme();
}
function showSettings(){ $("settingsPanel").classList.toggle("hidden"); }
function showTOC(){ $("tocPanel").classList.toggle("hidden"); }
function exportBackup(){
  const data=books.map(({buffer,...b})=>({...b,buffer:Array.from(new Uint8Array(buffer))}));
  const blob=new Blob([JSON.stringify({app:"Folio",version:1,exportedAt:new Date().toISOString(),books:data})],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="folio-library-backup.json";a.click();URL.revokeObjectURL(url);
  toast("Backup exported");
}
async function restoreBackup(file){
  try{
    const data=JSON.parse(await file.text());
    for(const b of data.books||[]){if(Array.isArray(b.buffer))b.buffer=new Uint8Array(b.buffer).buffer;await saveBook(b);}
    books=await getAll();renderLibrary();toast("Backup restored");
  }catch(e){toast("That backup file could not be read.");}
}

$("epubInput").addEventListener("change",e=>importFiles(e.target.files));
$("bookGrid").addEventListener("click",e=>{
  const open=e.target.closest("[data-open]"),del=e.target.closest("[data-delete]");
  if(open)openReader(open.dataset.open);
  if(del){const id=del.dataset.delete,book=books.find(b=>b.id===id);if(confirm(`Remove “${book?.title||"this book"}” from Folio?`)){deleteBook(id).then(async()=>{books=await getAll();renderLibrary();toast("Book removed from this device");});}}
});
$("homeButton").addEventListener("click",()=>{if(!$("readerView").classList.contains("hidden"))closeReader();});
$("backToLibrary").addEventListener("click",closeReader);
function closeReader(){
  if(rendition){try{rendition.destroy()}catch(_){}rendition=null;}
  if(epubBook){try{epubBook.destroy()}catch(_){}epubBook=null;}
  currentBook=null;$("readerView").classList.add("hidden");$("libraryView").classList.remove("hidden");renderLibrary();
}
$("prevChapter").addEventListener("click",()=>rendition?.prev());
$("nextChapter").addEventListener("click",()=>rendition?.next());
$("bookmarkButton").addEventListener("click",addBookmark);
$("tocToggle").addEventListener("click",showTOC);$("closeToc").addEventListener("click",showTOC);
$("readerSettingsToggle").addEventListener("click",showSettings);$("settingsToggle").addEventListener("click",showSettings);$("closeSettings").addEventListener("click",showSettings);
$("settingsPanel").addEventListener("click",e=>{const b=e.target.closest("[data-theme]");if(b)setTheme(b.dataset.theme);});
["fontSize","lineHeight","pageWidth"].forEach(id=>$(id).addEventListener("input",()=>{applyFontSettings();localStorage.setItem("folio-"+id,$(id).value);}));
$("progressSlider").addEventListener("change",e=>{
  if(!epubBook||!rendition)return;
  const target=Number(e.target.value)/1000;
  const spine=epubBook.spine.spineItems;
  const item=spine.find(s=>target>=s.percentageFrom&&target<=s.percentageTo);
  if(item)rendition.display(item.href);
});
$("bookmarkList").addEventListener("click",e=>{
  const go=e.target.closest("[data-goto]"),remove=e.target.closest("[data-remove-bookmark]");
  if(go){const b=currentBook.bookmarks[Number(go.dataset.goto)];if(b)rendition?.display(b.cfi);}
  if(remove){currentBook.bookmarks.splice(Number(remove.dataset.removeBookmark),1);saveBook(currentBook).then(renderBookmarks);}
});
$("sortSelect").addEventListener("change",renderLibrary);
$("searchToggle").addEventListener("click",()=>{$("searchBar").classList.toggle("hidden");if(!$("searchBar").classList.contains("hidden"))$("librarySearch").focus();});
$("librarySearch").addEventListener("input",renderLibrary);
$("clearSearch").addEventListener("click",()=>{$("librarySearch").value="";renderLibrary();});
$("exportButton").addEventListener("click",exportBackup);
$("readerView").addEventListener("keydown",e=>{if(e.key==="ArrowRight")rendition?.next();if(e.key==="ArrowLeft")rendition?.prev();});
window.addEventListener("beforeunload",()=>{if(currentBook)saveBook(currentBook).catch(()=>{});});
(async()=>{
  try{await openDB();books=await getAll();renderLibrary();}
  catch(e){console.error(e);toast("Local storage is unavailable in this browser.");}
  setTheme(localStorage.getItem("folio-theme")||"paper");
  ["fontSize","lineHeight","pageWidth"].forEach(id=>{const v=localStorage.getItem("folio-"+id);if(v)$(id).value=v;});
  if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
})();
