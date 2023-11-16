import express from 'express'
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from 'passport-local';
import { User, Story, Comment, Follow } from '../models.mjs';

const userRouter = express.Router();

userRouter.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
}));

userRouter.use(passport.initialize());
userRouter.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

userRouter.get('/register', (req, res) => {
    res.render('register');
});

userRouter.post('/register', async (req, res) => {

    if (req.body.password !== req.body.pwc) {
        res.render('register', {error : "Passwords do not match."});
    }
    
    else {

        const search_query = new RegExp(`^${req.body.username}$`, 'i');

        try {

            const foundUser = await User.findOne({username: search_query});

            if (foundUser) {
                res.render('register', {error : "User already exists."});
            }
            
            else {
                User.register(new User({username: req.body.username}), req.body.password, function(err, user) {
                    
                    if(err) {
                        console.log(err);
                        res.redirect('/register');
                    }
                    
                    passport.authenticate("local")(req, res, function(){
                        res.redirect("/");
                    });
                });
            }
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }
});

userRouter.get('/login', (req, res) => {
    res.render('login');
});

userRouter.post('/login', function(req, res, next) {

    passport.authenticate('local', function(err, user, info) {
        
        if (err) { return next(err) }
        if (!user) {
            return res.render('login', { error : info.message + '.' })
        }
        
        req.login(user, function(err) {
            if (err) { return next(err); }
            return res.redirect('/');
        });

    })(req, res, next);
});

userRouter.get('/logout', (req, res) => {
    
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

userRouter.get('/u/:userID', async (req, res) => {

    try {

        const user = await User.findOne({_id: req.params.userID});
        const posts = await Story.find({author: user}).populate('author');
        const numFollowing = (await Follow.find({following: user._id})).length;
        const numFollowers = (await Follow.find({followed: user._id})).length;

        let following;

        if (req.user) {
            following = await Follow.findOne({following: req.user._id, followed: user._id});
        }

        res.render('profile', {

            stories: posts,
            own: req.user ? req.user._id.equals(req.params.userID) : false,
            user: user,
            following: req.user ? following : false,
            numFollowing: numFollowing,
            numFollowers: numFollowers
        });
    }

    catch(error) {
        console.log(error);
        res.status(500).send("Something went wrong.");
    }
});

userRouter.get('/following', async (req, res) => {

    if (req.isAuthenticated()) {

        try {

            const following = (await Follow.find({following: req.user._id})).map(follow => follow.followed);
            const latestFollowingPosts = await Story.find({author: {$in: following}}).sort({timestamp: -1}).populate('author');
            res.render('following', {posts: latestFollowingPosts});
        }

        catch(error) {

            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.redirect('/');
    }
});

userRouter.get('/you', async (req, res) => {

    if (req.isAuthenticated()) {
        res.redirect(`/u/${req.user._id}`);
    }

    else {
        res.redirect('/');
    }
});

userRouter.get('/bookmarked', async (req, res) => {

    if (req.isAuthenticated()) {

        try {
            const bookmarked_posts = await Story.find({bookmarks: req.user._id}).populate('author');
            res.render('bookmarks', {bookmarks: bookmarked_posts});
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.redirect('/');
    }
});

userRouter.get('/liked', async (req, res) => {

    if (req.isAuthenticated()) {

        try {
            const liked_posts = await Story.find({likes: req.user._id}).populate('author');
            res.render('likes', {likes: liked_posts});
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.redirect('/');
    }
})

userRouter.get('/follow/:user_id', async (req, res) => {
    
    if (req.isAuthenticated()) {

        try {

            const following = req.user;
            const followed = await User.findOne({_id: req.params.user_id});
            
            if (followed) {

                const existingFollow = await Follow.findOne({following: following._id, followed: followed._id});
                
                if (existingFollow) {
                    await Follow.deleteOne(existingFollow);
                }
                
                else {
                    
                    const newFollow = new Follow({
                        following: following,
                        followed: followed
                    });

                    await newFollow.save();
                }
            }

            res.redirect(`/u/${followed._id}`);
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.redirect('/login');
    }
});

userRouter.get('/delete', async (req, res) => {

    if (req.isAuthenticated()) {

        try {

            await Story.deleteMany({author: req.user._id});
            await Comment.deleteMany({user: req.user._id});

            await Follow.deleteMany({$or : [
                {following: req.user._id},
                {followed: req.user._id}
            ]});

            await User.deleteOne({_id: req.user._id});
            res.redirect('/logout');
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }
});

export default userRouter;