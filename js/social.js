(function () {
    const FORMATS = ['commander', 'modern', 'standard', 'pioneer', 'legacy', 'vintage', 'pauper', 'draft', 'sealed', 'casual'];

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

    const gate = $('#auth-gate');
    const app  = $('#social-app');

    if (!window.SocialAPI?.isAuthed()) {
        gate.classList.remove('hidden');
        return;
    }
    app.classList.remove('hidden');

    // Tabs
    $$('.tab').forEach(btn => btn.addEventListener('click', () => {
        $$('.tab').forEach(t => t.classList.toggle('active', t === btn));
        $$('.panel').forEach(p => p.classList.add('hidden'));
        $(`#panel-${btn.dataset.tab}`).classList.remove('hidden');
    }));

    // ── Profile ──────────────────────────────────────────────────────────
    const form = $('#profile-form');
    const msg = $('#profile-msg');
    const checks = $('#format-checks');
    checks.innerHTML = FORMATS.map(f =>
        `<label><input type="checkbox" name="format" value="${f}"> ${f}</label>`
    ).join('');

    function setMsg(text, cls) {
        msg.textContent = text;
        msg.className = 'msg' + (cls ? ' ' + cls : '');
        if (text) setTimeout(() => { if (msg.textContent === text) msg.textContent = ''; }, 3000);
    }

    async function loadProfile() {
        try {
            const { data } = await window.SocialAPI.me();
            form.displayName.value = data.displayName || '';
            form.username.value    = data.username || '';
            form.avatarUrl.value   = data.avatarUrl || '';
            form.bio.value         = data.bio || '';
            const fav = new Set(data.favoriteFormats || []);
            $$('input[name=format]', checks).forEach(c => { c.checked = fav.has(c.value); });

            $('#stats-card').textContent =
                `Games played: ${data.stats?.gamesPlayed ?? 0} · Wins: ${data.stats?.gamesWon ?? 0}`;
        } catch (err) {
            setMsg(err.message, 'err');
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const patch = {
            displayName: form.displayName.value.trim(),
            username:    form.username.value.trim().toLowerCase() || undefined,
            avatarUrl:   form.avatarUrl.value.trim(),
            bio:         form.bio.value.trim(),
            favoriteFormats: $$('input[name=format]:checked', checks).map(c => c.value)
        };
        if (!patch.username) delete patch.username;
        try {
            await window.SocialAPI.updateMe(patch);
            setMsg('Saved.', 'ok');
        } catch (err) {
            setMsg(err.message, 'err');
        }
    });

    // ── Friends ──────────────────────────────────────────────────────────
    function avatar(u) {
        const initials = (u.displayName || u.username || '?').slice(0, 2).toUpperCase();
        const bg = u.avatarUrl ? `style="background-image:url('${escapeAttr(u.avatarUrl)}')"` : '';
        return `<div class="avatar" ${bg}>${u.avatarUrl ? '' : escapeHtml(initials)}</div>`;
    }

    function friendRow(f) {
        const u = f.user;
        const ctl = f.status === 'accepted'
            ? `<button class="btn small danger" data-unfriend="${f.id}">Remove</button>`
            : f.direction === 'incoming'
                ? `<button class="btn small primary" data-accept="${f.id}">Accept</button>
                   <button class="btn small" data-decline="${f.id}">Decline</button>`
                : `<button class="btn small" data-unfriend="${f.id}">Cancel</button>`;
        return `<div class="item">${avatar(u)}
            <div class="who">
                <div class="name">${escapeHtml(u.displayName || '')}</div>
                <div class="meta">${u.username ? '@' + escapeHtml(u.username) : ''}</div>
            </div>
            <div class="ctl">${ctl}</div>
        </div>`;
    }

    async function loadFriends() {
        try {
            const { data } = await window.SocialAPI.listFriends();
            const incoming = data.filter(f => f.status === 'pending' && f.direction === 'incoming');
            const outgoing = data.filter(f => f.status === 'pending' && f.direction === 'outgoing');
            const accepted = data.filter(f => f.status === 'accepted');

            render('#pending-in', incoming, 'No incoming requests.');
            render('#pending-out', outgoing, 'No outgoing requests.');
            render('#friends-accepted', accepted, 'No friends yet. Go find some players!');

            $('#friends-count').textContent = accepted.length || '';
        } catch (err) {
            console.error(err);
        }
    }

    function render(sel, rows, emptyMsg) {
        const el = $(sel);
        el.innerHTML = rows.length ? rows.map(friendRow).join('') : `<div class="empty">${emptyMsg}</div>`;
    }

    $('#panel-friends').addEventListener('click', async (e) => {
        const t = e.target;
        try {
            if (t.dataset.accept)   { await window.SocialAPI.respondFriend(t.dataset.accept, 'accept');  loadFriends(); }
            if (t.dataset.decline)  { await window.SocialAPI.respondFriend(t.dataset.decline, 'decline'); loadFriends(); }
            if (t.dataset.unfriend) { await window.SocialAPI.removeFriend(t.dataset.unfriend);            loadFriends(); }
        } catch (err) { alert(err.message); }
    });

    // ── Invites ──────────────────────────────────────────────────────────
    async function loadInvites() {
        try {
            const { data } = await window.SocialAPI.listInvites();
            const html = data.map(i => `
                <div class="item">${avatar(i.host || {})}
                    <div class="who">
                        <div class="name">${escapeHtml(i.name || 'Untitled game')}</div>
                        <div class="meta">${escapeHtml(i.format)} · ${i.players}/${i.maxPlayers} · from ${escapeHtml(i.host?.displayName || 'host')}</div>
                    </div>
                    <div class="ctl">
                        <button class="btn small primary" data-accept-invite="${escapeAttr(i.gameId)}">Join</button>
                        <button class="btn small" data-decline-invite="${escapeAttr(i.gameId)}">Decline</button>
                    </div>
                </div>`).join('');
            $('#invites-list').innerHTML = html || '<div class="empty">No pending invites.</div>';
            $('#invites-count').textContent = data.length || '';
        } catch (err) { console.error(err); }
    }

    $('#panel-invites').addEventListener('click', async (e) => {
        const t = e.target;
        try {
            if (t.dataset.acceptInvite) {
                await window.SocialAPI.respondInvite(t.dataset.acceptInvite, 'accept');
                location.href = `index.html?game=${encodeURIComponent(t.dataset.acceptInvite)}`;
            }
            if (t.dataset.declineInvite) {
                await window.SocialAPI.respondInvite(t.dataset.declineInvite, 'decline');
                loadInvites();
            }
        } catch (err) { alert(err.message); }
    });

    // ── Find players ─────────────────────────────────────────────────────
    let searchTimer;
    $('#find-input').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        const q = e.target.value.trim();
        searchTimer = setTimeout(() => runSearch(q), 250);
    });

    async function runSearch(q) {
        const box = $('#find-results');
        if (q.length < 2) { box.innerHTML = '<div class="empty">Type at least 2 characters.</div>'; return; }
        try {
            const { data } = await window.SocialAPI.searchUsers(q);
            box.innerHTML = data.length
                ? data.map(u => `<div class="item">${avatar(u)}
                        <div class="who">
                            <div class="name">${escapeHtml(u.displayName || '')}</div>
                            <div class="meta">${u.username ? '@' + escapeHtml(u.username) : ''}</div>
                        </div>
                        <div class="ctl"><button class="btn small primary" data-add="${u.id}">Add friend</button></div>
                    </div>`).join('')
                : '<div class="empty">No matches.</div>';
        } catch (err) { box.innerHTML = `<div class="empty">${err.message}</div>`; }
    }

    $('#find-results').addEventListener('click', async (e) => {
        if (!e.target.dataset.add) return;
        try {
            await window.SocialAPI.addFriend(e.target.dataset.add);
            e.target.textContent = 'Sent';
            e.target.disabled = true;
            loadFriends();
        } catch (err) { alert(err.message); }
    });

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

    loadProfile();
    loadFriends();
    loadInvites();
})();
