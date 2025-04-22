const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'hemmeligkode',
    resave: false,
    saveUninitialized: true
}));

const usersFile = path.join(__dirname, 'users.json');

function checkAuth(req, res, next) {
    if (!req.session.username) return res.redirect('/login');
    next();
}

function renderLayout(content, message = "") {
    const isError = message?.toLowerCase().includes("forkert") || message?.toLowerCase().includes("ikke");
    return `
    <html>
    <head><style>
        body { background: #2e2e2e; color: white; font-family: Arial; padding: 20px; }
        textarea, input { width: 100%; padding: 10px; margin: 5px 0; background: #444; color: white; border: none; border-radius: 5px; }
        .btn {
            padding: 10px 15px;
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
            margin: 5px 5px 5px 0;
            border-radius: 5px;
            border: none;
            cursor: pointer;
        }
        .btn-green { background: #2d6a35; color: white; }
        .btn-red { background: #9e2a2f; color: white; }
        .btn-blue { background: #2d6e9e; color: white; }
        .btn-yellow { background: #f0ad4e; color: white; }
        .btn-gray { background: #5c5c5c; color: white; }
        .btn:hover { filter: brightness(1.15); }

        .note-box { max-width: 600px; margin: auto; background: #3e3e3e; padding: 20px; border-radius: 10px; }
        .note-list { margin-top: 20px; }
        .msg-box {
            background: ${isError ? '#552222' : '#444'};
            color: ${isError ? '#ff9999' : '#aaffaa'};
            padding: 10px;
            margin-bottom: 15px;
            border-radius: 5px;
        }
    </style></head>
    <body>
        <div class="note-box">
            ${message ? `<div class="msg-box">${message}</div>` : ''}
            ${content}
        </div>
    </body></html>
    `;
}

app.get('/', (req, res) => {
    if (req.session.username) return res.redirect('/notes');
    res.redirect('/login');
});

app.get('/register', (req, res) => {
    res.send(renderLayout(`
        <h1>Opret bruger</h1>
        <form action="/register" method="POST">
            <label>Brugernavn:</label><input name="username" required>
            <label>Adgangskode:</label><input type="password" name="password" required>
            <button type="submit" class="btn btn-gray">Opret</button>
        </form>
        <p>Har du en konto? <a href="/login" class="btn btn-gray">Login</a></p>
    `));
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    fs.readFile(usersFile, (err, data) => {
        let users = [];
        try { users = JSON.parse(data); } catch {}
        if (users.some(u => u.username === username)) {
            return res.send(renderLayout(`<p>Brugernavnet er allerede oprettet.</p>`, "Brugernavnet findes allerede."));
        }
        bcrypt.hash(password, 10, (err, hash) => {
            users.push({ username, password: hash });
            fs.writeFile(usersFile, JSON.stringify(users, null, 2), () => res.redirect('/login'));
        });
    });
});

app.get('/login', (req, res) => {
    res.send(renderLayout(`
        <h1>Login</h1>
        <form action="/login" method="POST">
            <label>Brugernavn:</label><input name="username" required>
            <label>Adgangskode:</label><input type="password" name="password" required>
            <button type="submit" class="btn btn-gray">Login</button>
        </form>
        <p>Ingen konto? <a href="/register" class="btn btn-gray">Opret</a></p>
    `));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    fs.readFile(usersFile, (err, data) => {
        let users = [];
        try { users = JSON.parse(data); } catch {}
        const user = users.find(u => u.username === username);
        if (!user) return res.send(renderLayout('', 'Brugernavn ikke fundet.'));
        bcrypt.compare(password, user.password, (err, same) => {
            if (!same) return res.send(renderLayout('', 'Forkert adgangskode.'));
            req.session.username = user.username;
            res.redirect('/notes');
        });
    });
});

app.get('/notes', checkAuth, (req, res) => {
    const userNotesFile = path.join(__dirname, `${req.session.username}_notes.json`);
    let notes = [];
    if (fs.existsSync(userNotesFile)) notes = JSON.parse(fs.readFileSync(userNotesFile));

    let noteItems = notes.map(note => `
        <li>
            <strong>${note.title}</strong><br>
            <a href="/view-note?id=${note.id}" class="btn btn-blue">Åben</a>
            <a href="/share-note?id=${note.id}" class="btn btn-yellow">Del</a>
            <form method='POST' action='/delete-note' style='display:inline'>
                <input type='hidden' name='id' value='${note.id}'>
                <button type='submit' class="btn btn-red">Slet</button>
            </form>
        </li>
    `).join('');

    res.send(renderLayout(`
        <h1>(Non) Secure Note!</h1>
        <form method="POST" action="/note">
            <label>Titel:</label><input name="title" required>
            <label>Tekst:</label><textarea name="text" rows="4" required></textarea>
            <button type="submit" class="btn btn-green">Gem</button>
        </form>
        <div class="note-list">
            <h3>Dine noter:</h3>
            <ul>${noteItems || 'Ingen noter endnu.'}</ul>
        </div>
    `));
});

app.post('/note', checkAuth, (req, res) => {
    const { title, text } = req.body;
    const userNotesFile = path.join(__dirname, `${req.session.username}_notes.json`);
    let notes = [];
    if (fs.existsSync(userNotesFile)) notes = JSON.parse(fs.readFileSync(userNotesFile));
    const newNote = { id: Date.now(), title, text };
    notes.push(newNote);
    fs.writeFileSync(userNotesFile, JSON.stringify(notes, null, 2));
    res.redirect('/notes');
});

app.get('/view-note', checkAuth, (req, res) => {
    const id = parseInt(req.query.id);
    const userNotesFile = path.join(__dirname, `${req.session.username}_notes.json`);
    const notes = JSON.parse(fs.readFileSync(userNotesFile));
    const note = notes.find(n => n.id === id);
    if (!note) return res.send(renderLayout('', "Note ikke fundet"));
    res.send(renderLayout(`
        <h1>${note.title}</h1>
        <p>${note.text}</p>
        <a href="/notes" class="btn btn-gray">Tilbage</a>
    `));
});

app.post('/delete-note', checkAuth, (req, res) => {
    const id = parseInt(req.body.id);
    const userNotesFile = path.join(__dirname, `${req.session.username}_notes.json`);
    let notes = JSON.parse(fs.readFileSync(userNotesFile));
    notes = notes.filter(n => n.id !== id);
    fs.writeFileSync(userNotesFile, JSON.stringify(notes, null, 2));
    res.redirect('/notes');
});

app.get('/share-note', checkAuth, (req, res) => {
    const id = req.query.id;
    res.send(renderLayout(`
        <h3>Del denne note med linket:</h3>
        <p><a href="/shared-note?id=${id}" class="btn btn-yellow">/shared-note?id=${id}</a></p>
    `));
});

app.get('/shared-note', (req, res) => {
    const id = parseInt(req.query.id);
    const userNotesFile = path.join(__dirname, `${req.session.username}_notes.json`);
    const notes = JSON.parse(fs.readFileSync(userNotesFile));
    const note = notes.find(n => n.id === id);
    if (!note) return res.send(renderLayout('', "Note ikke fundet"));
    res.send(renderLayout(`
        <h1>${note.title}</h1>
        <p>${note.text}</p>
    `));
});

app.listen(PORT, () => console.log(`Server kører på http://localhost:${PORT}`));
