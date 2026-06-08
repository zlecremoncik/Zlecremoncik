const SUPABASE_URL = "https://uodwrtpaesemcizdhcht.supabase.co";
const SUPABASE_KEY = "sb_publishable_WVkoJLfkTfUD95EeSZMDQQ_VEhzlW6n";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null, currentProfile = null, selectedRole = 'klient', authRole = 'klient', currentView = 'wszystko';
let activeTargetId = null, activeZlecenieId = null;

// INICJALIZACJA
async function checkUser() {
    const { data: { session } } = await db.auth.getSession();
    updateUI(session);
}

async function updateUI(session) {
    currentUser = session?.user || null;
    document.getElementById('auth-panel').classList.toggle('hidden', !!session);
    document.getElementById('my-account-btn').classList.toggle('hidden', !session);
    
    if (currentUser) {
        const { data } = await db.from('profile_wykonawcow').select('*').eq('user_id', currentUser.id).single();
        currentProfile = data || null;
        if (currentProfile) {
            const pc = document.getElementById('points-counter');
            pc.innerText = `Posiadasz: ${currentProfile.punkty} pkt`;
            pc.classList.remove('hidden');
        }
        document.getElementById('add-panel').classList.toggle('hidden', currentView === 'konto');
    }
    
    if (currentView === 'konto') loadAccountPanel(); else load();
}

db.auth.onAuthStateChange((_, session) => updateUI(session));
checkUser();

// AUTH
function setAuthRole(r) { 
    authRole = r; 
    document.getElementById('pro-register-fields').classList.toggle('hidden', r !== 'wykonawca');
}

async function signUp() {
    const e = document.getElementById('email').value, p = document.getElementById('password').value;
    const { data, error } = await db.auth.signUp({ email: e, password: p });
    if (error) return alert(error.message);

    if (authRole === 'wykonawca' && data.user) {
        await db.from('profile_wykonawcow').insert([{
            user_id: data.user.id,
            nazwa_firmy: document.getElementById('reg-firma').value,
            miejscowosc: document.getElementById('reg-miejscowosc').value,
            kod_pocztowy: document.getElementById('reg-kod').value,
            specjalizacja: document.getElementById('reg-spec').value,
            punkty: 10
        }]);
    }
    alert("Wysłaliśmy link aktywacyjny na Twój e-mail. Potwierdź go, aby się zalogować!");
}

async function signIn() {
    const e = document.getElementById('email').value, p = document.getElementById('password').value;
    const { error } = await db.auth.signInWithPassword({ email: e, password: p });
    if (error) alert(error.message);
}

async function signOut() { await db.auth.signOut(); setView('wszystko'); }

// OGŁOSZENIA
async function add() {
    const data = {
        tytul: document.getElementById('t').value, miasto: document.getElementById('m').value,
        kod_pocztowy: document.getElementById('postcode').value, opis: document.getElementById('o').value,
        telefon: document.getElementById('p').value, user_id: currentUser.id, typ_wpisu: selectedRole
    };
    if (data.telefon.length !== 9) return alert("Podaj 9 cyfr telefonu!");
    await db.from('zlecenia').insert([data]);
    alert("Dodano!"); load();
}

async function load() {
    let q = db.from('zlecenia').select('*, zgloszenia(id)').order('id', { ascending: false });
    if (currentView !== 'wszystko') q = q.eq('typ_wpisu', currentView);
    const { data } = await q;

    const list = document.getElementById('list');
    list.innerHTML = data.map(z => `
        <div onclick="openDetails(${z.id})" class="bg-white p-6 rounded-[2rem] card-shadow cursor-pointer border border-slate-100 hover:border-blue-200 transition-all">
            <div class="flex justify-between text-[9px] font-black uppercase mb-3">
                <span class="${z.typ_wpisu === 'klient' ? 'text-blue-600' : 'text-amber-500'}">${z.typ_wpisu === 'klient' ? '📝 Zlecenie' : '⭐ Fachowiec'}</span>
                <span>📍 ${z.miasto} (${z.kod_pocztowy})</span>
            </div>
            <h3 class="text-lg font-black">${z.tytul}</h3>
            <div class="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>Chętnych: ${z.zgloszenia.length}/5</span>
                <div class="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500" style="width: ${z.zgloszenia.length * 20}%"></div>
                </div>
            </div>
        </div>
    `).join("");
}

// SZCZEGÓŁY I ZGŁOSZENIA
async function openDetails(id) {
    window.location.hash = `ogloszenie-${id}`;
    document.getElementById('list-view').classList.add('hidden');
    document.getElementById('details-view').classList.remove('hidden');
    
    const { data: z } = await db.from('zlecenia').select('*').eq('id', id).single();
    const { count } = await db.from('zgloszenia').select('*', { count: 'exact', head: true }).eq('zlecenie_id', id);
    
    let action = "";
    if (currentUser && z.typ_wpisu === 'klient' && z.user_id !== currentUser.id) {
        action = count >= 5 ? `<div class="bg-red-50 text-red-500 p-4 rounded-2xl text-center font-black text-xs">Zebrano już komplet chętnych</div>`
                             : `<button onclick="apply(${z.id})" class="w-full bg-amber-500 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg">🙋 Jestem zainteresowany (-1 pkt)</button>`;
    }

    document.getElementById('details-content').innerHTML = `
        <div class="bg-white p-8 rounded-[2.5rem] card-shadow space-y-6">
            <h1 class="text-3xl font-black">${z.tytul}</h1>
            <p class="text-slate-600 leading-relaxed">${z.opis}</p>
            <div class="p-5 bg-slate-50 rounded-2xl flex justify-between items-center text-xs font-bold">
                <span>📍 ${z.miasto} | ${z.kod_pocztowy}</span>
                <span class="text-blue-600">📞 ${z.telefon}</span>
            </div>
            ${action}
        </div>`;
}

async function apply(id) {
    if (!currentProfile || currentProfile.punkty < 1) return alert("Brak punktów!");
    await db.from('zgloszenia').insert([{ zlecenie_id: id, wykonawca_id: currentUser.id }]);
    await db.from('profile_wykonawcow').update({ punkty: currentProfile.punkty - 1 }).eq('user_id', currentUser.id);
    alert("Zgłoszono!"); openDetails(id); updateUI();
}

// SYSTEM OPINII
async function submitOpinion() {
    const id = window.location.hash.split('-')[1];
    const em = document.getElementById('op-email').value, stars = parseInt(document.getElementById('op-stars').value), txt = document.getElementById('op-text').value;
    
    const { data: target } = await db.from('zlecenia').select('user_id').eq('id', id).single();
    const { error } = await db.from('opinie').insert([{ wykonawca_id: target.user_id, autor_email: em, gwiazdki: stars, tresc: txt }]);
    
    if (!error && stars >= 2) {
        const { data: prof } = await db.from('profile_wykonawcow').select('punkty').eq('user_id', target.user_id).single();
        await db.from('profile_wykonawcow').update({ punkty: prof.punkty + stars }).eq('user_id', target.user_id);
    }
    alert("Dodano!");
}

// MOJE KONTO I CZAT
function toggleAccountMenu() { document.getElementById('account-dropdown').classList.toggle('hidden'); }

function setView(v) {
    currentView = v;
    document.getElementById('account-view').classList.toggle('hidden', v !== 'konto');
    document.getElementById('list-view').classList.toggle('hidden', v === 'konto');
    document.getElementById('details-view').classList.add('hidden');
    document.getElementById('account-dropdown').classList.add('hidden');
    updateUI();
}

async function loadAccountPanel() {
    const { data: posts } = await db.from('zlecenia').select('*, zgloszenia(wykonawca_id, profile_wykonawcow(nazwa_firmy))').eq('user_id', currentUser.id);
    const container = document.getElementById('user-posts-list');
    container.innerHTML = posts.map(p => `
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div class="flex justify-between font-bold text-xs"><span>${p.tytul}</span> <button onclick="delPost(${p.id})" class="text-red-500">Usuń</button></div>
            <div class="mt-2 space-y-1">
                ${p.zgloszenia.map(z => `<button onclick="startChat('${z.wykonawca_id}', ${p.id})" class="w-full text-left bg-white p-2 rounded-lg text-[9px] border">💬 ${z.profile_wykonawcow.nazwa_firmy}</button>`).join('')}
            </div>
        </div>
    `).join('');
    loadChatList();
}

async function startChat(tid, zid) {
    activeTargetId = tid; activeZlecenieId = zid;
    document.getElementById('chat-box').classList.remove('hidden');
    loadMessages();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    await db.from('wiadomosci').insert([{ zlecenie_id: activeZlecenieId, nadawca_id: currentUser.id, odbiorca_id: activeTargetId, tresc: input.value }]);
    input.value = ""; loadMessages();
}

async function loadMessages() {
    const { data } = await db.from('wiadomosci').select('*').eq('zlecenie_id', activeZlecenieId).or(`and(nadawca_id.eq.${currentUser.id},odbiorca_id.eq.${activeTargetId}),and(nadawca_id.eq.${activeTargetId},odbiorca_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    document.getElementById('chat-messages').innerHTML = data.map(m => `
        <div class="${m.nadawca_id === currentUser.id ? 'bg-blue-600 text-white ml-8 rounded-t-xl rounded-bl-xl' : 'bg-white mr-8 rounded-t-xl rounded-br-xl'} p-3 shadow-sm mb-2">
            <p>${m.tresc}</p>
            <p class="text-[7px] mt-1 opacity-60 text-right">${new Date(m.created_at).toLocaleString()}</p>
        </div>`).join('');
}

function goBackToList() { window.location.hash = ""; document.getElementById('details-view').classList.add('hidden'); document.getElementById('list-view').classList.remove('hidden'); setView('wszystko'); }
