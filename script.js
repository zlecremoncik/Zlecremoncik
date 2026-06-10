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
            pc.innerText = `${currentProfile.punkty} PKT`;
            pc.classList.remove('hidden');
        }
        document.getElementById('add-panel').classList.toggle('hidden', currentView === 'konto');
    }
    
    if (currentView === 'konto') loadAccountPanel(); else load();
}

db.auth.onAuthStateChange((_, session) => updateUI(session));

async function initAuth() {
    const hash = window.location.hash;

    if (hash.includes('access_token=')) {
        history.replaceState(
            {},
            document.title,
            '/Zlecremoncik/'
        );
    }

    const { data: { session } } = await db.auth.getSession();

    if (session) {
        updateUI(session);
    } else {
        checkUser();
    }
}

initAuth();

// MODAL MENU KONTRA
function toggleAccountModal(show) {
    const m = document.getElementById('account-modal');
    if(show) { m.classList.remove('hidden'); setTimeout(() => m.classList.add('active'), 10); }
    else { m.classList.remove('active'); setTimeout(() => m.classList.add('hidden'), 300); }
}

// LOGIKA AUTH
function setAuthRole(r) { 
    authRole = r; 
    document.getElementById('pro-fields').classList.toggle('hidden', r !== 'wykonawca');
}

function validatePassword(p) {
    return p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

async function signUp() {
    const e = document.getElementById('reg-email').value.trim();
    const p = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value.trim();
    const role = document.getElementById('reg-role').value;

    if(!e || !p) return alert("Podaj adres e-mail oraz hasło!");
    if(!validatePassword(p)) return alert("Hasło musi zawierać min. 8 znaków, dużą literę, cyfrę oraz znak specjalny.");

    if(!e || !p) return alert("Podaj adres e-mail oraz hasło!");

    const { data, error } = await db.auth.signUp({ email: e, password: p });
    
    if (error) return alert("Błąd rejestracji: " + error.message);

    if (role === 'wykonawca' && data.user) {
        const checkedBoxes = document.querySelectorAll('.spec-checkbox-item:checked');
        const wybraneSpecjalizacje = Array.from(checkedBoxes).map(cb => cb.value).join(", ") || "Ogólne prace remontowe";

        await db.from('profile_wykonawcow').insert([{
            user_id: data.user.id,
            nazwa_firmy: document.getElementById('reg-firma').value || "Fachowiec",
            nip: document.getElementById('reg-nip').value || null,
            miejscowosc: document.getElementById('reg-miejscowosc').value || "Nie podano",
            kod_pocztowy: document.getElementById('reg-kod').value || "00-000",
            specjalizacja: wybraneSpecjalizacje,
            punkty: 10,
            telefon: phone || null
        }]);
    } else if (phone && data.user) {
        await db.auth.updateUser({ data: { telefon_kontaktowy: phone } });
    }

    alert("Konto zostało zarejestrowane pomyślnie! Możesz się zalogować.");
}

async function signIn() {
    const e = document.getElementById('email').value, p = document.getElementById('password').value;
    const { error } = await db.auth.signInWithPassword({ email: e, password: p });
    if (error) alert(error.message);
}

async function loginWithGoogle() {
    const role = document.getElementById('google-role').value;

    localStorage.setItem('google_login_role', role);

    const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
        redirectTo: 'https://zlecremoncik.github.io/Zlecremoncik/'
    }
});

console.log('Google redirect:',
    'https://zlecremoncik.github.io/Zlecremoncik/');

    if (error) {
        alert("Błąd Google: " + error.message);
    }
}
async function signOut() { await db.auth.signOut(); toggleAccountModal(false); setView('wszystko'); }

// OGŁOSZENIA
async function add() {
    const data = {
        tytul: document.getElementById('t').value, miasto: document.getElementById('m').value,
        kod_pocztowy: document.getElementById('postcode').value, opis: document.getElementById('o').value,
        telefon: document.getElementById('p').value, user_id: currentUser.id, typ_wpisu: selectedRole
    };
    if (data.telefon.length !== 9) return alert("Telefon musi mieć 9 cyfr!");
    await db.from('zlecenie').insert([data]);
    alert("Dodano!"); load();
}

async function load() {
    // Tabela 'zlecenie' zgodnie ze screenem
    let q = db.from('zlecenie').select('*, zgloszenia(id)').order('id', { ascending: false });
    if (currentView !== 'wszystko') q = q.eq('typ_wpisu', currentView);
    const { data } = await q;

    const list = document.getElementById('list');
    list.innerHTML = data.map(z => `
        <div onclick="openDetails(${z.id})" class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm active:scale-95 transition-all">
            <div class="flex justify-between text-[8px] font-black uppercase mb-2">
                <span class="${z.typ_wpisu === 'klient' ? 'text-blue-600' : 'text-amber-500'}">${z.typ_wpisu === 'klient' ? '📝 Zlecenie' : '⭐ Fachowiec'}</span>
                <span>📍 ${z.miasto} (${z.kod_pocztowy})</span>
            </div>
            <h3 class="text-sm font-black text-slate-800 leading-tight mb-3">${z.tytul}</h3>
            <div class="flex items-center justify-between text-[9px] font-bold text-slate-400">
                <span>Chętnych: ${z.zgloszenia.length}/5</span>
                <div class="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500" style="width: ${z.zgloszenia.length * 20}%"></div>
                </div>
            </div>
        </div>
    `).join("");
}

async function openDetails(id) {
    window.location.hash = `ogloszenie-${id}`;
    document.getElementById('list-view').classList.add('hidden');
    document.getElementById('details-view').classList.remove('hidden');
    
    const { data: z } = await db.from('zlecenie').select('*').eq('id', id).single();
    const { count } = await db.from('zgloszenia').select('*', { count: 'exact', head: true }).eq('zlecenie_id', id);
    
    let action = "";
    if (currentUser && z.typ_wpisu === 'klient' && z.user_id !== currentUser.id) {
        action = count >= 5 ? `<div class="bg-red-50 text-red-500 p-4 rounded-2xl text-center font-black text-[10px] uppercase">Zebrano już komplet chętnych</div>`
                             : `<button onclick="apply(${z.id})" class="w-full bg-amber-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg">🙋 Jestem zainteresowany (-1 pkt)</button>`;
    }

    document.getElementById('details-content').innerHTML = `
        <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 space-y-4">
            <h1 class="text-xl font-black leading-tight text-slate-800">${z.tytul}</h1>
            <p class="text-slate-500 text-xs leading-relaxed">${z.opis}</p>
            <div class="p-4 bg-slate-50 rounded-2xl flex justify-between items-center text-[10px] font-black">
                <span class="text-slate-400 uppercase tracking-widest">📍 ${z.miasto} | ${z.kod_pocztowy}</span>
                <span class="text-blue-600 bg-white px-3 py-1.5 rounded-lg border">📞 ${z.telefon}</span>
            </div>
            ${action}
        </div>`;
    
    const opinionsSec = document.getElementById('opinions-section');
    if (z.typ_wpisu === 'wykonawca') { opinionsSec.classList.remove('hidden'); loadOpinions(z.user_id); } 
    else { opinionsSec.classList.add('hidden'); }
}

async function apply(id) {
    if (!currentProfile || currentProfile.punkty < 1) return alert("Brak punktów!");
    await db.from('zgloszenia').insert([{ zlecenie_id: id, wykonawca_id: currentUser.id }]);
    await db.from('profile_wykonawcow').update({ punkty: currentProfile.punkty - 1 }).eq('user_id', currentUser.id);
    alert("Zgłoszono!"); openDetails(id); updateUI();
}

// CZAT I KONTO
async function loadAccountPanel() {
    const { data: posts } = await db.from('zlecenie').select('*, zgloszenia(wykonawca_id, profile_wykonawcow(nazwa_firmy))').eq('user_id', currentUser.id);
    const container = document.getElementById('user-posts-list');
    container.innerHTML = posts.map(p => `
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div class="flex justify-between items-center mb-3">
                <span class="text-[10px] font-black uppercase text-slate-400">${p.tytul}</span>
                <button onclick="delPost(${p.id})" class="text-red-400 text-[8px] font-black uppercase">Usuń</button>
            </div>
            <div class="space-y-1">
                ${p.zgloszenia.map(z => `<button onclick="startChat('${z.wykonawca_id}', ${p.id})" class="w-full text-left bg-white p-3 rounded-xl text-[10px] font-bold border border-slate-100 shadow-sm">💬 ${z.profile_wykonawcow.nazwa_firmy}</button>`).join('')}
            </div>
        </div>
    `).join('');
    loadConversations();
}

async function startChat(tid, zid) {
    activeTargetId = tid; activeZlecenieId = zid;
    document.getElementById('chat-box').classList.remove('hidden');
    loadMessages();
}

async function sendMessage() {
    const i = document.getElementById('chat-input');
    if(!i.value.trim()) return;
    await db.from('wiadomosci').insert([{ zlecenie_id: activeZlecenieId, nadawca_id: currentUser.id, odbiorca_id: activeTargetId, tresc: i.value }]);
    i.value = ""; loadMessages();
}

async function loadMessages() {
    const { data } = await db.from('wiadomosci').select('*').eq('zlecenie_id', activeZlecenieId).or(`and(nadawca_id.eq.${currentUser.id},odbiorca_id.eq.${activeTargetId}),and(nadawca_id.eq.${activeTargetId},odbiorca_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    const msgBox = document.getElementById('chat-messages');
    msgBox.innerHTML = data.map(m => `
        <div class="${m.nadawca_id === currentUser.id ? 'ml-auto bg-blue-600 text-white rounded-t-xl rounded-bl-xl' : 'mr-auto bg-white border rounded-t-xl rounded-br-xl'} p-3 max-w-[80%] mb-1">
            <p>${m.tresc}</p>
            <p class="text-[6px] opacity-60 text-right mt-1 uppercase">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
        </div>`).join('');
    msgBox.scrollTop = msgBox.scrollHeight;
}

// PRAWNE MODALE
function openLegal(type) {
    const m = document.getElementById('legal-modal');
    const t = document.getElementById('legal-title');
    const b = document.getElementById('legal-body');
    m.classList.remove('hidden');
    
    if(type === 'regulamin') {
        t.innerText = "Regulamin Serwisu";
        b.innerHTML = "<p>1. Każdy wykonawca otrzymuje 10 punktów na start.</p><p>2. Zgłoszenie do zlecenia to koszt 1 pkt.</p><p>3. Punkty odnawiają się (+3) w każdy poniedziałek o 00:00.</p><p>4. Limit zgłoszeń na zlecenie wynosi 5 fachowców.</p>";
    } else if(type === 'rodo') {
        t.innerText = "RODO i Cookies";
        b.innerHTML = "<p>Przetwarzamy Twój e-mail i telefon tylko w celu kontaktu z fachowcem. Pliki cookies służą do utrzymania zalogowanej sesji. Masz prawo do usunięcia konta w panelu sterowania.</p>";
    } else {
        t.innerText = "Zasady Strony";
        b.innerHTML = "<p>Zasady są proste: Bądź rzetelny. Jako zleceniodawca podawaj prawdziwy e-mail. Jako fachowiec nie wyklikuj zleceń bezmyślnie, bo stracisz punkty kontaktu.</p>";
    }
}
function closeLegal() { document.getElementById('legal-modal').classList.add('hidden'); }

// ROUTING
function setView(v) {
    currentView = v;
    document.getElementById('account-view').classList.toggle('hidden', v !== 'konto');
    document.getElementById('list-view').classList.toggle('hidden', v === 'konto');
    document.getElementById('details-view').classList.add('hidden');
    toggleAccountModal(false);
    updateUI();
}

function goBackToList() { window.location.hash = ""; document.getElementById('details-view').classList.add('hidden'); document.getElementById('list-view').classList.remove('hidden'); setView('wszystko'); }
