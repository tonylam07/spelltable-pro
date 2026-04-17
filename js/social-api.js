// Tiny fetch wrapper for social/profile/game-browser endpoints.
(function (root) {
    const TOKEN_KEY = 'jwt';

    function token() { return localStorage.getItem(TOKEN_KEY); }

    async function request(method, url, body) {
        const headers = { 'Content-Type': 'application/json' };
        const t = token();
        if (t) headers['Authorization'] = `Bearer ${t}`;
        const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        let json;
        try { json = await res.json(); } catch { json = {}; }
        if (!res.ok || json.success === false) {
            const err = new Error(json.error || json.message || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return json;
    }

    root.SocialAPI = {
        isAuthed: () => Boolean(token()),
        me:            ()         => request('GET',    '/api/users/me'),
        updateMe:      (patch)    => request('PATCH',  '/api/users/me', patch),
        searchUsers:   (q)        => request('GET',    `/api/users/search?q=${encodeURIComponent(q)}`),
        getUser:       (id)       => request('GET',    `/api/users/${id}`),

        listFriends:   ()         => request('GET',    '/api/friends'),
        addFriend:     (userId)   => request('POST',   '/api/friends', { userId }),
        respondFriend: (id, action) => request('PATCH', `/api/friends/${id}`, { action }),
        removeFriend:  (id)       => request('DELETE', `/api/friends/${id}`),

        listInvites:   ()         => request('GET',    '/api/games/invites/mine'),
        respondInvite: (gameId, action) => request('PATCH', `/api/games/${gameId}/invites/me`, { action }),
        invite:        (gameId, userId) => request('POST', `/api/games/${gameId}/invites`, { userId }),

        browse:        (format)   => request('GET',    '/api/games/browse/public' + (format ? `?format=${format}` : ''))
    };
})(typeof window !== 'undefined' ? window : globalThis);
