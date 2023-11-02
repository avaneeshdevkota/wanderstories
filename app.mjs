import "./config.mjs";
import "./db.mjs";
import express from 'express'
import session from "express-session";
import mongoose from "mongoose";
import path from 'path'
import { fileURLToPath } from 'url';
import argon2 from 'argon2'

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionOptions = { 
	secret: 'secretCode', 
	saveUninitialized: false, 
	resave: false 
};

app.use(session(sessionOptions));

app.set('view engine', 'hbs');
app.use(express.urlencoded({extended : false}));

const User = mongoose.model('User');
const Story = mongoose.model('Story');

app.get('/', (req, res) => {
    res.render('index', {user : req.session.user});
})

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {

    const foundUser = await User.findOne({username: req.body.username});

    if (foundUser) {   
        res.render('register', {error: 'Username already taken.'});
    }

    if (req.body.pw != req.body.pwc) {
        res.render('register', {error: 'Passwords do not match.'});
    }
 
    try {
        const newUser = new User({
            username: req.body.username,
            hash: await argon2.hash(req.body.pw),
            bio: '',
            stories: [],
            following: [],
            bookmarks: []
        });

        await newUser.save();
        req.session.user = newUser;
        res.redirect('/')
    }

    catch(e) {
        res.render('register', {error : e});
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {

    try {

        const foundUser = await User.findOne({username: req.body.username});

        if (foundUser) {

            if (await argon2.verify(foundUser.hash, req.body.pw)) {
                req.session.user = foundUser;
                res.redirect('/')
            }

            else {
                res.render('login', {error : "Incorrect Password"});
            }
        }

        else {
            res.render('login', {error : "User doesn't exist."})
        }
    }

    catch(e) {
        res.status(500).send("Internal Server Error");
    }
});

app.get('/logout', (req, res) => {

    req.session.destroy((err) => {

        if (err) {
          console.error('Error destroying session:', err);
        }

        res.redirect('/');
      });
})

app.get('/:username/edit', (req, res) => {

    if (req.session.user.username != req.params.username) {
        res.redirect('/');
    }

    res.render('profile_edit', {user: req.session.user});
})

app.post('/:username/edit', async (req, res) => {

    if (req.session.user.username == req.body.username) {

        if (req.session.user.bio != req.body.bio) {

            await User.findOneAndUpdate({username: req.session.user.username}, {bio: req.body.bio});
            req.session.user = await User.findOne({username: req.session.user.username});
        }
        
        res.redirect('/');
    }

    else {

        const foundUser = await User.findOne({username: req.body.username});

        if (foundUser) {
            res.render('profile_edit', {error: 'Username already taken.'});
        }

        else {

            if (req.body.pw) {

                if (await argon2.verify(req.session.user.hash, req.body.pw)) {

                    await User.findOneAndUpdate({username: req.session.user.username}, {username: req.body.username});
                    req.session.user = await User.findOne({username: req.body.username});
                    res.redirect('/');
                }

                else {
                    res.render('profile_edit', {error: 'Incorrect Password.'});
                }
            }

            else {
                res.render('profile_edit', {error: 'Enter your password to change username.'});
            }
        }
    }
});

app.listen(process.env.PORT || 3000);
